const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { validationSchemas, validateRequest } = require('../middleware/validation');
const CollaborativeService = require('../services/collaborativeService');

const router = express.Router();
const collaborativeService = new CollaborativeService();

// Create new collaborative document
router.post('/documents',
    validationSchemas.createCollaborativeDocument || [
        // Fallback validation if schema doesn't exist
        require('express-validator').body('title').optional().isString().trim(),
        require('express-validator').body('content').optional().isString(),
        require('express-validator').body('type').optional().isIn(['contract', 'agreement', 'document'])
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        try {
            const { title, content, type = 'document' } = req.body;

            const documentData = {
                id: require('uuid').v4(),
                title: title || `Document Collaboratif - ${new Date().toLocaleDateString('fr-FR')}`,
                content: content || '',
                type: type,
                createdBy: req.user.id
            };

            const result = await collaborativeService.createCollaborativeDocument(
                documentData,
                req.user.id
            );

            res.status(201).json({
                success: true,
                message: 'Document collaboratif créé avec succès',
                document: result
            });

        } catch (error) {
            console.error('Error creating collaborative document:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la création du document collaboratif',
                error: error.message
            });
        }
    })
);

// Join collaborative session
router.post('/documents/:documentId/join',
    validationSchemas.joinCollaborativeSession || [
        require('express-validator').param('documentId').isUUID()
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        try {
            const { documentId } = req.params;
            const { socketId } = req.body;

            const sessionInfo = await collaborativeService.joinCollaborativeSession(
                documentId,
                req.user.id,
                socketId || 'http-session'
            );

            res.json({
                success: true,
                message: 'Session collaborative rejointe avec succès',
                session: sessionInfo
            });

        } catch (error) {
            console.error('Error joining collaborative session:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la connexion à la session collaborative',
                error: error.message
            });
        }
    })
);

// Leave collaborative session
router.post('/sessions/:sessionId/leave',
    validationSchemas.leaveCollaborativeSession || [
        require('express-validator').param('sessionId').isUUID()
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        try {
            const { sessionId } = req.params;

            const result = await collaborativeService.leaveCollaborativeSession(
                sessionId,
                req.user.id
            );

            res.json({
                success: true,
                message: 'Session collaborative quittée avec succès',
                result: result
            });

        } catch (error) {
            console.error('Error leaving collaborative session:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la déconnexion de la session',
                error: error.message
            });
        }
    })
);

// Get document content
router.get('/documents/:documentId/content',
    validationSchemas.getDocumentContent || [
        require('express-validator').param('documentId').isUUID()
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        try {
            const { documentId } = req.params;

            const content = await collaborativeService.getDocumentContent(
                documentId,
                req.user.id
            );

            res.json({
                success: true,
                content: content
            });

        } catch (error) {
            console.error('Error getting document content:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération du contenu',
                error: error.message
            });
        }
    })
);

// Update document content
router.put('/documents/:documentId/content',
    validationSchemas.updateDocumentContent || [
        require('express-validator').param('documentId').isUUID(),
        require('express-validator').body('content').isString().notEmpty()
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        try {
            const { documentId } = req.params;
            const { content } = req.body;

            const result = await collaborativeService.updateDocumentContent(
                documentId,
                content,
                req.user.id
            );

            res.json({
                success: true,
                message: 'Document mis à jour avec succès',
                result: result
            });

        } catch (error) {
            console.error('Error updating document content:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la mise à jour du document',
                error: error.message
            });
        }
    })
);

// Get active collaborators
router.get('/documents/:documentId/collaborators',
    validationSchemas.getCollaborators || [
        require('express-validator').param('documentId').isUUID()
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        try {
            const { documentId } = req.params;

            const collaborators = collaborativeService.getActiveCollaborators(documentId);

            res.json({
                success: true,
                collaborators: collaborators,
                count: collaborators.length
            });

        } catch (error) {
            console.error('Error getting collaborators:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des collaborateurs',
                error: error.message
            });
        }
    })
);

// Send notification to collaborators
router.post('/documents/:documentId/notify',
    validationSchemas.notifyCollaborators || [
        require('express-validator').param('documentId').isUUID(),
        require('express-validator').body('message').isString().notEmpty(),
        require('express-validator').body('type').optional().isIn(['info', 'warning', 'success', 'error'])
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        try {
            const { documentId } = req.params;
            const { message, type = 'info', excludeSelf = true } = req.body;

            const notification = {
                message: message,
                type: type,
                from: req.user.email || req.user.id,
                timestamp: new Date()
            };

            const notifiedUsers = collaborativeService.notifyCollaborators(
                documentId,
                notification,
                excludeSelf ? req.user.id : null
            );

            res.json({
                success: true,
                message: 'Notification envoyée aux collaborateurs',
                notifiedUsers: notifiedUsers.length,
                details: notifiedUsers
            });

        } catch (error) {
            console.error('Error sending notification:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'envoi de la notification',
                error: error.message
            });
        }
    })
);

// Get document revision history
router.get('/documents/:documentId/history',
    validationSchemas.getDocumentHistory || [
        require('express-validator').param('documentId').isUUID()
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        try {
            const { documentId } = req.params;

            const history = await collaborativeService.getDocumentHistory(documentId);

            res.json({
                success: true,
                history: history,
                count: history.length
            });

        } catch (error) {
            console.error('Error getting document history:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération de l\'historique',
                error: error.message
            });
        }
    })
);

// Auto-save endpoint for manual triggers
router.post('/documents/:documentId/auto-save',
    validationSchemas.autoSaveDocument || [
        require('express-validator').param('documentId').isUUID(),
        require('express-validator').body('content').isString().notEmpty()
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        try {
            const { documentId } = req.params;
            const { content } = req.body;

            const result = await collaborativeService.updateDocumentContent(
                documentId,
                content,
                req.user.id
            );

            // Send notification to other collaborators
            const notification = {
                message: `Document sauvegardé automatiquement par ${req.user.email || req.user.id}`,
                type: 'info',
                autoSave: true
            };

            collaborativeService.notifyCollaborators(
                documentId,
                notification,
                req.user.id
            );

            res.json({
                success: true,
                message: 'Sauvegarde automatique effectuée',
                result: result,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('Error auto-saving document:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la sauvegarde automatique',
                error: error.message
            });
        }
    })
);

// Health check for collaborative service
router.get('/health',
    asyncHandler(async (req, res) => {
        try {
            // Basic health check
            const stats = {
                service: 'collaborative-editing',
                status: 'healthy',
                timestamp: new Date(),
                features: {
                    googleDocsIntegration: !!process.env.GOOGLE_CLIENT_ID,
                    realTimeSync: true,
                    autoSave: true,
                    notifications: true
                }
            };

            res.json({
                success: true,
                health: stats
            });

        } catch (error) {
            console.error('Collaborative service health check error:', error);
            res.status(500).json({
                success: false,
                message: 'Service de collaboration indisponible',
                error: error.message
            });
        }
    })
);

module.exports = router;