const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireRole } = require('../middleware/auth');
const DashboardService = require('../services/dashboardService');
const axios = require('axios');

const router = express.Router();
const dashboardService = new DashboardService();

// Get user dashboard with comprehensive analytics
// Requirement 5.1: Display all documents associated with a user
// Requirement 5.2: Indicate status of each contract
router.get('/dashboard',
    asyncHandler(async (req, res) => {
        try {
            const userId = req.user.id;
            const dashboardData = await dashboardService.getUserDashboard(userId);

            if (!dashboardData.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Erreur lors de la récupération du tableau de bord',
                    error: dashboardData.error
                });
            }

            res.json({
                success: true,
                message: 'Tableau de bord récupéré avec succès',
                data: dashboardData.data
            });

        } catch (error) {
            console.error('Dashboard analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur interne du serveur',
                error: error.message
            });
        }
    })
);

// Get user notifications
// Requirement 5.3: Notify user when document status changes
router.get('/notifications',
    asyncHandler(async (req, res) => {
        try {
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 20;

            const notifications = await dashboardService.getUserNotifications(userId, limit);

            if (!notifications.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Erreur lors de la récupération des notifications',
                    error: notifications.error
                });
            }

            res.json({
                success: true,
                message: 'Notifications récupérées avec succès',
                data: notifications.data
            });

        } catch (error) {
            console.error('Notifications error:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur interne du serveur',
                error: error.message
            });
        }
    })
);

// Mark notification as read
router.put('/notifications/:id/read',
    asyncHandler(async (req, res) => {
        try {
            const userId = req.user.id;
            const notificationId = req.params.id;

            const result = await dashboardService.markNotificationRead(notificationId, userId);

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Erreur lors de la mise à jour de la notification',
                    error: result.error
                });
            }

            res.json({
                success: true,
                message: 'Notification marquée comme lue',
                data: result.data
            });

        } catch (error) {
            console.error('Mark notification read error:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur interne du serveur',
                error: error.message
            });
        }
    })
);

// Update document status
// Requirement 5.3: Notify user when document status changes
router.put('/documents/:id/status',
    asyncHandler(async (req, res) => {
        try {
            const userId = req.user.id;
            const documentId = req.params.id;
            const { status } = req.body;

            // Validate status
            const validStatuses = ['draft', 'in_review', 'pending_signature', 'signed', 'archived', 'cancelled'];
            if (!status || !validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Statut invalide. Statuts valides: ' + validStatuses.join(', ')
                });
            }

            const result = await dashboardService.updateDocumentStatus(documentId, status, userId);

            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Erreur lors de la mise à jour du statut',
                    error: result.error
                });
            }

            res.json({
                success: true,
                message: result.message,
                data: result.data
            });

        } catch (error) {
            console.error('Status update error:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur interne du serveur',
                error: error.message
            });
        }
    })
);

// Get detailed analytics from DuckDB
// Requirement 5.4: Use DuckDB for statistics and analytics
router.get('/detailed',
    asyncHandler(async (req, res) => {
        try {
            const userId = req.user.id;
            const analyticsServiceUrl = process.env.ANALYTICS_SERVICE_URL || 'http://analytics:8000';

            // Get detailed analytics from DuckDB service
            const analyticsResponse = await axios.get(
                `${analyticsServiceUrl}/analytics/user/${userId}`,
                { timeout: 10000 }
            );

            res.json({
                success: true,
                message: 'Analytics détaillées récupérées avec succès',
                data: analyticsResponse.data
            });

        } catch (error) {
            console.error('Detailed analytics error:', error);

            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                return res.status(503).json({
                    success: false,
                    message: 'Service d\'analytics temporairement indisponible',
                    error: 'Analytics service unavailable'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des analytics',
                error: error.message
            });
        }
    })
);

// Get system analytics (admin only)
// Requirement 5.4: Use DuckDB for statistics and analytics
router.get('/system',
    requireRole(['admin']),
    asyncHandler(async (req, res) => {
        try {
            const analyticsServiceUrl = process.env.ANALYTICS_SERVICE_URL || 'http://analytics:8000';

            // Get system-wide analytics from DuckDB service
            const analyticsResponse = await axios.get(
                `${analyticsServiceUrl}/analytics/system`,
                { timeout: 10000 }
            );

            res.json({
                success: true,
                message: 'Analytics système récupérées avec succès',
                data: analyticsResponse.data
            });

        } catch (error) {
            console.error('System analytics error:', error);

            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                return res.status(503).json({
                    success: false,
                    message: 'Service d\'analytics temporairement indisponible',
                    error: 'Analytics service unavailable'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des analytics système',
                error: error.message
            });
        }
    })
);

// Record custom analytics event
router.post('/events',
    asyncHandler(async (req, res) => {
        try {
            const userId = req.user.id;
            const { eventType, documentId, metadata } = req.body;

            if (!eventType) {
                return res.status(400).json({
                    success: false,
                    message: 'Type d\'événement requis'
                });
            }

            await dashboardService.recordAnalyticsEvent(userId, documentId, eventType, metadata);

            res.json({
                success: true,
                message: 'Événement enregistré avec succès'
            });

        } catch (error) {
            console.error('Record event error:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'enregistrement de l\'événement',
                error: error.message
            });
        }
    })
);

module.exports = router;