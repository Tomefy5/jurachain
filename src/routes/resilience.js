/**
 * Resilience and Error Handling API Routes
 * Provides endpoints for monitoring system health, error statistics, and resilience status
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * GET /api/resilience/health
 * Get comprehensive system health status
 */
router.get('/health', asyncHandler(async (req, res) => {
    const resilienceManager = req.app.get('resilienceManager');

    if (!resilienceManager) {
        return res.status(503).json({
            error: 'Resilience manager not initialized',
            timestamp: new Date()
        });
    }

    const healthStatus = await resilienceManager.getSystemHealth();

    res.json({
        success: true,
        data: healthStatus,
        timestamp: new Date()
    });
}));

/**
 * GET /api/resilience/services
 * Get status of all registered services
 */
router.get('/services', asyncHandler(async (req, res) => {
    const resilienceManager = req.app.get('resilienceManager');

    if (!resilienceManager) {
        return res.status(503).json({
            error: 'Resilience manager not initialized'
        });
    }

    const services = resilienceManager.getAllServices();
    const serviceStatuses = {};

    for (const serviceName of services) {
        const service = resilienceManager.getService(serviceName);
        serviceStatuses[serviceName] = service.getHealthStatus();
    }

    res.json({
        success: true,
        data: {
            services: serviceStatuses,
            totalServices: services.length,
            timestamp: new Date()
        }
    });
}));

/**
 * GET /api/resilience/circuit-breakers
 * Get circuit breaker states for all services
 */
router.get('/circuit-breakers', asyncHandler(async (req, res) => {
    const resilienceManager = req.app.get('resilienceManager');

    if (!resilienceManager) {
        return res.status(503).json({
            error: 'Resilience manager not initialized'
        });
    }

    const services = resilienceManager.getAllServices();
    const circuitBreakers = {};

    for (const serviceName of services) {
        const service = resilienceManager.getService(serviceName);
        const healthStatus = service.getHealthStatus();
        circuitBreakers[serviceName] = healthStatus.circuitBreaker;
    }

    res.json({
        success: true,
        data: {
            circuitBreakers,
            timestamp: new Date()
        }
    });
}));

/**
 * POST /api/resilience/circuit-breakers/:service/reset
 * Reset circuit breaker for a specific service (admin only)
 */
router.post('/circuit-breakers/:service/reset', authMiddleware, asyncHandler(async (req, res) => {
    // Check if user has admin privileges
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Admin privileges required'
        });
    }

    const { service } = req.params;
    const resilienceManager = req.app.get('resilienceManager');

    if (!resilienceManager) {
        return res.status(503).json({
            error: 'Resilience manager not initialized'
        });
    }

    const serviceInstance = resilienceManager.getService(service);
    if (!serviceInstance) {
        return res.status(404).json({
            error: `Service ${service} not found`
        });
    }

    serviceInstance.resetCircuitBreaker();

    res.json({
        success: true,
        message: `Circuit breaker reset for service: ${service}`,
        timestamp: new Date()
    });
}));

/**
 * GET /api/resilience/error-stats
 * Get error statistics and patterns
 */
router.get('/error-stats', authMiddleware, asyncHandler(async (req, res) => {
    const monitoringService = req.app.get('monitoringService');

    if (!monitoringService) {
        return res.status(503).json({
            error: 'Monitoring service not available'
        });
    }

    // Get error statistics from monitoring service
    const errorStats = await monitoringService.getErrorStatistics();

    res.json({
        success: true,
        data: errorStats,
        timestamp: new Date()
    });
}));

/**
 * GET /api/resilience/network-health
 * Get network connectivity health status
 */
router.get('/network-health', asyncHandler(async (req, res) => {
    const NetworkErrorHandler = require('../utils/networkErrorHandler');
    const networkHandler = new NetworkErrorHandler();

    // Test connectivity to key services
    const testUrls = [
        'https://api.gemini.google.com',
        'https://testnet.hedera.com',
        'https://rpc-mumbai.maticvigil.com',
        'https://docs.google.com'
    ].filter(url => url); // Filter out undefined URLs

    const networkHealth = await networkHandler.monitorNetworkHealth(testUrls);

    res.json({
        success: true,
        data: networkHealth,
        timestamp: new Date()
    });
}));

/**
 * POST /api/resilience/degradation
 * Manually trigger system degradation handling (admin only)
 */
router.post('/degradation', authMiddleware, asyncHandler(async (req, res) => {
    // Check if user has admin privileges
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Admin privileges required'
        });
    }

    const { level } = req.body;
    const validLevels = ['light', 'moderate', 'severe'];

    if (!level || !validLevels.includes(level)) {
        return res.status(400).json({
            error: 'Invalid degradation level. Must be one of: light, moderate, severe'
        });
    }

    const resilienceManager = req.app.get('resilienceManager');

    if (!resilienceManager) {
        return res.status(503).json({
            error: 'Resilience manager not initialized'
        });
    }

    await resilienceManager.handleSystemDegradation(level);

    res.json({
        success: true,
        message: `System degradation level set to: ${level}`,
        timestamp: new Date()
    });
}));

