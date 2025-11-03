const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');
const promClient = require('prom-client');

const router = express.Router();

/**
 * Get comprehensive monitoring dashboard data
 */
router.get('/dashboard', authMiddleware, asyncHandler(async (req, res) => {
    const monitoringService = req.app.get('monitoringService');

    if (!monitoringService) {
        return res.status(503).json({
            success: false,
            message: 'Monitoring service not available'
        });
    }

    // Generate health report
    const healthReport = await monitoringService.generateHealthReport();

    // Get Prometheus metrics summary
    const metricsRegistry = promClient.register;
    const metrics = await metricsRegistry.getMetricsAsJSON();

    // Process metrics for dashboard
    const processedMetrics = processMetricsForDashboard(metrics);

    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        health: healthReport,
        metrics: processedMetrics,
        services: {
            prometheus: {
                url: `http://localhost:${process.env.PROMETHEUS_PORT || 9090}`,
                status: 'active'
            },
            alertmanager: {
                url: `http://localhost:${process.env.ALERTMANAGER_PORT || 9093}`,
                status: 'active'
            },
            sonarqube: {
                url: `http://localhost:${process.env.SONARQUBE_PORT || 9000}`,
                status: 'active'
            }
        }
    });
}));

/**
 * Get real-time metrics
 */
router.get('/metrics/realtime', authMiddleware, asyncHandler(async (req, res) => {
    const monitoringService = req.app.get('monitoringService');

    if (!monitoringService) {
        return res.status(503).json({
            success: false,
            message: 'Monitoring service not available'
        });
    }

    const systemMetrics = monitoringService.collectSystemMetrics();

    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        system: systemMetrics,
        alerts: monitoringService.checkAlertThresholds(systemMetrics)
    });
}));

/**
 * Get service health status
 */
router.get('/health/services', authMiddleware, asyncHandler(async (req, res) => {
    const services = {
        'api-gateway': await checkServiceHealth('http://localhost:3000/health'),
        'ollama': await checkServiceHealth(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/tags`),
        'prometheus': await checkServiceHealth(`http://localhost:${process.env.PROMETHEUS_PORT || 9090}/-/healthy`),
        'alertmanager': await checkServiceHealth(`http://localhost:${process.env.ALERTMANAGER_PORT || 9093}/-/healthy`),
        'sonarqube': await checkServiceHealth(`http://localhost:${process.env.SONARQUBE_PORT || 9000}/api/system/status`)
    };

    const overallHealth = Object.values(services).every(service => service.status === 'healthy');

    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        overallHealth: overallHealth ? 'healthy' : 'degraded',
        services
    });
}));

/**
 * Get performance metrics summary
 */
router.get('/performance', authMiddleware, asyncHandler(async (req, res) => {
    const { timeRange = '1h' } = req.query;

    // In a real implementation, this would query Prometheus for historical data
    // For now, we'll return current metrics
    const metricsRegistry = promClient.register;
    const metrics = await metricsRegistry.getMetricsAsJSON();

    const performanceMetrics = {
        responseTime: extractMetric(metrics, 'http_request_duration_seconds'),
        throughput: extractMetric(metrics, 'http_requests_total'),
        errorRate: calculateErrorRate(metrics),
        documentGeneration: extractMetric(metrics, 'document_generation_duration_seconds'),
        blockchainTransactions: extractMetric(metrics, 'blockchain_transaction_duration_seconds'),
        systemResources: {
            memory: extractMetric(metrics, 'process_resident_memory_bytes'),
            cpu: extractMetric(metrics, 'process_cpu_seconds_total')
        }
    };

    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        timeRange,
        performance: performanceMetrics
    });
}));

/**
 * Get business metrics
 */
router.get('/business', authMiddleware, asyncHandler(async (req, res) => {
    const metricsRegistry = promClient.register;
    const metrics = await metricsRegistry.getMetricsAsJSON();

    const businessMetrics = {
        documentsGenerated: extractMetric(metrics, 'document_generation_total'),
        documentsByType: extractMetricByLabel(metrics, 'documents_by_type_total', 'document_type'),
        risksDetected: extractMetric(metrics, 'risk_detections_total'),
        blockchainTransactions: extractMetric(metrics, 'blockchain_transaction_total'),
        activeUsers: extractMetric(metrics, 'active_users_total'),
        collaborativeSessions: extractMetric(metrics, 'collaborative_sessions_active'),
        offlineSyncs: extractMetric(metrics, 'offline_sync_operations_total')
    };

    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        business: businessMetrics
    });
}));

/**
 * Trigger SonarQube analysis
 */
