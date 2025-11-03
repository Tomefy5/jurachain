const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const CollaborativeService = require('./collaborativeService');

class WebSocketService {
    constructor(server) {
        this.io = new Server(server, {
            cors: {
                origin: process.env.CORS_ORIGIN || "http://localhost:3000",
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });

        this.collaborativeService = new CollaborativeService();
        this.connectedUsers = new Map(); // socketId -> { userId, documentId, sessionId }
        this.documentRooms = new Map(); // documentId -> Set of socketIds

        this.setupMiddleware();
        this.setupEventHandlers();
        this.startCleanupInterval();
    }

    /**
     * Setup authentication middleware for WebSocket connections
     */
    setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

                if (!token) {
                    return next(new Error('Token d\'authentification requis'));
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                socket.userId = decoded.id;
                socket.userEmail = decoded.email;

                console.log(`WebSocket authenticated: ${socket.userEmail} (${socket.userId})`);
                next();
            } catch (error) {
                console.error('WebSocket authentication error:', error);
                next(new Error('Token d\'authentification invalide'));
            }
        });
    }

    /**
     * Setup WebSocket event handlers
     */
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`WebSocket connected: ${socket.userEmail} (${socket.id})`);

            // Join document collaboration
            socket.on('join-document', async (data) => {
                try {
                    const { documentId } = data;

                    if (!documentId) {
                        socket.emit('error', { message: 'ID de document requis' });
                        return;
                    }

                    // Join collaborative session
                    const sessionInfo = await this.collaborativeService.joinCollaborativeSession(
                        documentId,
                        socket.userId,
                        socket.id
                    );

                    // Join socket room
                    socket.join(`document-${documentId}`);

                    // Track connection
                    this.connectedUsers.set(socket.id, {
                        userId: socket.userId,
                        userEmail: socket.userEmail,
                        documentId: documentId,
                        sessionId: sessionInfo.sessionId,
                        joinedAt: new Date()
                    });

                    // Track document room
                    if (!this.documentRooms.has(documentId)) {
                        this.documentRooms.set(documentId, new Set());
                    }
                    this.documentRooms.get(documentId).add(socket.id);

                    // Notify user of successful join
                    socket.emit('document-joined', {
                        success: true,
                        documentId: documentId,
                        sessionId: sessionInfo.sessionId,
                        collaborators: sessionInfo.collaborators,
                        editUrl: sessionInfo.editUrl
                    });

                    // Notify other collaborators
                    socket.to(`document-${documentId}`).emit('collaborator-joined', {
                        userId: socket.userId,
                        userEmail: socket.userEmail,
                        timestamp: new Date(),
                        totalCollaborators: sessionInfo.collaborators.length
                    });

                    console.log(`User ${socket.userEmail} joined document ${documentId}`);

                } catch (error) {
                    console.error('Error joining document:', error);
                    socket.emit('error', {
                        message: 'Échec de la connexion au document',
                        error: error.message
                    });
                }
            });

            // Leave document collaboration
            socket.on('leave-document', async (data) => {
                try {
                    const userConnection = this.connectedUsers.get(socket.id);

                    if (!userConnection) {
                        socket.emit('error', { message: 'Aucune session active trouvée' });
                        return;
                    }

                    await this.handleUserDisconnection(socket, userConnection);

                    socket.emit('document-left', {
                        success: true,
                        message: 'Document quitté avec succès'
                    });

                } catch (error) {
                    console.error('Error leaving document:', error);
                    socket.emit('error', {
                        message: 'Erreur lors de la déconnexion',
                        error: error.message
                    });
                }
            });

            // Real-time content synchronization
            socket.on('content-change', async (data) => {
                try {
                    const userConnection = this.connectedUsers.get(socket.id);

                    if (!userConnection) {
                        socket.emit('error', { message: 'Session non trouvée' });
                        return;
                    }

                    const { content, changeType, position } = data;

                    // Broadcast change to other collaborators in real-time
                    socket.to(`document-${userConnection.documentId}`).emit('content-updated', {
                        userId: socket.userId,
                        userEmail: socket.userEmail,
                        content: content,
                        changeType: changeType,
                        position: position,
                        timestamp: new Date()
                    });

                    // Auto-save with timestamp (debounced in real implementation)
                    this.scheduleAutoSave(userConnection.documentId, content, socket.userId);

                } catch (error) {
                    console.error('Error handling content change:', error);
                    socket.emit('error', {
                        message: 'Erreur de synchronisation',
                        error: error.message
                    });
                }
            });

            // Cursor position tracking
            socket.on('cursor-position', (data) => {
                try {
                    const userConnection = this.connectedUsers.get(socket.id);

                    if (!userConnection) {
                        return;
                    }

                    const { position, selection } = data;

                    // Broadcast cursor position to other collaborators
                    socket.to(`document-${userConnection.documentId}`).emit('cursor-updated', {
                        userId: socket.userId,
                        userEmail: socket.userEmail,
                        position: position,
                        selection: selection,
                        timestamp: new Date()
                    });

                } catch (error) {
                    console.error('Error handling cursor position:', error);
                }
            });

            // Manual save request
            socket.on('save-document', async (data) => {
                try {
                    const userConnection = this.connectedUsers.get(socket.id);

                    if (!userConnection) {
                        socket.emit('error', { message: 'Session non trouvée' });
                        return;
                    }

                    const { content } = data;

                    const saveResult = await this.collaborativeService.updateDocumentContent(
                        userConnection.documentId,
                        content,
                        socket.userId
                    );

                    // Notify user of successful save
                    socket.emit('document-saved', {
                        success: true,
                        timestamp: saveResult.timestamp,
                        message: 'Document sauvegardé avec succès'
                    });

                    // Notify other collaborators
                    socket.to(`document-${userConnection.documentId}`).emit('document-auto-saved', {
                        savedBy: socket.userEmail,
                        timestamp: saveResult.timestamp
                    });

                } catch (error) {
                    console.error('Error saving document:', error);
                    socket.emit('error', {
                        message: 'Erreur lors de la sauvegarde',
                        error: error.message
                    });
                }
            });

            // Get document content
            socket.on('get-document-content', async (data) => {
                try {
                    const userConnection = this.connectedUsers.get(socket.id);

                    if (!userConnection) {
                        socket.emit('error', { message: 'Session non trouvée' });
                        return;
                    }

                    const documentContent = await this.collaborativeService.getDocumentContent(
                        userConnection.documentId,
                        socket.userId
                    );

                    socket.emit('document-content', documentContent);

                } catch (error) {
                    console.error('Error getting document content:', error);
                    socket.emit('error', {
                        message: 'Erreur lors de la récupération du contenu',
                        error: error.message
                    });
                }
            });

            // Handle disconnection
            socket.on('disconnect', async (reason) => {
                console.log(`WebSocket disconnected: ${socket.userEmail} (${reason})`);

                const userConnection = this.connectedUsers.get(socket.id);
                if (userConnection) {
                    await this.handleUserDisconnection(socket, userConnection);
                }
            });

            // Ping/pong for connection health
            socket.on('ping', () => {
                socket.emit('pong', { timestamp: new Date() });
            });
        });
    }

    /**
     * Handle user disconnection from collaborative session
     */
    async handleUserDisconnection(socket, userConnection) {
        try {
            // Leave collaborative session
            await this.collaborativeService.leaveCollaborativeSession(
                userConnection.sessionId,
                socket.userId
            );

            // Leave socket room
            socket.leave(`document-${userConnection.documentId}`);

            // Remove from tracking
            this.connectedUsers.delete(socket.id);

            const documentRoom = this.documentRooms.get(userConnection.documentId);
            if (documentRoom) {
                documentRoom.delete(socket.id);
                if (documentRoom.size === 0) {
                    this.documentRooms.delete(userConnection.documentId);
                }
            }

            // Notify remaining collaborators
            socket.to(`document-${userConnection.documentId}`).emit('collaborator-left', {
                userId: socket.userId,
                userEmail: socket.userEmail,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('Error handling user disconnection:', error);
        }
    }

    /**
     * Schedule auto-save with debouncing
     */
    scheduleAutoSave(documentId, content, userId) {
        // Clear existing timeout for this document
        if (this.autoSaveTimeouts && this.autoSaveTimeouts.has(documentId)) {
            clearTimeout(this.autoSaveTimeouts.get(documentId));
        }

        if (!this.autoSaveTimeouts) {
            this.autoSaveTimeouts = new Map();
        }

        // Schedule new auto-save after 2 seconds of inactivity
        const timeoutId = setTimeout(async () => {
            try {
                await this.collaborativeService.updateDocumentContent(documentId, content, userId);

                // Notify all collaborators of auto-save
                this.io.to(`document-${documentId}`).emit('document-auto-saved', {
                    timestamp: new Date(),
                    message: 'Document sauvegardé automatiquement'
                });

                this.autoSaveTimeouts.delete(documentId);
            } catch (error) {
                console.error('Auto-save error:', error);
            }
        }, 2000);

        this.autoSaveTimeouts.set(documentId, timeoutId);
    }

    /**
     * Start cleanup interval for inactive sessions
     */
    startCleanupInterval() {
        // Clean up every 10 minutes
        setInterval(() => {
            this.collaborativeService.cleanupInactiveSessions(30);
        }, 10 * 60 * 1000);
    }

    /**
     * Send notification to specific user
     */
    sendNotificationToUser(userId, notification) {
        for (const [socketId, userConnection] of this.connectedUsers.entries()) {
            if (userConnection.userId === userId) {
                this.io.to(socketId).emit('notification', {
                    ...notification,
                    timestamp: new Date()
                });
            }
        }
    }

    /**
     * Send notification to all collaborators of a document
     */
    sendNotificationToDocument(documentId, notification, excludeUserId = null) {
        const room = this.documentRooms.get(documentId);
        if (!room) return;

        for (const socketId of room) {
            const userConnection = this.connectedUsers.get(socketId);
            if (userConnection && userConnection.userId !== excludeUserId) {
                this.io.to(socketId).emit('notification', {
                    ...notification,
                    timestamp: new Date(),
                    documentId: documentId
                });
            }
        }
    }

    /**
     * Get statistics about active connections
     */
    getConnectionStats() {
        const documentStats = new Map();

        for (const [documentId, socketIds] of this.documentRooms.entries()) {
            const users = [];
            for (const socketId of socketIds) {
                const userConnection = this.connectedUsers.get(socketId);
                if (userConnection) {
                    users.push({
                        userId: userConnection.userId,
                        userEmail: userConnection.userEmail,
                        joinedAt: userConnection.joinedAt
                    });
                }
            }
            documentStats.set(documentId, {
                activeUsers: users.length,
                users: users
            });
        }

        return {
            totalConnections: this.connectedUsers.size,
            activeDocuments: this.documentRooms.size,
            documentStats: Object.fromEntries(documentStats)
        };
    }
}

module.exports = WebSocketService;