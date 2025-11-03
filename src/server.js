const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const blockchainRoutes = require('./routes/blockchain');
const blockchainHealthRoutes = require('./routes/blockchain-health');
const analyticsRoutes = require('./routes/analytics');
const clauseAnalysisRoutes = require('./routes/clauseAnalysis');
const collaborativeRoutes = require('./routes/collaborative');
const offlineRoutes = require('./routes/offline');
const healthRoutes = require('./routes/health');
const aiHealthRoutes = require('./routes/ai-health');
const alertRoutes = require('./routes/alerts');
const monitoringRoutes = require('./routes/monitoring');
const resilienceRoutes = require('./routes/resilience');

const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');
const { validateRequest } = require('./middleware/validation');
const { setupPrometheus } = require('./middleware/prometheus');
const {
    securityMiddleware,
    authRateLimit,
    apiRateLimit,
    suspiciousActivityDetection,
    requestLogger,
    cspMiddleware,
    hstsMiddleware,
    inputSanitization,
    sessionValidation
} = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced Security Middlewares
app.use(securityMiddleware);
app.use(cspMiddleware);
app.use(hstsMiddleware);
app.use(inputSanitization);

// CORS Configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(limiter);

// Enhanced Logging
app.use(morgan('combined'));
app.use(requestLogger);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Prometheus metrics
setupPrometheus(app);

// Health check endpoints (no auth required)
app.use('/health', healthRoutes);
app.use('/health/ai', aiHealthRoutes);
app.use('/health/blockchain', blockchainHealthRoutes);

// Alert handling endpoints (webhook endpoints don't require auth, others do)
app.use('/api/alerts', alertRoutes);

// Monitoring dashboard endpoints (require auth)
app.use('/api/monitoring', monitoringRoutes);

// Resilience and error handling endpoints
app.use('/api/resilience', resilienceRoutes);

// API Routes with Enhanced Security
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/documents', authMiddleware, sessionValidation, suspiciousActivityDetection, apiRateLimit, documentRoutes);
app.use('/api/blockchain', authMiddleware, sessionValidation, suspiciousActivityDetection, apiRateLimit, blockchainRoutes);
app.use('/api/analytics', authMiddleware, sessionValidation, apiRateLimit, analyticsRoutes);
app.use('/api/clause-analysis', authMiddleware, sessionValidation, suspiciousActivityDetection, apiRateLimit, clauseAnalysisRoutes);
app.use('/api/collaborative', authMiddleware, sessionValidation, apiRateLimit, collaborativeRoutes);
app.use('/api/offline', authMiddleware, sessionValidation, apiRateLimit, offlineRoutes);

// Serve static files
app.use(express.static('public'));

// API info endpoint
app.get('/api', (req, res) => {
    res.json({
        message: 'JusticeAutomation API Gateway',
        version: '1.0.0',
        status: 'active',
        endpoints: {
            auth: '/api/auth',
            documents: '/api/documents',
            blockchain: '/api/blockchain',
            analytics: '/api/analytics',
            clauseAnalysis: '/api/clause-analysis',
            collaborative: '/api/collaborative',
            offline: '/api/offline',
            health: '/health',
            blockchainHealth: '/health/blockchain'
        }
    });
});

// Legacy routes for backward compatibility
app.get('/dashboard', (req, res) => {
    res.sendFile('dashboard.html', { root: 'public' });
});

app.get('/translation', (req, res) => {
    res.sendFile('translation.html', { root: 'public' });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
    // Skip API routes and static files
    if (req.path.startsWith('/api/') ||
        req.path.startsWith('/health') ||
        req.path.startsWith('/metrics') ||
        req.path.includes('.')) {
        return res.status(404).json({
            error: 'Endpoint non trouvé',
            path: req.originalUrl,
            method: req.method
        });
    }

    // Serve React app
    res.sendFile('app.html', { root: 'public' });
});

// This is now handled by the catch-all route above

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');

    // Shutdown resilience manager first
    if (resilienceManager) {
        await resilienceManager.shutdown();
    }

    server.close(() => {
        console.log('HTTP server closed');
    });
});

process.on('SIGINT', async () => {
    console.log('SIGINT signal received: closing HTTP server');

    // Shutdown resilience manager first
    if (resilienceManager) {
        await resilienceManager.shutdown();
    }

    server.close(() => {
        console.log('HTTP server closed');
    });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 JusticeAutomation API Gateway démarré sur le port ${PORT}`);
    console.log(`📊 Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
});

// Initialize WebSocket service for collaborative editing
const WebSocketService = require('./services/websocketService');
const websocketService = new WebSocketService(server);
console.log(`🔄 Service WebSocket pour l'édition collaborative initialisé`);

// Initialize monitoring service
const MonitoringService = require('./services/monitoringService');
const monitoringService = new MonitoringService();
monitoringService.startPeriodicCollection(30000); // Collect metrics every 30 seconds
console.log(`📊 Service de monitoring et observabilité initialisé`);

// Initialize resilience manager
const ResilienceManager = require('./services/resilienceManager');
const resilienceManager = new ResilienceManager();
resilienceManager.initialize(monitoringService).then(() => {
    console.log(`🛡️ Gestionnaire de résilience et gestion d'erreurs initialisé`);
}).catch(error => {
    console.error('❌ Erreur lors de l\'initialisation du gestionnaire de résilience:', error);
});

// Make services available globally for other services
app.set('websocketService', websocketService);
app.set('monitoringService', monitoringService);
app.set('resilienceManager', resilienceManager);

module.exports = app;