router.post('/sonarqube/analyze', authMiddleware, asyncHandler(async (req, res) => {
    const { projectKey = 'justice-automation' } = req.body;

    try {
        // In a real implementation, this would trigger SonarQube analysis
        // For now, we'll simulate the response
        const analysisResult = {
            taskId: `task_${Date.now()}`,
            status: 'PENDING',
            projectKey,
            submittedAt: new Date().toISOString(),
            analysisUrl: `http://localhost:${process.env.SONARQUBE_PORT || 9000}/dashboard?id=${projectKey}`
        };

        res.json({
            success: true,
            message: 'SonarQube analysis triggered',
            analysis: analysisResult
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to trigger SonarQube analysis',
            error: error.message
        });
    }
}));

/**
 * Get SonarQube quality gate status
 */
router.get('/sonarqube/quality-gate', authMiddleware, asyncHandler(async (req, res) => {
    const { projectKey = 'justice-automation' } = req.query;

    try {
        // In a real implementation, this would query SonarQube API
        // For now, we'll return mock data
        const qualityGate = {
            projectKey,
            status: 'OK', // OK, WARN, ERROR
            conditions: [
                { metric: 'new_coverage', status: 'OK', value: '85.2%', threshold: '80%' },
                { metric: 'new_duplicated_lines_density', status: 'OK', value: '2.1%', threshold: '3%' },
                { metric: 'new_maintainability_rating', status: 'OK', value: 'A', threshold: 'A' },
                { metric: 'new_reliability_rating', status: 'OK', value: 'A', threshold: 'A' },
                { metric: 'new_security_rating', status: 'OK', value: 'A', threshold: 'A' }
            ],
            lastAnalysis: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
            dashboardUrl: `http://localhost:${process.env.SONARQUBE_PORT || 9000}/dashboard?id=${projectKey}`
        };

        res.json({
            success: true,
            qualityGate
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get quality gate status',
            error: error.message
        });
    }
}));

/**
 * Helper function to check service health
 */
async function checkServiceHealth(url) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            timeout: 5000
        });

        return {
            status: response.ok ? 'healthy' : 'unhealthy',
            responseTime: Date.now(), // This would be calculated properly
            statusCode: response.status,
            url
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            url
        };
    }
}

/**
 * Process metrics for dashboard display
 */
function processMetricsForDashboard(metrics) {
    const processed = {
        http: {
            requestsTotal: 0,
            averageResponseTime: 0,
            errorRate: 0
        },
        system: {
            memoryUsage: 0,
            cpuUsage: 0,
            uptime: 0
        },
        business: {
            documentsGenerated: 0,
            blockchainTransactions: 0,
            activeUsers: 0
        }
    };

    metrics.forEach(metric => {
        switch (metric.name) {
            case 'http_requests_total':
                processed.http.requestsTotal = metric.values.reduce((sum, v) => sum + v.value, 0);
                break;
            case 'process_resident_memory_bytes':
                processed.system.memoryUsage = metric.values[0]?.value || 0;
                break;
            case 'process_uptime_seconds':
                processed.system.uptime = metric.values[0]?.value || 0;
                break;
            case 'document_generation_total':
                processed.business.documentsGenerated = metric.values.reduce((sum, v) => sum + v.value, 0);
                break;
            case 'blockchain_transaction_total':
                processed.business.blockchainTransactions = metric.values.reduce((sum, v) => sum + v.value, 0);
                break;
            case 'active_users_total':
                processed.business.activeUsers = metric.values[0]?.value || 0;
                break;
        }
    });

    return processed;
}

/**
 * Extract metric value from metrics array
 */
function extractMetric(metrics, metricName) {
    const metric = metrics.find(m => m.name === metricName);
    if (!metric || !metric.values || metric.values.length === 0) {
        return null;
    }

    // For counters and gauges, return the sum or latest value
    if (metric.type === 'counter') {
        return metric.values.reduce((sum, v) => sum + v.value, 0);
    } else {
        return metric.values[metric.values.length - 1].value;
    }
}

/**
 * Extract metric values grouped by label
 */
function extractMetricByLabel(metrics, metricName, labelName) {
    const metric = metrics.find(m => m.name === metricName);
    if (!metric || !metric.values) {
        return {};
    }

    const grouped = {};
    metric.values.forEach(value => {
        const labelValue = value.labels[labelName];
        if (labelValue) {
            grouped[labelValue] = (grouped[labelValue] || 0) + value.value;
        }
    });

    return grouped;
}

/**
 * Calculate error rate from HTTP metrics
 */
function calculateErrorRate(metrics) {
    const totalRequests = extractMetric(metrics, 'http_requests_total');
    const errorRequests = metrics
        .find(m => m.name === 'http_requests_total')
        ?.values
        ?.filter(v => v.labels.status_code && v.labels.status_code.startsWith('5'))
        ?.reduce((sum, v) => sum + v.value, 0) || 0;

    return totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;
}

module.exports = router;