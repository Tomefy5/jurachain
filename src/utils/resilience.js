/**
 * Resilience utilities for error handling, retries, and fallback mechanisms
 * Implements exponential backoff, circuit breaker pattern, and timeout handling
 */

class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 60000; // 1 minute
        this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds

        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.successCount = 0;
    }

    async execute(operation, fallback = null) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.resetTimeout) {
                this.state = 'HALF_OPEN';
                this.successCount = 0;
            } else {
                if (fallback) {
                    return await fallback();
                }
                throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
            }
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();

            if (fallback && this.state === 'OPEN') {
                return await fallback();
            }

            throw error;
        }
    }

    onSuccess() {
        this.failureCount = 0;

        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= 3) {
                this.state = 'CLOSED';
            }
        }
    }

    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
        }
    }

    getState() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime,
            successCount: this.successCount
        };
    }
}

class RetryManager {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.baseDelay = options.baseDelay || 1000; // 1 second
        this.maxDelay = options.maxDelay || 30000; // 30 seconds
        this.backoffMultiplier = options.backoffMultiplier || 2;
        this.jitter = options.jitter || true;
    }

    async execute(operation, options = {}) {
        const maxRetries = options.maxRetries || this.maxRetries;
        const retryableErrors = options.retryableErrors || [
            'ECONNRESET',
            'ENOTFOUND',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'NETWORK_ERROR',
            'TIMEOUT_ERROR',
            'SERVICE_UNAVAILABLE'
        ];

        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await operation();
                return result;
            } catch (error) {
                lastError = error;

                // Don't retry on the last attempt
                if (attempt === maxRetries) {
                    break;
                }

                // Check if error is retryable
                const isRetryable = this.isRetryableError(error, retryableErrors);
                if (!isRetryable) {
                    break;
                }

                // Calculate delay with exponential backoff
                const delay = this.calculateDelay(attempt);
                console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);

                await this.sleep(delay);
            }
        }

        throw lastError;
    }

    isRetryableError(error, retryableErrors) {
        if (!error) return false;

        // Check error code
        if (error.code && retryableErrors.includes(error.code)) {
            return true;
        }

        // Check error message
        const errorMessage = error.message?.toLowerCase() || '';
        const retryableMessages = [
            'timeout',
            'network',
            'connection',
            'unavailable',
            'temporary',
            'rate limit'
        ];

        return retryableMessages.some(msg => errorMessage.includes(msg));
    }

    calculateDelay(attempt) {
        let delay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt);
        delay = Math.min(delay, this.maxDelay);

        // Add jitter to prevent thundering herd
        if (this.jitter) {
            delay = delay * (0.5 + Math.random() * 0.5);
        }

        return Math.floor(delay);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

class TimeoutManager {
    static async withTimeout(operation, timeoutMs, timeoutMessage = 'Operation timed out') {
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(timeoutMessage));
            }, timeoutMs);

            try {
                const result = await operation();
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    static async withTimeoutAndFallback(operation, fallback, timeoutMs, timeoutMessage = 'Operation timed out') {
        try {
            return await this.withTimeout(operation, timeoutMs, timeoutMessage);
        } catch (error) {
            if (error.message === timeoutMessage && fallback) {
                console.warn(`Operation timed out, executing fallback`);
                return await fallback();
            }
            throw error;
        }
    }
}

class FallbackManager {
    constructor() {
        this.fallbackChains = new Map();
    }

    registerFallbackChain(serviceName, fallbackChain) {
        this.fallbackChains.set(serviceName, fallbackChain);
    }

    async execute(serviceName, primaryOperation, context = {}) {
        const fallbackChain = this.fallbackChains.get(serviceName) || [];

        // Try primary operation first
        try {
            return await primaryOperation();
        } catch (primaryError) {
            console.warn(`Primary operation failed for ${serviceName}:`, primaryError.message);

            // Try fallback operations in order
            for (let i = 0; i < fallbackChain.length; i++) {
                try {
                    console.log(`Attempting fallback ${i + 1}/${fallbackChain.length} for ${serviceName}`);
                    const result = await fallbackChain[i](context, primaryError);
                    console.log(`Fallback ${i + 1} succeeded for ${serviceName}`);
                    return result;
                } catch (fallbackError) {
                    console.warn(`Fallback ${i + 1} failed for ${serviceName}:`, fallbackError.message);

                    // If this is the last fallback, throw the original error
                    if (i === fallbackChain.length - 1) {
                        throw primaryError;
                    }
                }
            }

            // If no fallbacks available, throw original error
            throw primaryError;
        }
    }
}

class HealthChecker {
    constructor() {
        this.services = new Map();
        this.checkInterval = 30000; // 30 seconds
        this.isRunning = false;
    }

    registerService(name, healthCheckFn, options = {}) {
        this.services.set(name, {
            name,
            healthCheck: healthCheckFn,
            timeout: options.timeout || 5000,
            lastCheck: null,
            status: 'unknown',
            consecutiveFailures: 0,
            maxFailures: options.maxFailures || 3
        });
    }

    async checkService(serviceName) {
        const service = this.services.get(serviceName);
        if (!service) {
            throw new Error(`Service ${serviceName} not registered`);
        }

        try {
            const result = await TimeoutManager.withTimeout(
                service.healthCheck,
                service.timeout,
                `Health check timeout for ${serviceName}`
            );

            service.status = 'healthy';
            service.consecutiveFailures = 0;
            service.lastCheck = new Date();

            return { status: 'healthy', ...result };
        } catch (error) {
            service.consecutiveFailures++;
            service.lastCheck = new Date();

            if (service.consecutiveFailures >= service.maxFailures) {
                service.status = 'unhealthy';
            } else {
                service.status = 'degraded';
            }

            return {
                status: service.status,
                error: error.message,
                consecutiveFailures: service.consecutiveFailures
            };
        }
    }

    async checkAllServices() {
        const results = {};

        for (const [serviceName] of this.services) {
            results[serviceName] = await this.checkService(serviceName);
        }

        return results;
    }

    startPeriodicChecks() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.intervalId = setInterval(async () => {
            try {
                await this.checkAllServices();
            } catch (error) {
                console.error('Error during periodic health checks:', error);
            }
        }, this.checkInterval);

        console.log('Health checker started with interval:', this.checkInterval);
    }

    stopPeriodicChecks() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.isRunning = false;
            console.log('Health checker stopped');
        }
    }

    getServiceStatus(serviceName) {
        const service = this.services.get(serviceName);
        return service ? {
            name: serviceName,
            status: service.status,
            lastCheck: service.lastCheck,
            consecutiveFailures: service.consecutiveFailures
        } : null;
    }

    getAllServiceStatuses() {
        const statuses = {};
        for (const [serviceName, service] of this.services) {
            statuses[serviceName] = {
                name: serviceName,
                status: service.status,
                lastCheck: service.lastCheck,
                consecutiveFailures: service.consecutiveFailures
            };
        }
        return statuses;
    }
}

module.exports = {
    CircuitBreaker,
    RetryManager,
    TimeoutManager,
    FallbackManager,
    HealthChecker
};