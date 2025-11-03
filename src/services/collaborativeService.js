const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const ResilientService = require('./resilientService');

class CollaborativeService {
    constructor() {
        this.docs = google.docs('v1');
        this.drive = google.drive('v3');
        this.activeDocuments = new Map(); // documentId -> { collaborators, lastActivity }
        this.documentSessions = new Map(); // sessionId -> { documentId, userId, socketId }

        // Initialize Google OAuth2 client
        this.auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
        );

        // Initialize resilient service wrapper
        this.resilientService = new ResilientService('collaborative', {
            timeout: 20000, // 20 seconds for Google API calls
            maxRetries: 2,
            circuitBreakerThreshold: 4
        });
    }

    /**
     * Create a new collaborative document in Google Docs
     * @param {Object} documentData - Document creation data
     * @param {string} userId - User ID creating the document
     * @returns {Promise<Object>} Created document information
     */
    async createCollaborativeDocument(documentData, userId, options = {}) {
        return await this.resilientService.execute(async () => {
            // Set up authentication (in production, this would use stored tokens)
            if (process.env.GOOGLE_ACCESS_TOKEN) {
                this.auth.setCredentials({
                    access_token: process.env.GOOGLE_ACCESS_TOKEN,
                    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
                });
            } else {
                throw new Error('Google authentication not configured');
            }

            // Create document in Google Docs
            const createResponse = await this.docs.documents.create({
                auth: this.auth,
                requestBody: {
                    title: documentData.title || 'Document Collaboratif JusticeAutomation'
                }
            });

            const googleDocId = createResponse.data.documentId;

            // Insert initial content if provided
            if (documentData.content) {
                await this.docs.documents.batchUpdate({
                    auth: this.auth,
                    documentId: googleDocId,
                    requestBody: {
                        requests: [{
                            insertText: {
                                location: {
                                    index: 1
                                },
                                text: documentData.content
                            }
                        }]
                    }
                });
            }

            // Set document permissions for collaboration
            await this.drive.permissions.create({
                auth: this.auth,
                fileId: googleDocId,
                requestBody: {
                    role: 'writer',
                    type: 'anyone'
                }
            });

            // Initialize document session tracking
            const documentSession = {
                id: uuidv4(),
                googleDocId: googleDocId,
                localDocumentId: documentData.id || uuidv4(),
                title: documentData.title,
                createdBy: userId,
                collaborators: new Set([userId]),
                createdAt: new Date(),
                lastActivity: new Date(),
                status: 'active'
            };

            this.activeDocuments.set(documentSession.localDocumentId, documentSession);

            return {
                success: true,
                documentId: documentSession.localDocumentId,
                googleDocId: googleDocId,
                editUrl: `https://docs.google.com/document/d/${googleDocId}/edit`,
                viewUrl: `https://docs.google.com/document/d/${googleDocId}/view`,
                sessionId: documentSession.id,
                collaborators: Array.from(documentSession.collaborators)
            };

        }, {
            operationName: 'createCollaborativeDocument',
            language: options.language || 'fr',
            context: {
                documentData,
                userId
            },
            fallback: async () => {
                // Enable local collaboration as fallback
                return await this.resilientService.enableLocalCollaboration(
                    documentData.id || uuidv4(),
                    userId
                );
            }
        });
    }

    /**
     * Join a collaborative editing session
     * @param {string} documentId - Document ID to join
     * @param {string} userId - User ID joining the session
     * @param {string} socketId - Socket ID for real-time communication
     * @returns {Promise<Object>} Session information
     */
    async joinCollaborativeSession(documentId, userId, socketId) {
        try {
            const documentSession = this.activeDocuments.get(documentId);

            if (!documentSession) {
                throw new Error('Document collaboratif non trouvé');
            }

            // Add user to collaborators
            documentSession.collaborators.add(userId);
            documentSession.lastActivity = new Date();

            // Create user session
            const userSessionId = uuidv4();
            this.documentSessions.set(userSessionId, {
                documentId: documentId,
                userId: userId,
                socketId: socketId,
                joinedAt: new Date()
            });

            return {
                success: true,
                sessionId: userSessionId,
                documentId: documentId,
                googleDocId: documentSession.googleDocId,
                editUrl: `https://docs.google.com/document/d/${documentSession.googleDocId}/edit`,
                collaborators: Array.from(documentSession.collaborators),
                title: documentSession.title
            };

        } catch (error) {
            console.error('Error joining collaborative session:', error);
            throw new Error(`Échec de la connexion à la session: ${error.message}`);
        }
    }

    /**
     * Leave a collaborative editing session
     * @param {string} sessionId - Session ID to leave
     * @param {string} userId - User ID leaving the session
     * @returns {Promise<Object>} Leave confirmation
     */
    async leaveCollaborativeSession(sessionId, userId) {
        try {
            const userSession = this.documentSessions.get(sessionId);

            if (!userSession || userSession.userId !== userId) {
                throw new Error('Session non trouvée ou utilisateur non autorisé');
            }

            const documentSession = this.activeDocuments.get(userSession.documentId);
            if (documentSession) {
                documentSession.collaborators.delete(userId);
                documentSession.lastActivity = new Date();
            }

            // Remove user session
            this.documentSessions.delete(sessionId);

            return {
                success: true,
                message: 'Session quittée avec succès',
                documentId: userSession.documentId,
                remainingCollaborators: documentSession ? Array.from(documentSession.collaborators) : []
            };

        } catch (error) {
            console.error('Error leaving collaborative session:', error);
            throw new Error(`Échec de la déconnexion: ${error.message}`);
        }
    }

    /**
     * Get document content with automatic save timestamp
     * @param {string} documentId - Document ID
     * @param {string} userId - User requesting the content
     * @returns {Promise<Object>} Document content and metadata
     */
    async getDocumentContent(documentId, userId) {
        try {
            const documentSession = this.activeDocuments.get(documentId);

            if (!documentSession) {
                throw new Error('Document non trouvé');
            }

            if (!documentSession.collaborators.has(userId)) {
                throw new Error('Accès non autorisé au document');
            }

            // Get content from Google Docs
            const response = await this.docs.documents.get({
                auth: this.auth,
                documentId: documentSession.googleDocId
            });

            // Extract text content
            let content = '';
            if (response.data.body && response.data.body.content) {
                response.data.body.content.forEach(element => {
                    if (element.paragraph && element.paragraph.elements) {
                        element.paragraph.elements.forEach(textElement => {
                            if (textElement.textRun && textElement.textRun.content) {
                                content += textElement.textRun.content;
                            }
                        });
                    }
                });
            }

            return {
                success: true,
                documentId: documentId,
                content: content,
                title: response.data.title,
                lastModified: new Date(),
                collaborators: Array.from(documentSession.collaborators),
                autoSaveEnabled: true
            };

        } catch (error) {
            console.error('Error getting document content:', error);
            throw new Error(`Échec de la récupération du contenu: ${error.message}`);
        }
    }

    /**
     * Update document content with automatic save
     * @param {string} documentId - Document ID
     * @param {string} content - New content
     * @param {string} userId - User making the update
     * @returns {Promise<Object>} Update confirmation
     */
    async updateDocumentContent(documentId, content, userId) {
        try {
            const documentSession = this.activeDocuments.get(documentId);

            if (!documentSession) {
                throw new Error('Document non trouvé');
            }

            if (!documentSession.collaborators.has(userId)) {
                throw new Error('Accès non autorisé au document');
            }

            // Clear existing content and insert new content
            const requests = [
                {
                    deleteContentRange: {
                        range: {
                            startIndex: 1,
                            endIndex: -1 // Delete all content except the first character
                        }
                    }
                },
                {
                    insertText: {
                        location: {
                            index: 1
                        },
                        text: content
                    }
                }
            ];

            await this.docs.documents.batchUpdate({
                auth: this.auth,
                documentId: documentSession.googleDocId,
                requestBody: {
                    requests: requests
                }
            });

            // Update session activity
            documentSession.lastActivity = new Date();

            return {
                success: true,
                documentId: documentId,
                message: 'Document mis à jour avec succès',
                timestamp: new Date(),
                updatedBy: userId,
                autoSaved: true
            };

        } catch (error) {
            console.error('Error updating document content:', error);
            throw new Error(`Échec de la mise à jour: ${error.message}`);
        }
    }

    /**
     * Get list of active collaborators for a document
     * @param {string} documentId - Document ID
     * @returns {Array} List of active collaborators
     */
    getActiveCollaborators(documentId) {
        const documentSession = this.activeDocuments.get(documentId);
        if (!documentSession) {
            return [];
        }

        const collaborators = [];
        for (const [sessionId, userSession] of this.documentSessions.entries()) {
            if (userSession.documentId === documentId) {
                collaborators.push({
                    userId: userSession.userId,
                    sessionId: sessionId,
                    joinedAt: userSession.joinedAt,
                    isActive: true
                });
            }
        }

        return collaborators;
    }

    /**
     * Send notification to all collaborators of a document
     * @param {string} documentId - Document ID
     * @param {Object} notification - Notification data
     * @param {string} excludeUserId - User ID to exclude from notification
     * @returns {Array} List of notified users
     */
    notifyCollaborators(documentId, notification, excludeUserId = null) {
        const notifiedUsers = [];

        for (const [sessionId, userSession] of this.documentSessions.entries()) {
            if (userSession.documentId === documentId && userSession.userId !== excludeUserId) {
                // In a real implementation, this would send via WebSocket
                // For now, we'll just track who should be notified
                notifiedUsers.push({
                    userId: userSession.userId,
                    sessionId: sessionId,
                    socketId: userSession.socketId,
                    notification: {
                        ...notification,
                        timestamp: new Date(),
                        documentId: documentId
                    }
                });
            }
        }

        return notifiedUsers;
    }

    /**
     * Clean up inactive sessions
     * @param {number} timeoutMinutes - Minutes of inactivity before cleanup
     */
    cleanupInactiveSessions(timeoutMinutes = 30) {
        const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);

        // Clean up document sessions
        for (const [documentId, documentSession] of this.activeDocuments.entries()) {
            if (documentSession.lastActivity < cutoffTime) {
                this.activeDocuments.delete(documentId);
                console.log(`Cleaned up inactive document session: ${documentId}`);
            }
        }

        // Clean up user sessions
        for (const [sessionId, userSession] of this.documentSessions.entries()) {
            if (userSession.joinedAt < cutoffTime) {
                this.documentSessions.delete(sessionId);
                console.log(`Cleaned up inactive user session: ${sessionId}`);
            }
        }
    }

    /**
     * Get document revision history
     * @param {string} documentId - Document ID
     * @returns {Promise<Array>} Revision history
     */
    async getDocumentHistory(documentId) {
        try {
            const documentSession = this.activeDocuments.get(documentId);

            if (!documentSession) {
                throw new Error('Document non trouvé');
            }

            // Get revisions from Google Drive
            const response = await this.drive.revisions.list({
                auth: this.auth,
                fileId: documentSession.googleDocId
            });

            const revisions = response.data.revisions || [];

            return revisions.map(revision => ({
                id: revision.id,
                modifiedTime: revision.modifiedTime,
                lastModifyingUser: revision.lastModifyingUser,
                size: revision.size
            }));

        } catch (error) {
            console.error('Error getting document history:', error);
            throw new Error(`Échec de la récupération de l'historique: ${error.message}`);
        }
    }
}

module.exports = CollaborativeService;