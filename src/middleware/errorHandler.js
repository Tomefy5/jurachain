const ServiceErrorHandler = require('../utils/serviceErrorHandler');
const NetworkErrorHandler = require('../utils/networkErrorHandler');

const serviceErrorHandler = new ServiceErrorHandler();
const networkErrorHandler = new NetworkErrorHandler();

const errorHandler = (err, req, res, next) => {
    const correlationId = req.headers['x-correlation-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.error('Erreur capturée:', {
        correlationId,
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    });

    // Extract service name from request path
    const serviceName = extractServiceName(req.path);
    const language = req.headers['accept-language']?.startsWith('mg') ? 'mg' : 'fr';

    // Prepare error handling options
    const errorOptions = {
        language,
        operationName: `${req.method} ${req.path}`,
        context: {
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id,
            sessionId: req.session?.id
        },
        correlationId,
        userAgent: req.get('User-Agent'),
        sessionId: req.session?.id,
        userId: req.user?.id
    };

    let processedError;

    try {
        // Handle service-specific errors
        if (serviceName && (err.serviceError || err.networkError)) {
            processedError = serviceErrorHandler.handleServiceError(serviceName, err, errorOptions);
        }
        // Handle network errors
        else if (isNetworkError(err)) {
            processedError = networkErrorHandler.analyzeNetworkError(err, errorOptions);
        }
        // Handle standard application errors
        else {
            processedError = handleStandardError(err, errorOptions);
        }

        // Generate comprehensive error report for monitoring
        if (serviceName) {
            const errorReport = serviceErrorHandler.generateErrorReport(serviceName, err, errorOptions);

            // Send to monitoring service if available
            if (req.app.get('monitoringService')) {
                req.app.get('monitoringService').recordError(errorReport);
            }
        }

    } catch (processingError) {
        console.error('Error processing error:', processingError);
        processedError = {
            type: 'INTERNAL_ERROR',
            title: 'Erreur système',
            message: 'Une erreur inattendue s\'est produite',
            action: 'Veuillez réessayer',
            timestamp: new Date().toISOString()
        };
    }

    // Determine HTTP status code
    const statusCode = determineStatusCode(err, processedError);

    // Prepare response
    const response = {
        error: {
            type: processedError.type || 'INTERNAL_ERROR',
            title: processedError.title || 'Erreur',
            message: processedError.message || 'Une erreur s\'est produite',
            action: processedError.action || 'Veuillez réessayer',
            correlationId,
            timestamp: processedError.timestamp || new Date().toISOString(),
            path: req.path
        }
    };

    // Add additional information for enhanced errors
    if (processedError.serviceError) {
        response.error.service = processedError.serviceName;
        response.error.severity = processedError.severity;
        response.error.retryable = processedError.retryable;
        response.error.fallbackMessage = processedError.fallbackMessage;
        response.error.estimatedResolution = processedError.estimatedResolution;

        if (processedError.recommendations) {
            response.error.recommendations = processedError.recommendations;
        }

        if (processedError.troubleshooting) {
            response.error.troubleshooting = processedError.troubleshooting;
        }
    }

    if (processedError.networkError) {
        response.error.networkError = true;
        response.error.retryRecommended = processedError.retryRecommended;
        response.error.estimatedRetryDelay = processedError.estimatedRetryDelay;

        if (processedError.suggestions) {
            response.error.suggestions = processedError.suggestions;
        }
    }

    // Add debug information in development
    if (process.env.NODE_ENV === 'development') {
        response.debug = {
            originalError: err.message,
            stack: err.stack,
            serviceName
        };
    }

    // Add support contact for high severity errors
    if (processedError.severity === 'high' || processedError.severity === 'critical') {
        response.error.support = processedError.supportContact;
    }

    res.status(statusCode).json(response);
};

function extractServiceName(path) {
    const pathSegments = path.split('/');
    if (pathSegments[1] === 'api' && pathSegments[2]) {
        const serviceMap = {
            'documents': 'documentGenerator',
            'blockchain': 'blockchain',
            'collaborative': 'collaborative',
            'clause-analysis': 'clauseAnalyzer',
            'translation': 'translation',
            'analytics': 'database'
        };
        return serviceMap[pathSegments[2]] || pathSegments[2];
    }
    return null;
}

function isNetworkError(err) {
    const networkIndicators = [
        'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND',
        'EHOSTUNREACH', 'ENETUNREACH', 'network', 'connection', 'timeout'
    ];

    const errorString = (err.message + ' ' + (err.code || '')).toLowerCase();
    return networkIndicators.some(indicator => errorString.includes(indicator.toLowerCase()));
}

function handleStandardError(err, options) {
    // Handle standard Express/Node.js errors
    if (err.name === 'ValidationError') {
        return {
            type: 'VALIDATION_ERROR',
            title: 'Données invalides',
            message: 'Les données fournies ne sont pas valides',
            action: 'Vérifiez les champs marqués en rouge',
            details: err.details || err.message
        };
    }

    if (err.name === 'JsonWebTokenError') {
        return {
            type: 'AUTH_FAILED',
            title: 'Authentification échouée',
            message: 'Token d\'authentification invalide',
            action: 'Veuillez vous reconnecter'
        };
    }

    if (err.name === 'TokenExpiredError') {
        return {
            type: 'TOKEN_EXPIRED',
            title: 'Session expirée',
            message: 'Votre session a expiré',
            action: 'Reconnectez-vous pour continuer'
        };
    }

    if (err.code && err.code.startsWith('PGRST')) {
        return {
            type: 'DATABASE_ERROR',
            title: 'Erreur de base de données',
            message: 'Problème de connexion à la base de données',
            action: 'Réessayez dans quelques instants'
        };
    }

    if (err.status === 429) {
        return {
            type: 'RATE_LIMIT_EXCEEDED',
            title: 'Trop de requêtes',
            message: 'Vous avez effectué trop de requêtes',
            action: 'Attendez quelques minutes avant de réessayer'
        };
    }

    // Custom application errors
    if (err.isOperational) {
        return {
            type: err.code || 'APPLICATION_ERROR',
            title: 'Erreur applicative',
            message: err.message,
            action: 'Veuillez réessayer'
        };
    }

    // Default internal error
    return {
        type: 'INTERNAL_ERROR',
        title: 'Erreur système',
        message: 'Une erreur inattendue s\'est produite',
        action: 'Veuillez réessayer'
    };
}

function determineStatusCode(originalError, processedError) {
    // Use original error status if available
    if (originalError.status || originalError.statusCode) {
        return originalError.status || originalError.statusCode;
    }

    // Map error types to status codes
    const statusMap = {
        'VALIDATION_ERROR': 400,
        'INVALID_INPUT': 400,
        'AUTH_FAILED': 401,
        'TOKEN_EXPIRED': 401,
        'INSUFFICIENT_PERMISSIONS': 403,
        'DATA_NOT_FOUND': 404,
        'RATE_LIMIT_EXCEEDED': 429,
        'TIMEOUT_ERROR': 408,
        'SERVICE_UNAVAILABLE': 503,
        'NETWORK_ERROR': 502,
        'DATABASE_ERROR': 503,
        'INTERNAL_ERROR': 500
    };

    return statusMap[processedError.type] || 500;
}

class AppError extends Error {
    constructor(message, statusCode, code = 'APPLICATION_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    errorHandler,
    AppError,
    asyncHandler
};