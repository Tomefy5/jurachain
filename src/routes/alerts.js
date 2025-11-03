const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Store recent alerts in memory (in production, use a database)
const alertHistory = [];
const MAX_ALERT_HISTORY = 1000;

/**
 * Webhook endpoint for Alertmanager
 */
router.post('/webhook', asyncHandler(async (req, res) => {
    const alerts = req.body.alerts || [];
    const timestamp = new Date().toISOString();

    console.log(`Received ${alerts.length} alerts from Alertmanager at ${timestamp}`);

    for (const alert of alerts) {
        const alertData = {
            id: generateAlertId(),
            timestamp,
            status: alert.status, // firing or resolved
            alertname: alert.labels.alertname,
            severity: alert.labels.severity,
            service: alert.labels.service,
            instance: alert.labels.instance,
            summary: alert.annotations.summary,
            description: alert.annotations.description,
            startsAt: alert.startsAt,
            endsAt: alert.endsAt,
            generatorURL: alert.generatorURL
        };

        // Store alert in history
        alertHistory.unshift(alertData);
        if (alertHistory.length > MAX_ALERT_HISTORY) {
            alertHistory.pop();
        }

        // Process alert based on severity
        await processAlert(alertData);
    }

    res.status(200).json({
        success: true,
        message: `Processed ${alerts.length} alerts`,
        timestamp
    });
}));

/**
 * Critical alerts endpoint
 */
router.post('/critical', asyncHandler(async (req, res) => {
    const alerts = req.body.alerts || [];

    console.log(`Received ${alerts.length} CRITICAL alerts`);

    for (const alert of alerts) {
        // Handle critical alerts with immediate action
        await handleCriticalAlert(alert);
    }

    res.status(200).json({
        success: true,
        message: `Processed ${alerts.length} critical alerts`
    });
}));

/**
 * Security alerts endpoint
 */
router.post('/security', asyncHandler(async (req, res) => {
    const alerts = req.body.alerts || [];

    console.log(`Received ${alerts.length} SECURITY alerts`);

    for (const alert of alerts) {
        // Handle security alerts with special processing
        await handleSecurityAlert(alert);
    }

    res.status(200).json({
        success: true,
        message: `Processed ${alerts.length} security alerts`
    });
}));

/**
 * Get alert history (requires authentication)
 */
router.get('/history', authMiddleware, asyncHandler(async (req, res) => {
    const { limit = 50, severity, service, status } = req.query;

    let filteredAlerts = alertHistory;

    // Apply filters
    if (severity) {
        filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
    }
    if (service) {
        filteredAlerts = filteredAlerts.filter(alert => alert.service === service);
    }
    if (status) {
        filteredAlerts = filteredAlerts.filter(alert => alert.status === status);
    }

    // Limit results
    const limitedAlerts = filteredAlerts.slice(0, parseInt(limit));

    res.json({
        success: true,
        alerts: limitedAlerts,
        total: filteredAlerts.length,
        filters: { severity, service, status, limit }
    });
}));

/**
 * Get alert statistics
 */
router.get('/stats', authMiddleware, asyncHandler(async (req, res) => {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last1h = new Date(now.getTime() - 60 * 60 * 1000);

    const recent24h = alertHistory.filter(alert => new Date(alert.timestamp) > last24h);
    const recent1h = alertHistory.filter(alert => new Date(alert.timestamp) > last1h);

    const stats = {
        total: alertHistory.length,
        last24h: recent24h.length,
        last1h: recent1h.length,
        bySeverity: {
            critical: alertHistory.filter(alert => alert.severity === 'critical').length,
            warning: alertHistory.filter(alert => alert.severity === 'warning').length
        },
        byService: {},
        byStatus: {
            firing: alertHistory.filter(alert => alert.status === 'firing').length,
            resolved: alertHistory.filter(alert => alert.status === 'resolved').length
        }
    };

    // Count by service
    alertHistory.forEach(alert => {
        if (alert.service) {
            stats.byService[alert.service] = (stats.byService[alert.service] || 0) + 1;
        }
    });

    res.json({
        success: true,
        stats,
        timestamp: now.toISOString()
    });
}));

