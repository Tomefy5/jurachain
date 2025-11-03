/**
 * Resilience Manager - Central coordinator for all error handling and resilience mechanisms
 * Manages fallback strategies, circuit breakers, retries, and health monitoring
 * for the JusticeAutomation platform
 */

const ResilientService = require('./resilientService');
const { HealthChecker, TimeoutManager } = require('../utils/resilience');
const { ErrorMessageService, ErrorTypes } = require('../utils/errorMessages');
const MonitoringService = require('./monitoringService');

class ResilienceManager {
    constructor() {
        this.services = new Map();
        this.healthChecker = new HealthChecker();
        this.errorMessageService = new ErrorMessageService();
        this.monitoringService = null;
        this.isInitialized = false;

        // Service configurations
        this.serviceConfigs = {
            documentGenerator: {
                timeout: 30000,
                maxRetries: 3,
                circuitBreakerThreshold: 5,
                healthCheckInterval: 60000
            },
            blockchain: {
                timeout: 45000,
                maxRetries: 2,
                circuitBreakerThreshold: 3,
                healthCheckInterval: 120000
            },
            collaborative: {
                timeout: 20000,
                maxRetries: 2,
                circuitBreakerThreshold: 4,
                healthCheckInterval: 90000
            },
            translation: {
                timeout: 15000,
                maxRetries: 3,
                circuitBreakerThreshold: 5,
                healthCheckInterval: 60000
            },
            clauseAnalyzer: {
                timeout: 25000,
                maxRetries: 2,
                circuitBreakerThreshold: 4,
                healthCheckInterval: 90000
            },
            database: {
                timeout: 10000,
                maxRetries: 3,
                circuitBreakerThreshold: 5,
                healthCheckInterval: 30000
            }
        };

        // Global resilience settings
        this.globalSettings = {
            defaultLanguage: 'fr',
            enableMetrics: true,
            enableHealthChecks: true,
            enableCircuitBreakers: true,
            enableRetries: true,
            enableFallbacks: true,
            maxConcurrentOperations: 100,
            operationTimeoutBuffer: 5000 // Extra time for cleanup
        };

        this.activeOperations = new Map();
        this.operationCounter = 0;
    }

    /**
     * Initialize the resilience manager with all services
     */
    async initialize(monitoringService = null) {
        if (this.isInitialized) {
            return;
        }

        this.monitoringService = monitoringService;

        // Initialize resilient services for each component
        for (const [serviceName, config] of Object.entries(this.serviceConfigs)) {
            const resilientService = new ResilientService(serviceName, config);
            this.services.set(serviceName, resilientService);

            // Register health checks
            if (this.globalSettings.enableHealthChecks) {
                await this.registerServiceHealthCheck(serviceName, resilientService);
            }
        }

        // Start health monitoring
        if (this.globalSettings.enableHealthChecks) {
            this.healthChecker.startPeriodicChecks();
        }

        // Setup global error handlers
        this.setupGlobalErrorHandlers();

        this.isInitialized = true;
        console.log('✅ Resilience Manager initialized with all services');
    }

    /**
     * Register health check for a service
     */
    async registerServiceHealthCheck(serviceName, resilientService) {
        const config = this.serviceConfigs[serviceName];

        this.healthChecker.registerService(
            serviceName,
            async () => {
                // Perform a lightweight health check operation
                return await this.performHealthCheck(serviceName, resilientService);
            },
            {
                timeout: config.timeout / 2, // Half the operation timeout
                maxFailures: 3
            }
        );
    }

    /**
     * Perform health check for a specific service
     */
    async performHealthCheck(serviceName, resilientService) {
        switch (serviceName) {
            case 'documentGenerator':
                return await this.checkDocumentGeneratorHealth();
            case 'blockchain':
                return await this.checkBlockchainHealth();
            case 'collaborative':
                return await this.checkCollaborativeHealth();
            case 'translation':
                return await this.checkTranslationHealth();
            case 'clauseAnalyzer':
                return await this.checkClauseAnalyzerHealth();
            case 'database':
                return await this.checkDatabaseHealth();
            default:
                return { status: 'unknown', message: 'Health check not implemented' };
        }
    }

    /**
     * Execute an operation with full resilience support
     */
    async executeOperation(serviceName, operation, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Resilience Manager not initialized');
        }

        const service = this.services.get(serviceName);
        if (!service) {
            throw new Error(`Service ${serviceName} not registered`);
        }

        // Check if we're at capacity
        if (this.activeOperations.size >= this.globalSettings.maxConcurrentOperations) {
            throw new Error('System at capacity - too many concurrent operations');
        }

        const operationId = `${serviceName}_${++this.operationCounter}_${Date.now()}`;
        const startTime = Date.now();

        // Track active operation
        this.activeOperations.set(operationId, {
            serviceName,
            startTime,
            options
        });

