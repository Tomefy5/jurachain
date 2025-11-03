const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const auditService = require('../services/auditService');
const securityConfig = require('../config/security');

/**
 * Enhanced security middleware with audit logging
 */
const securityMiddleware = (req, res, next) => {
    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // Add request ID for tracking
    req.requestId = require('crypto').randomUUID();
    res.setHeader('X-Request-ID', req.requestId);

    next();
};

/**
 * Authentication rate limiting
 */
const authRateLimit = rateLimit({
    windowMs: securityConfig.rateLimit.auth.windowMs,
    max: securityConfig.rateLimit.auth.max,
    message: {
        error: 'Trop de tentatives de connexion. Veuillez réessayer plus tard.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: async (req, res) => {
        // Log rate limit exceeded
        await auditService.logAuthEvent('RATE_LIMIT_EXCEEDED', req, null, 'BLOCKED', 'Authentication rate limit exceeded');

        res.status(429).json({
            error: 'Trop de tentatives de connexion. Veuillez réessayer plus tard.',
            code: 'AUTH_RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil(securityConfig.rateLimit.auth.windowMs / 1000)
        });
    }
});

/**
 * MFA rate limiting
 */
const mfaRateLimit = rateLimit({
    windowMs: securityConfig.rateLimit.mfa.windowMs,
    max: securityConfig.rateLimit.mfa.max,
    message: {
        error: 'Trop de tentatives MFA. Veuillez réessayer plus tard.',
        code: 'MFA_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: async (req, res) => {
        await auditService.logAuthEvent('MFA_RATE_LIMIT_EXCEEDED', req, null, 'BLOCKED', 'MFA rate limit exceeded');

        res.status(429).json({
            error: 'Trop de tentatives MFA. Veuillez réessayer plus tard.',
            code: 'MFA_RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil(securityConfig.rateLimit.mfa.windowMs / 1000)
        });
    }
});

/**
 * API rate limiting
 */
const apiRateLimit = rateLimit({
    windowMs: securityConfig.rateLimit.api.windowMs,
    max: securityConfig.rateLimit.api.max,
    message: {
        error: 'Trop de requêtes API. Veuillez réessayer plus tard.',
        code: 'API_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: async (req, res) => {
        const user = req.user || null;
        await auditService.logAuthEvent('API_RATE_LIMIT_EXCEEDED', req, user, 'BLOCKED', 'API rate limit exceeded');

        res.status(429).json({
            error: 'Trop de requêtes API. Veuillez réessayer plus tard.',
            code: 'API_RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil(securityConfig.rateLimit.api.windowMs / 1000)
        });
    }
});

/**
 * Suspicious activity detection middleware
 */
const suspiciousActivityDetection = async (req, res, next) => {
    try {
        if (req.user) {
            const patterns = await auditService.detectSuspiciousPatterns(
                req.user.id,
                auditService.getClientIP(req)
            );

            // Check for suspicious patterns
            const suspiciousPatterns = Object.entries(patterns).filter(([key, value]) => value === true);

            if (suspiciousPatterns.length > 0) {
                await auditService.logSuspiciousActivity(
                    req,
                    req.user,
                    'Suspicious patterns detected',
                    { patterns: suspiciousPatterns.map(([key]) => key) }
                );

                // For now, just log. In production, you might want to:
                // - Require additional verification
                // - Temporarily lock account
                // - Send security alert
                console.warn(`Suspicious activity detected for user ${req.user.email}:`, suspiciousPatterns);
            }
        }

        next();
    } catch (error) {
        console.error('Suspicious activity detection error:', error);
        next(); // Don't block request on detection error
    }
};

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Log request
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${auditService.getClientIP(req)} - User-Agent: ${req.get('User-Agent')}`);

    // Override res.json to log response
    const originalJson = res.json;
    res.json = function (data) {
        const duration = Date.now() - start;
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);

        // Log security-relevant responses
        if (res.statusCode >= 400) {
            const user = req.user || null;
            auditService.logAuthEvent('REQUEST_ERROR', req, user, 'ERROR', `HTTP ${res.statusCode}`);
        }

        return originalJson.call(this, data);
    };

    next();
};

/**
 * Content Security Policy configuration
 */
const cspMiddleware = helmet.contentSecurityPolicy({
    directives: securityConfig.headers.contentSecurityPolicy.directives,
    reportOnly: process.env.NODE_ENV === 'development'
});

/**
 * HSTS configuration
 */
const hstsMiddleware = helmet.hsts(securityConfig.headers.hsts);

/**
 * Input sanitization middleware
 */
const inputSanitization = (req, res, next) => {
    // Basic input sanitization
    const sanitizeObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;

        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                // Remove potentially dangerous characters
                obj[key] = obj[key]
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/javascript:/gi, '')
                    .replace(/on\w+\s*=/gi, '');
            } else if (typeof obj[key] === 'object') {
                sanitizeObject(obj[key]);
            }
        }
    };

    if (req.body) sanitizeObject(req.body);
    if (req.query) sanitizeObject(req.query);
    if (req.params) sanitizeObject(req.params);

    next();
};

/**
 * Session validation middleware
 */
const sessionValidation = async (req, res, next) => {
    if (req.user && req.user.sessionId) {
        // Check if session is still valid
        // This would typically check against a session store
        // For now, we'll just validate the JWT expiry

        try {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(token);

                // Check if token is close to expiry and needs renewal
                const now = Math.floor(Date.now() / 1000);
                const timeToExpiry = decoded.exp - now;

                if (timeToExpiry < securityConfig.session.renewalThreshold / 1000) {
                    res.setHeader('X-Token-Renewal-Required', 'true');
                }
            }
        } catch (error) {
            console.error('Session validation error:', error);
        }
    }

    next();
};

module.exports = {
    securityMiddleware,
    authRateLimit,
    mfaRateLimit,
    apiRateLimit,
    suspiciousActivityDetection,
    requestLogger,
    cspMiddleware,
    hstsMiddleware,
    inputSanitization,
    sessionValidation
};