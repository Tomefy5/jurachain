/**
 * Network Error Handler - Specialized handling for network-related errors
 * Provides intelligent retry strategies, timeout management, and connection monitoring
 */

const { RetryManager, TimeoutManager } = require('./resilience');
const { ErrorTypes, ErrorMessageService } = require('./errorMessages');

class NetworkErrorHandler {
    constructor(options = {}) {
        this.options = {
            defaultTimeout: options.defaultTimeout || 30000,
            maxRetries: options.maxRetries || 3,
            baseDelay: options.baseDelay || 1000,
            maxDelay: options.maxDelay || 30000,
            connectionPoolSize: options.connectionPoolSize || 10,
            keepAliveTimeout: options.keepAliveTimeout || 5000,
            ...options
        };

        this.retryManager = new RetryManager({
            maxRetries: this.options.maxRetries,
            baseDelay: this.options.baseDelay,
            maxDelay: this.options.maxDelay
        });

        this.errorMessageService = new ErrorMessageService();
        this.connectionPool = new Map();
        this.activeConnections = 0;
        this.connectionStats = {
            successful: 0,
            failed: 0,
            timeouts: 0,
            retries: 0
        };
    }

    /**
     * Execute a network operation with comprehensive error handling
     */
    async executeNetworkOperation(operation, options = {}) {
        const operationOptions = {
            timeout: options.timeout || this.options.defaultTimeout,
            retries: options.retries || this.options.maxRetries,
            retryableErrors: options.retryableErrors || this.getDefaultRetryableErrors(),
            language: options.language || 'fr',
            operationName: options.operationName || 'network_operation',
            ...options
        };

        // Check connection pool capacity
        if (this.activeConnections >= this.options.connectionPoolSize) {
            throw this.createNetworkError(
                'CONNECTION_POOL_EXHAUSTED',
                'Too many active connections',
                operationOptions.language
            );
        }

        this.activeConnections++;
        const startTime = Date.now();

        try {
            // Execute with timeout and retry logic
            const result = await this.retryManager.execute(
                () => TimeoutManager.withTimeout(
                    operation,
                    operationOptions.timeout,
                    `Network operation timed out after ${operationOptions.timeout}ms`
                ),
                {
                    maxRetries: operationOptions.retries,
                    retryableErrors: operationOptions.retryableErrors
                }
            );

            // Record success
            this.connectionStats.successful++;
            return result;

        } catch (error) {
            // Analyze and handle the error
            const handledError = this.analyzeNetworkError(error, operationOptions);

            // Record failure statistics
            if (this.isTimeoutError(error)) {
                this.connectionStats.timeouts++;
            } else {
                this.connectionStats.failed++;
            }

            throw handledError;

        } finally {
            this.activeConnections--;
        }
    }

    /**
     * Analyze network error and provide appropriate handling
     */
    analyzeNetworkError(error, options) {
        let errorType = ErrorTypes.NETWORK_ERROR;
        let enhancedMessage = error.message;
        let suggestions = [];

        // Analyze error type
        if (this.isTimeoutError(error)) {
            errorType = ErrorTypes.TIMEOUT_ERROR;
            suggestions = [
                'Vérifiez votre connexion internet',
                'Le service pourrait être temporairement surchargé',
                'Réessayez dans quelques instants'
            ];
        } else if (this.isConnectionError(error)) {
            errorType = ErrorTypes.CONNECTION_REFUSED;
            suggestions = [
                'Vérifiez que le service est en ligne',
                'Contrôlez vos paramètres de pare-feu',
                'Contactez l\'administrateur si le problème persiste'
            ];
        } else if (this.isDNSError(error)) {
            errorType = ErrorTypes.NETWORK_ERROR;
            enhancedMessage = 'Impossible de résoudre l\'adresse du service';
            suggestions = [
                'Vérifiez votre connexion internet',
                'Contrôlez vos paramètres DNS',
                'Réessayez plus tard'
            ];
        } else if (this.isSSLError(error)) {
            errorType = ErrorTypes.NETWORK_ERROR;
            enhancedMessage = 'Erreur de certificat SSL/TLS';
            suggestions = [
                'Le certificat du service pourrait être expiré',
                'Vérifiez la date et l\'heure de votre système',
                'Contactez le support technique'
            ];
        }

        // Create user-friendly error
        const userError = this.errorMessageService.formatError(
            { ...error, type: errorType, message: enhancedMessage },
            options.language,
            {
                operation: options.operationName,
                suggestions: suggestions,
                connectionStats: this.getConnectionStats()
            }
        );

        return {
            ...userError,
            networkError: true,
            originalError: error.message,
            suggestions: suggestions,
            retryRecommended: this.shouldRetry(error),
            estimatedRetryDelay: this.calculateRetryDelay(error)
        };
    }

    /**
     * Check if error is a timeout error
     */
    isTimeoutError(error) {
        const timeoutIndicators = [
            'timeout',
            'ETIMEDOUT',
            'ESOCKETTIMEDOUT',
            'timed out',
            'deadline exceeded'
        ];

        return timeoutIndicators.some(indicator =>
            error.message?.toLowerCase().includes(indicator.toLowerCase()) ||
            error.code === indicator
        );
    }

    /**
     * Check if error is a connection error
     */
    isConnectionError(error) {
        const connectionErrors = [
            'ECONNREFUSED',
            'ECONNRESET',
            'ENOTFOUND',
            'EHOSTUNREACH',
            'ENETUNREACH',
            'connection refused',
            'connection reset'
        ];

        return connectionErrors.some(errorCode =>
            error.code === errorCode ||
            error.message?.toLowerCase().includes(errorCode.toLowerCase())
        );
    }