/**
 * Test alert endpoint (for testing alert system)
 */
router.post('/test', authMiddleware, asyncHandler(async (req, res) => {
    const { severity = 'warning', service = 'test', message = 'Test alert' } = req.body;

    const testAlert = {
        id: generateAlertId(),
        timestamp: new Date().toISOString(),
        status: 'firing',
        alertname: 'TestAlert',
        severity,
        service,
        instance: 'test-instance',
        summary: message,
        description: 'This is a test alert generated for system verification',
        startsAt: new Date().toISOString(),
        endsAt: null,
        generatorURL: 'http://api-gateway:3000/api/alerts/test'
    };

    // Store in history
    alertHistory.unshift(testAlert);
    if (alertHistory.length > MAX_ALERT_HISTORY) {
        alertHistory.pop();
    }

    // Process the test alert
    await processAlert(testAlert);

    res.json({
        success: true,
        message: 'Test alert generated and processed',
        alert: testAlert
    });
}));

/**
 * Process an alert based on its properties
 */
async function processAlert(alert) {
    try {
        console.log(`Processing alert: ${alert.alertname} (${alert.severity}) for service ${alert.service}`);

        // Log alert details
        const logLevel = alert.severity === 'critical' ? 'error' : 'warn';
        console[logLevel](`ALERT [${alert.severity.toUpperCase()}] ${alert.summary}`, {
            service: alert.service,
            instance: alert.instance,
            description: alert.description,
            timestamp: alert.timestamp
        });

        // Take automated actions based on alert type
        switch (alert.alertname) {
            case 'ServiceDown':
                await handleServiceDownAlert(alert);
                break;
            case 'HighMemoryUsage':
                await handleHighMemoryAlert(alert);
                break;
            case 'DocumentGenerationFailures':
                await handleDocumentGenerationFailures(alert);
                break;
            case 'BlockchainTransactionFailures':
                await handleBlockchainFailures(alert);
                break;
            default:
                console.log(`No specific handler for alert: ${alert.alertname}`);
        }

    } catch (error) {
        console.error('Error processing alert:', error);
    }
}

/**
 * Handle critical alerts with immediate action
 */
async function handleCriticalAlert(alert) {
    console.error(`CRITICAL ALERT: ${alert.labels.alertname}`, {
        summary: alert.annotations.summary,
        description: alert.annotations.description,
        service: alert.labels.service
    });

    // In a production environment, this could:
    // - Send SMS/push notifications to on-call engineers
    // - Create incident tickets
    // - Trigger automated recovery procedures
}

/**
 * Handle security alerts with special processing
 */
async function handleSecurityAlert(alert) {
    console.error(`SECURITY ALERT: ${alert.labels.alertname}`, {
        summary: alert.annotations.summary,
        description: alert.annotations.description,
        instance: alert.labels.instance
    });

    // In a production environment, this could:
    // - Block suspicious IP addresses
    // - Increase security monitoring
    // - Notify security team immediately
}

/**
 * Handle service down alerts
 */
async function handleServiceDownAlert(alert) {
    console.error(`Service down detected: ${alert.service} on ${alert.instance}`);

    // Could trigger:
    // - Health check retries
    // - Service restart procedures
    // - Failover to backup services
}

/**
 * Handle high memory usage alerts
 */
async function handleHighMemoryAlert(alert) {
    console.warn(`High memory usage detected on ${alert.instance}`);

    // Could trigger:
    // - Garbage collection
    // - Memory dump for analysis
    // - Scale up resources
}

/**
 * Handle document generation failures
 */
async function handleDocumentGenerationFailures(alert) {
    console.warn('High document generation failure rate detected');

    // Could trigger:
    // - Switch to backup AI service
    // - Check AI service health
    // - Reduce generation complexity
}

/**
 * Handle blockchain transaction failures
 */
async function handleBlockchainFailures(alert) {
    console.error('High blockchain transaction failure rate detected');

    // Could trigger:
    // - Switch to backup blockchain network
    // - Check network connectivity
    // - Queue transactions for retry
}

/**
 * Generate unique alert ID
 */
function generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = router;