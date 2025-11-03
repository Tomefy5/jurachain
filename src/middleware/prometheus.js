const promClient = require('prom-client');

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
    app: 'justice-automation'
});

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestsTotal = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new promClient.Gauge({
    name: 'active_connections',
    help: 'Number of active connections'
});

const documentGenerationDuration = new promClient.Histogram({
    name: 'document_generation_duration_seconds',
    help: 'Duration of document generation in seconds',
    labelNames: ['document_type', 'ai_service'],
    buckets: [1, 5, 10, 15, 30, 60, 120]
});

const documentGenerationTotal = new promClient.Counter({
    name: 'document_generation_total',
    help: 'Total number of document generations',
    labelNames: ['document_type', 'ai_service', 'status']
});

const blockchainTransactionDuration = new promClient.Histogram({
    name: 'blockchain_transaction_duration_seconds',
    help: 'Duration of blockchain transactions in seconds',
    labelNames: ['network', 'transaction_type'],
    buckets: [1, 5, 10, 30, 60, 120, 300]
});

const blockchainTransactionTotal = new promClient.Counter({
    name: 'blockchain_transaction_total',
    help: 'Total number of blockchain transactions',
    labelNames: ['network', 'transaction_type', 'status']
});

// Register custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(activeConnections);
register.registerMetric(documentGenerationDuration);
register.registerMetric(documentGenerationTotal);
register.registerMetric(blockchainTransactionDuration);
register.registerMetric(blockchainTransactionTotal);

// Middleware to collect HTTP metrics
const metricsMiddleware = (req, res, next) => {
    const start = Date.now();

    // Increment active connections
    activeConnections.inc();

    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route ? req.route.path : req.path;

        // Record metrics
        httpRequestDuration
            .labels(req.method, route, res.statusCode)
            .observe(duration);

        httpRequestsTotal
            .labels(req.method, route, res.statusCode)
            .inc();

        // Decrement active connections
        activeConnections.dec();
    });

    next();
};

// Setup Prometheus endpoint
const setupPrometheus = (app) => {
    // Add metrics middleware to all routes
    app.use(metricsMiddleware);

    // Metrics endpoint
    app.get('/metrics', async (req, res) => {
        try {
            res.set('Content-Type', register.contentType);
            const metrics = await register.metrics();
            res.end(metrics);
        } catch (error) {
            console.error('Erreur lors de la collecte des métriques:', error);
            res.status(500).end('Erreur lors de la collecte des métriques');
        }
    });
};

// Helper functions to record custom metrics
const recordDocumentGeneration = (documentType, aiService, duration, status) => {
    documentGenerationDuration
        .labels(documentType, aiService)
        .observe(duration);

    documentGenerationTotal
        .labels(documentType, aiService, status)
        .inc();
};

const recordBlockchainTransaction = (network, transactionType, duration, status) => {
    blockchainTransactionDuration
        .labels(network, transactionType)
        .observe(duration);

    blockchainTransactionTotal
        .labels(network, transactionType, status)
        .inc();
};

module.exports = {
    setupPrometheus,
    recordDocumentGeneration,
    recordBlockchainTransaction,
    register
};