        try {
            // Execute with service-specific resilience
            const result = await service.execute(operation, {
                ...options,
                operationId,
                language: options.language || this.globalSettings.defaultLanguage
            });

            // Record success metrics
            if (this.monitoringService && this.globalSettings.enableMetrics) {
                this.monitoringService.recordOperationSuccess(serviceName, Date.now() - startTime);
            }

            return result;

        } catch (error) {
            // Record failure metrics
            if (this.monitoringService && this.globalSettings.enableMetrics) {
                this.monitoringService.recordOperationFailure(serviceName, error.message);
            }

            // Format user-friendly error
            const userError = this.errorMessageService.formatError(
                error,
                options.language || this.globalSettings.defaultLanguage,
                {
                    service: serviceName,
                    operation: options.operationName || 'unknown',
                    operationId
                }
            );

            throw userError;

        } finally {
            // Clean up active operation tracking
            this.activeOperations.delete(operationId);
        }
    }

    /**
     * Get comprehensive system health status
     */
    async getSystemHealth() {
        const serviceStatuses = this.healthChecker.getAllServiceStatuses();
        const circuitBreakerStates = {};

        // Get circuit breaker states
        for (const [serviceName, service] of this.services) {
            circuitBreakerStates[serviceName] = service.getHealthStatus();
        }

        // Calculate overall system health
        const healthyServices = Object.values(serviceStatuses).filter(s => s.status === 'healthy').length;
        const totalServices = Object.keys(serviceStatuses).length;
        const healthPercentage = totalServices > 0 ? Math.round((healthyServices / totalServices) * 100) : 0;

        let overallStatus = 'healthy';
        if (healthPercentage < 50) {
            overallStatus = 'critical';
        } else if (healthPercentage < 80) {
            overallStatus = 'degraded';
        }

        return {
            overall: {
                status: overallStatus,
                healthPercentage,
                activeOperations: this.activeOperations.size,
                maxConcurrentOperations: this.globalSettings.maxConcurrentOperations
            },
            services: serviceStatuses,
            circuitBreakers: circuitBreakerStates,
            timestamp: new Date()
        };
    }

    /**
     * Handle system-wide degradation
     */
    async handleSystemDegradation(degradationLevel = 'moderate') {
        console.warn(`🚨 System degradation detected: ${degradationLevel}`);

        switch (degradationLevel) {
            case 'light':
                // Reduce timeouts slightly, increase retry delays
                this.adjustGlobalTimeouts(0.9);
                break;

            case 'moderate':
                // Reduce timeouts more, disable non-essential features
                this.adjustGlobalTimeouts(0.7);
                await this.disableNonEssentialFeatures();
                break;

            case 'severe':
                // Emergency mode - minimal functionality only
                this.adjustGlobalTimeouts(0.5);
                await this.enableEmergencyMode();
                break;
        }

        // Notify monitoring system
        if (this.monitoringService) {
            this.monitoringService.recordSystemEvent('degradation', {
                level: degradationLevel,
                timestamp: new Date(),
                activeOperations: this.activeOperations.size
            });
        }
    }

    /**
     * Adjust global timeouts based on system load
     */
    adjustGlobalTimeouts(multiplier) {
        for (const [serviceName, service] of this.services) {
            const config = this.serviceConfigs[serviceName];
            service.options.timeout = Math.floor(config.timeout * multiplier);
        }

        console.log(`⚙️ Global timeouts adjusted by factor: ${multiplier}`);
    }

    /**
     * Disable non-essential features during degradation
     */
    async disableNonEssentialFeatures() {
        // Disable health checks to reduce load
        this.healthChecker.stopPeriodicChecks();

        // Reduce concurrent operation limit
        this.globalSettings.maxConcurrentOperations = Math.floor(
            this.globalSettings.maxConcurrentOperations * 0.7
        );

        console.log('🔧 Non-essential features disabled due to system degradation');
    }

    /**
     * Enable emergency mode - core functionality only
     */
    async enableEmergencyMode() {
        // Stop all health checks
        this.healthChecker.stopPeriodicChecks();

        // Severely limit concurrent operations
        this.globalSettings.maxConcurrentOperations = 10;

        // Disable circuit breakers to allow all requests through
        this.globalSettings.enableCircuitBreakers = false;

        // Reset all circuit breakers to closed state
        for (const [serviceName, service] of this.services) {
            service.resetCircuitBreaker();
        }

        console.log('🚨 Emergency mode enabled - core functionality only');
    }

    /**
     * Recover from degradation
     */
    async recoverFromDegradation() {
        // Restore original settings
        for (const [serviceName, service] of this.services) {
            const config = this.serviceConfigs[serviceName];
            service.options.timeout = config.timeout;
        }

        // Restore global settings
        this.globalSettings.maxConcurrentOperations = 100;
        this.globalSettings.enableCircuitBreakers = true;

        // Restart health checks
        if (this.globalSettings.enableHealthChecks) {
            this.healthChecker.startPeriodicChecks();
        }

        console.log('✅ System recovered from degradation');

        // Notify monitoring system
        if (this.monitoringService) {
            this.monitoringService.recordSystemEvent('recovery', {
                timestamp: new Date(),
                activeOperations: this.activeOperations.size
            });
        }
    }

    /**
     * Setup global error handlers
     */
    setupGlobalErrorHandlers() {
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('🚨 Uncaught Exception:', error);

            if (this.monitoringService) {
                this.monitoringService.recordSystemEvent('uncaught_exception', {
                    error: error.message,
                    stack: error.stack,
                    timestamp: new Date()
                });
            }

            // Don't exit in production, try to continue
            if (process.env.NODE_ENV !== 'production') {
                process.exit(1);
            }
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);

            if (this.monitoringService) {
                this.monitoringService.recordSystemEvent('unhandled_rejection', {
                    reason: reason?.toString(),
                    timestamp: new Date()
                });
            }
        });

        // Handle memory warnings
        process.on('warning', (warning) => {
            if (warning.name === 'MaxListenersExceededWarning' ||
                warning.message?.includes('memory')) {
                console.warn('⚠️ System Warning:', warning.message);

                if (this.monitoringService) {
                    this.monitoringService.recordSystemEvent('system_warning', {
                        warning: warning.message,
                        timestamp: new Date()
                    });
                }
            }
        });
    }

    /**
     * Health check implementations for each service
     */
    async checkDocumentGeneratorHealth() {
        try {
            // Check if Ollama is accessible
            const axios = require('axios');
            const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

            await axios.get(`${ollamaUrl}/api/tags`, { timeout: 5000 });
            return { status: 'healthy', service: 'ollama' };
        } catch (error) {
            // Check if Gemini API is available as fallback
            if (process.env.GEMINI_API_KEY) {
                return { status: 'degraded', service: 'gemini_fallback', message: 'Ollama unavailable, using Gemini' };
            }
            return { status: 'unhealthy', message: 'Both Ollama and Gemini unavailable' };
        }
    }

    async checkBlockchainHealth() {
        try {
            // This would check Hedera/Polygon connectivity
            // For now, return healthy if environment variables are set
            if (process.env.HEDERA_ACCOUNT_ID || process.env.POLYGON_PRIVATE_KEY) {
                return { status: 'healthy', message: 'Blockchain services configured' };
            }
            return { status: 'unhealthy', message: 'No blockchain services configured' };
        } catch (error) {
            return { status: 'unhealthy', message: error.message };
        }
    }

    async checkCollaborativeHealth() {
        try {
            // Check Google API credentials
            if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
                return { status: 'healthy', message: 'Google APIs configured' };
            }
            return { status: 'degraded', message: 'Google APIs not configured, using local collaboration' };
        } catch (error) {
            return { status: 'unhealthy', message: error.message };
        }
    }

    async checkTranslationHealth() {
        try {
            // Translation service is mostly local, so it should be healthy
            return { status: 'healthy', message: 'Translation service operational' };
        } catch (error) {
            return { status: 'unhealthy', message: error.message };
        }
    }

    async checkClauseAnalyzerHealth() {
        try {
            // Check if TensorFlow is loaded
            // For now, assume healthy if no errors
            return { status: 'healthy', message: 'Clause analyzer operational' };
        } catch (error) {
            return { status: 'unhealthy', message: error.message };
        }
    }

    async checkDatabaseHealth() {
        try {
            // Check Supabase connection
            if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
                return { status: 'healthy', message: 'Database connection configured' };
            }
            return { status: 'unhealthy', message: 'Database not configured' };
        } catch (error) {
            return { status: 'unhealthy', message: error.message };
        }
    }

    /**
     * Get service by name
     */
    getService(serviceName) {
        return this.services.get(serviceName);
    }

    /**
     * Get all registered services
     */
    getAllServices() {
        return Array.from(this.services.keys());
    }

    /**
     * Shutdown gracefully
     */
    async shutdown() {
        console.log('🔄 Shutting down Resilience Manager...');

        // Stop health checks
        this.healthChecker.stopPeriodicChecks();

        // Wait for active operations to complete (with timeout)
        const shutdownTimeout = 30000; // 30 seconds
        const startTime = Date.now();

        while (this.activeOperations.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
            console.log(`⏳ Waiting for ${this.activeOperations.size} active operations to complete...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (this.activeOperations.size > 0) {
            console.warn(`⚠️ Forced shutdown with ${this.activeOperations.size} active operations`);
        }

        console.log('✅ Resilience Manager shutdown complete');
    }
}

module.exports = ResilienceManager;