/**
 * POST /api/resilience/recovery
 * Trigger system recovery from degradation (admin only)
 */
router.post('/recovery', authMiddleware, asyncHandler(async (req, res) => {
    // Check if user has admin privileges
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Admin privileges required'
        });
    }

    const resilienceManager = req.app.get('resilienceManager');

    if (!resilienceManager) {
        return res.status(503).json({
            error: 'Resilience manager not initialized'
        });
    }

    await resilienceManager.recoverFromDegradation();

    res.json({
        success: true,
        message: 'System recovery initiated',
        timestamp: new Date()
    });
}));

/**
 * GET /api/resilience/recommendations
 * Get system health recommendations
 */
router.get('/recommendations', authMiddleware, asyncHandler(async (req, res) => {
    const resilienceManager = req.app.get('resilienceManager');
    const NetworkErrorHandler = require('../utils/networkErrorHandler');

    if (!resilienceManager) {
        return res.status(503).json({
            error: 'Resilience manager not initialized'
        });
    }

    const systemHealth = await resilienceManager.getSystemHealth();
    const networkHandler = new NetworkErrorHandler();
    const networkRecommendations = networkHandler.getErrorHandlingRecommendations();

    const recommendations = [];

    // System-level recommendations
    if (systemHealth.overall.healthPercentage < 50) {
        recommendations.push({
            type: 'critical',
            category: 'system',
            message: 'Santé système critique - intervention immédiate requise',
            actions: [
                'Vérifiez les logs système',
                'Redémarrez les services défaillants',
                'Contactez l\'équipe technique'
            ]
        });
    } else if (systemHealth.overall.healthPercentage < 80) {
        recommendations.push({
            type: 'warning',
            category: 'system',
            message: 'Santé système dégradée - surveillance renforcée recommandée',
            actions: [
                'Surveillez les métriques de performance',
                'Préparez les procédures de basculement',
                'Vérifiez les ressources système'
            ]
        });
    }

    // Active operations recommendations
    const operationLoad = systemHealth.overall.activeOperations / systemHealth.overall.maxConcurrentOperations;
    if (operationLoad > 0.8) {
        recommendations.push({
            type: 'warning',
            category: 'performance',
            message: 'Charge système élevée détectée',
            actions: [
                'Limitez les opérations non essentielles',
                'Augmentez la capacité si possible',
                'Surveillez les temps de réponse'
            ]
        });
    }

    // Service-specific recommendations
    for (const [serviceName, serviceStatus] of Object.entries(systemHealth.services)) {
        if (serviceStatus.status === 'unhealthy') {
            recommendations.push({
                type: 'critical',
                category: 'service',
                service: serviceName,
                message: `Service ${serviceName} indisponible`,
                actions: [
                    'Vérifiez la configuration du service',
                    'Consultez les logs d\'erreur',
                    'Redémarrez le service si nécessaire'
                ]
            });
        } else if (serviceStatus.status === 'degraded') {
            recommendations.push({
                type: 'warning',
                category: 'service',
                service: serviceName,
                message: `Service ${serviceName} en mode dégradé`,
                actions: [
                    'Surveillez les performances',
                    'Préparez les services de secours',
                    'Vérifiez les dépendances externes'
                ]
            });
        }
    }

    // Add network recommendations
    recommendations.push(...networkRecommendations.map(rec => ({
        ...rec,
        category: 'network'
    })));

    res.json({
        success: true,
        data: {
            recommendations,
            systemHealth: systemHealth.overall,
            generatedAt: new Date()
        }
    });
}));

/**
 * GET /api/resilience/test-error
 * Test error handling (development only)
 */
router.get('/test-error', asyncHandler(async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
            error: 'Test endpoints not available in production'
        });
    }

    const { type = 'generic', service } = req.query;

    // Simulate different types of errors for testing
    switch (type) {
        case 'network':
            const networkError = new Error('Connection timeout');
            networkError.code = 'ETIMEDOUT';
            throw networkError;

        case 'validation':
            const validationError = new Error('Invalid input data');
            validationError.name = 'ValidationError';
            validationError.details = { field: 'email', message: 'Invalid email format' };
            throw validationError;

        case 'auth':
            const authError = new Error('Token expired');
            authError.name = 'TokenExpiredError';
            throw authError;

        case 'service':
            const serviceError = new Error('AI service unavailable');
            serviceError.serviceError = true;
            serviceError.serviceName = service || 'documentGenerator';
            throw serviceError;

        default:
            throw new Error('Test error for resilience system');
    }
}));

module.exports = router;