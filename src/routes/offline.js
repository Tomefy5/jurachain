/**
 * Offline functionality routes
 * Handles offline document generation, synchronization, and local storage management
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const OfflineStorageService = require('../services/offlineStorageService');
const SynchronizationService = require('../services/synchronizationService');
const OfflineDocumentGeneratorService = require('../services/offlineDocumentGenerator');
const SyncQueueService = require('../services/syncQueueService');

const router = express.Router();

// Initialize services
const offlineStorage = new OfflineStorageService();
const syncService = new SynchronizationService();
const offlineGenerator = new OfflineDocumentGeneratorService();
const syncQueue = new SyncQueueService();

/**
 * Generate document offline
 */
router.post('/generate-document', [
    body('type').isIn(['contract', 'lease', 'sale_agreement', 'employment_contract', 'service_agreement', 'partnership_agreement', 'non_disclosure_agreement', 'power_of_attorney', 'other']),
    body('language').isIn(['fr', 'mg', 'en']),
    body('description').isLength({ min: 5, max: 1000 }),
    body('parties').isArray({ min: 1 }),
    body('jurisdiction').notEmpty(),
    body('specificClauses').optional().isArray()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const contractRequest = {
            type: req.body.type,
            language: req.body.language,
            description: req.body.description,
            parties: req.body.parties,
            jurisdiction: req.body.jurisdiction,
            specificClauses: req.body.specificClauses || []
        };

        const document = await offlineGenerator.generateDocumentOffline(contractRequest);

        // Queue for synchronization when online
        await syncQueue.enqueueAction({
            type: 'create_document',
            documentId: document.id,
            data: document,
            priority: syncQueue.priorities.MEDIUM
        });

        res.json({
            success: true,
            document,
            message: 'Document généré hors ligne avec succès'
        });

    } catch (error) {
        console.error('Offline document generation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get offline capabilities
 */
router.get('/capabilities', async (req, res) => {
    try {
        const capabilities = await offlineGenerator.getOfflineCapabilities();
        const storageStats = await offlineStorage.getStorageStats();
        const syncStatus = await syncService.getSyncStatus();

        res.json({
            success: true,
            capabilities,
            storage: storageStats,
            sync: syncStatus
        });

    } catch (error) {
        console.error('Error getting offline capabilities:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get local documents
 */
router.get('/documents', [
    query('status').optional().isIn(['draft', 'in_review', 'pending_signature', 'signed', 'archived', 'cancelled']),
    query('type').optional().isIn(['contract', 'lease', 'sale_agreement', 'employment_contract', 'service_agreement', 'partnership_agreement', 'non_disclosure_agreement', 'power_of_attorney', 'other']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const filters = {};
        if (req.query.status) filters.status = req.query.status;
        if (req.query.type) filters.type = req.query.type;

        const documents = await offlineStorage.getAllDocuments(filters);

        // Apply pagination
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const paginatedDocuments = documents.slice(offset, offset + limit);

        res.json({
            success: true,
            documents: paginatedDocuments,
            total: documents.length,
            limit,
            offset
        });

    } catch (error) {
        console.error('Error getting local documents:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get specific local document
 */
router.get('/documents/:id', [
    param('id').isUUID()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const document = await offlineStorage.getDocument(req.params.id);

        if (!document) {
            return res.status(404).json({
                success: false,
                error: 'Document non trouvé dans le stockage local'
            });
        }

        res.json({
            success: true,
            document
        });

    } catch (error) {
        console.error('Error getting local document:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Update local document
 */
router.put('/documents/:id', [
    param('id').isUUID(),
    body('title').optional().isLength({ min: 1, max: 200 }),
    body('content').optional().isLength({ min: 1 }),
    body('status').optional().isIn(['draft', 'in_review', 'pending_signature', 'signed', 'archived', 'cancelled']),
    body('parties').optional().isArray(),
    body('clauses').optional().isArray()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const updates = {
            ...req.body,
            updatedAt: new Date()
        };

        const success = await offlineStorage.updateDocument(req.params.id, updates);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Document non trouvé ou échec de mise à jour'
            });
        }

        // Queue update for synchronization
        await syncQueue.enqueueAction({
            type: 'update_document',
            documentId: req.params.id,
            data: updates,
            priority: syncQueue.priorities.HIGH
        });

        res.json({
            success: true,
            message: 'Document mis à jour localement'
        });

    } catch (error) {
        console.error('Error updating local document:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Delete local document
 */
router.delete('/documents/:id', [
    param('id').isUUID()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const success = await offlineStorage.deleteDocument(req.params.id);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Document non trouvé'
            });
        }

        // Queue deletion for synchronization
        await syncQueue.enqueueAction({
            type: 'delete_document',
            documentId: req.params.id,
            data: {},
            priority: syncQueue.priorities.HIGH
        });

        res.json({
            success: true,
            message: 'Document supprimé localement'
        });

    } catch (error) {
        console.error('Error deleting local document:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Force synchronization
 */
router.post('/sync', async (req, res) => {
    try {
        const result = await syncService.forcSync();

        res.json({
            success: result.success,
            ...result
        });

    } catch (error) {
        console.error('Error forcing synchronization:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get synchronization status
 */
router.get('/sync/status', async (req, res) => {
    try {
        const syncStatus = await syncService.getSyncStatus();
        const queueStats = await syncQueue.getQueueStats();

        res.json({
            success: true,
            sync: syncStatus,
            queue: queueStats
        });

    } catch (error) {
        console.error('Error getting sync status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get sync queue actions
 */
router.get('/sync/queue', [
    query('status').optional().isIn(['pending', 'retrying', 'completed', 'failed']),
    query('type').optional().isIn(['create_document', 'update_document', 'delete_document', 'sign_document']),
    query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const filters = {};
        if (req.query.status) filters.status = req.query.status;
        if (req.query.type) filters.type = req.query.type;

        let actions = await syncQueue.getPendingActions(filters);

        // Apply limit
        const limit = parseInt(req.query.limit) || 50;
        actions = actions.slice(0, limit);

        res.json({
            success: true,
            actions,
            total: actions.length
        });

    } catch (error) {
        console.error('Error getting sync queue:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Retry failed sync action
 */
router.post('/sync/retry/:actionId', [
    param('actionId').isUUID()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const action = await syncQueue.getActionById(req.params.actionId);

        if (!action) {
            return res.status(404).json({
                success: false,
                error: 'Action non trouvée'
            });
        }

        if (action.status !== 'failed') {
            return res.status(400).json({
                success: false,
                error: 'Seules les actions échouées peuvent être relancées'
            });
        }

        // Reset action for retry
        action.status = 'pending';
        action.retries = 0;
        action.scheduledFor = new Date().toISOString();
        delete action.failedAt;
        delete action.lastError;

        await syncQueue.updateAction(action);

        res.json({
            success: true,
            message: 'Action programmée pour nouvelle tentative'
        });

    } catch (error) {
        console.error('Error retrying sync action:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get storage statistics
 */
router.get('/storage/stats', async (req, res) => {
    try {
        const stats = await offlineStorage.getStorageStats();

        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('Error getting storage stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Clear local storage
 */
router.delete('/storage/clear', [
    body('confirm').equals('DELETE_ALL_DATA')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array(),
                message: 'Confirmation requise: { "confirm": "DELETE_ALL_DATA" }'
            });
        }

        const success = await offlineStorage.clearAllData();

        if (success) {
            res.json({
                success: true,
                message: 'Toutes les données locales ont été supprimées'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Échec de la suppression des données'
            });
        }

    } catch (error) {
        console.error('Error clearing storage:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Store user preferences
 */
router.post('/preferences', [
    body('language').optional().isIn(['fr', 'mg', 'en']),
    body('notifications').optional().isBoolean(),
    body('autoSync').optional().isBoolean(),
    body('syncInterval').optional().isInt({ min: 10000, max: 300000 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const userId = req.user?.id || 'anonymous';
        const preferences = req.body;

        const success = await offlineStorage.storeUserPreferences(userId, preferences);

        if (success) {
            res.json({
                success: true,
                message: 'Préférences sauvegardées localement'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Échec de la sauvegarde des préférences'
            });
        }

    } catch (error) {
        console.error('Error storing preferences:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get user preferences
 */
router.get('/preferences', async (req, res) => {
    try {
        const userId = req.user?.id || 'anonymous';
        const preferences = await offlineStorage.getUserPreferences(userId);

        res.json({
            success: true,
            preferences: preferences || {}
        });

    } catch (error) {
        console.error('Error getting preferences:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Cleanup old data
 */
router.post('/cleanup', [
    body('daysOld').optional().isInt({ min: 1, max: 365 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const daysOld = req.body.daysOld || 7;

        const syncCleanup = await syncService.cleanup(daysOld);
        const queueCleanup = await syncQueue.cleanupOldActions(daysOld);

        res.json({
            success: true,
            message: 'Nettoyage terminé',
            results: {
                sync: syncCleanup,
                queue: queueCleanup
            }
        });

    } catch (error) {
        console.error('Error during cleanup:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;