    /**
     * Check if error is a DNS error
     */
    isDNSError(error) {
        const dnsErrors = [
            'ENOTFOUND',
            'ENODATA',
            'ESERVFAIL',
            'getaddrinfo',
            'dns lookup failed'
        ];

        return dnsErrors.some(errorCode =>
            error.code === errorCode ||
            error.message?.toLowerCase().includes(errorCode.toLowerCase())
        );
    }

    /**
     * Check if error is an SSL/TLS error
     */
    isSSLError(error) {
        const sslErrors = [
            'CERT_',
            'SSL_',
            'TLS_',
            'certificate',
            'handshake',
            'self signed certificate'
        ];

        return sslErrors.some(errorPattern =>
            error.code?.includes(errorPattern) ||
            error.message?.toLowerCase().includes(errorPattern.toLowerCase())
        );
    }

    /**
     * Determine if an error should trigger a retry
     */
    shouldRetry(error) {
        // Don't retry SSL errors or DNS errors
        if (this.isSSLError(error) || this.isDNSError(error)) {
            return false;
        }

        // Don't retry 4xx HTTP errors (client errors)
        if (error.response?.status >= 400 && error.response?.status < 500) {
            return false;
        }

        // Retry timeouts and connection errors
        return this.isTimeoutError(error) || this.isConnectionError(error);
    }

    /**
     * Calculate recommended retry delay based on error type
     */
    calculateRetryDelay(error) {
        if (this.isTimeoutError(error)) {
            return 5000; // 5 seconds for timeout errors
        } else if (this.isConnectionError(error)) {
            return 2000; // 2 seconds for connection errors
        }
        return 1000; // 1 second default
    }

    /**
     * Get default retryable error patterns
     */
    getDefaultRetryableErrors() {
        return [
            'ECONNRESET',
            'ENOTFOUND',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'ESOCKETTIMEDOUT',
            'EHOSTUNREACH',
            'ENETUNREACH',
            'NETWORK_ERROR',
            'TIMEOUT_ERROR',
            'SERVICE_UNAVAILABLE'
        ];
    }

    /**
     * Create a standardized network error
     */
    createNetworkError(type, message, language = 'fr') {
        return this.errorMessageService.createUserFriendlyError(
            type,
            language,
            message,
            {
                networkError: true,
                timestamp: new Date(),
                connectionStats: this.getConnectionStats()
            }
        );
    }

    /**
     * Get connection statistics
     */
    getConnectionStats() {
        const total = this.connectionStats.successful + this.connectionStats.failed;
        return {
            ...this.connectionStats,
            total,
            successRate: total > 0 ? Math.round((this.connectionStats.successful / total) * 100) : 0,
            activeConnections: this.activeConnections,
            poolCapacity: this.options.connectionPoolSize
        };
    }

    /**
     * Monitor network health
     */
    async monitorNetworkHealth(testUrls = []) {
        const results = [];

        for (const url of testUrls) {
            try {
                const startTime = Date.now();

                await this.executeNetworkOperation(async () => {
                    const axios = require('axios');
                    return await axios.get(url, { timeout: 5000 });
                }, {
                    timeout: 5000,
                    retries: 1,
                    operationName: 'health_check'
                });

                results.push({
                    url,
                    status: 'healthy',
                    responseTime: Date.now() - startTime
                });

            } catch (error) {
                results.push({
                    url,
                    status: 'unhealthy',
                    error: error.message,
                    responseTime: null
                });
            }
        }

        return {
            timestamp: new Date(),
            results,
            overallHealth: results.every(r => r.status === 'healthy') ? 'healthy' : 'degraded',
            connectionStats: this.getConnectionStats()
        };
    }

    /**
     * Reset connection statistics
     */
    resetStats() {
        this.connectionStats = {
            successful: 0,
            failed: 0,
            timeouts: 0,
            retries: 0
        };
    }

    /**
     * Configure adaptive timeouts based on network conditions
     */
    configureAdaptiveTimeouts(networkCondition = 'normal') {
        const timeoutMultipliers = {
            excellent: 0.7,
            good: 0.85,
            normal: 1.0,
            poor: 1.5,
            very_poor: 2.0
        };

        const multiplier = timeoutMultipliers[networkCondition] || 1.0;
        this.options.defaultTimeout = Math.floor(30000 * multiplier);
        this.options.maxDelay = Math.floor(30000 * multiplier);

        console.log(`🌐 Network timeouts adjusted for ${networkCondition} conditions (${multiplier}x)`);
    }

    /**
     * Get network error handling recommendations
     */
    getErrorHandlingRecommendations() {
        const stats = this.getConnectionStats();
        const recommendations = [];

        if (stats.successRate < 50) {
            recommendations.push({
                type: 'critical',
                message: 'Taux de succès très faible - vérifiez la connectivité réseau',
                action: 'Contactez votre administrateur réseau'
            });
        } else if (stats.successRate < 80) {
            recommendations.push({
                type: 'warning',
                message: 'Taux de succès modéré - connexion instable détectée',
                action: 'Surveillez la qualité de votre connexion'
            });
        }

        if (stats.timeouts > stats.successful * 0.2) {
            recommendations.push({
                type: 'warning',
                message: 'Nombreux timeouts détectés',
                action: 'Considérez augmenter les délais d\'attente'
            });
        }

        if (this.activeConnections > this.options.connectionPoolSize * 0.8) {
            recommendations.push({
                type: 'info',
                message: 'Pool de connexions presque saturé',
                action: 'Optimisez l\'utilisation des connexions'
            });
        }

        return recommendations;
    }
}

module.exports = NetworkErrorHandler;