const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const authService = require('../services/authService');
const { AppError } = require('./errorHandler');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Enhanced authentication middleware with JWT verification
 */
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Token d\'authentification requis',
                code: 'MISSING_TOKEN'
            });
        }

        const token = authHeader.substring(7);

        // Verify JWT token using enhanced auth service
        const decoded = authService.verifyJWT(token);

        // Verify user exists in Supabase and get fresh user data
        const { data: user, error } = await supabase.auth.admin.getUserById(decoded.userId);

        if (error || !user) {
            return res.status(401).json({
                error: 'Token invalide ou utilisateur non trouvé',
                code: 'INVALID_TOKEN'
            });
        }

        // Check if user account is active
        if (user.user.banned_until && new Date(user.user.banned_until) > new Date()) {
            return res.status(403).json({
                error: 'Compte temporairement suspendu',
                code: 'ACCOUNT_SUSPENDED',
                banned_until: user.user.banned_until
            });
        }

        // Add enhanced user info to request
        req.user = {
            id: user.user.id,
            email: user.user.email,
            role: user.user.user_metadata?.role || 'user',
            permissions: user.user.user_metadata?.permissions || authService.getRolePermissions('user'),
            sessionId: decoded.sessionId,
            mfaVerified: user.user.user_metadata?.mfa_verified || false,
            firstName: user.user.user_metadata?.firstName,
            lastName: user.user.user_metadata?.lastName,
            phone: user.user.user_metadata?.phone
        };

        // Log authentication for security monitoring
        console.log(`Auth: User ${req.user.email} (${req.user.role}) accessed ${req.method} ${req.path}`);

        next();
    } catch (error) {
        console.error('Erreur d\'authentification:', error);

        if (error.message.includes('JWT verification failed')) {
            return res.status(401).json({
                error: 'Token JWT invalide',
                code: 'INVALID_JWT'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expiré',
                code: 'EXPIRED_TOKEN'
            });
        }

        return res.status(500).json({
            error: 'Erreur interne du serveur',
            code: 'INTERNAL_ERROR'
        });
    }
};

/**
 * Enhanced role-based access control middleware
 */
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentification requise',
                code: 'AUTHENTICATION_REQUIRED'
            });
        }

        const userRole = req.user.role;
        const allowedRoles = Array.isArray(roles) ? roles : [roles];

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                error: 'Permissions insuffisantes',
                code: 'INSUFFICIENT_PERMISSIONS',
                required: allowedRoles,
                current: userRole
            });
        }

        next();
    };
};

/**
 * Permission-based access control middleware
 */
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentification requise',
                code: 'AUTHENTICATION_REQUIRED'
            });
        }

        const hasPermission = authService.hasPermission(req.user.permissions, permission);

        if (!hasPermission) {
            return res.status(403).json({
                error: 'Permission insuffisante',
                code: 'INSUFFICIENT_PERMISSION',
                required: permission,
                current: req.user.permissions
            });
        }

        next();
    };
};

/**
 * Multi-factor authentication requirement middleware
 */
const requireMFA = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Authentification requise',
            code: 'AUTHENTICATION_REQUIRED'
        });
    }

    if (!req.user.mfaVerified) {
        return res.status(403).json({
            error: 'Authentification multi-facteurs requise',
            code: 'MFA_REQUIRED'
        });
    }

    next();
};

/**
 * Resource ownership middleware - ensures user can only access their own resources
 */
const requireOwnership = (resourceIdParam = 'id', userIdField = 'userId') => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentification requise',
                code: 'AUTHENTICATION_REQUIRED'
            });
        }

        // Admin can access all resources
        if (req.user.role === 'admin') {
            return next();
        }

        const resourceId = req.params[resourceIdParam];

        try {
            // This would need to be customized based on your data model
            // For now, we'll check if the resource belongs to the user
            // You would typically query your database here

            // Example: Check document ownership
            if (req.path.includes('/documents/')) {
                // Query document to verify ownership
                // const document = await getDocumentById(resourceId);
                // if (document[userIdField] !== req.user.id) {
                //     return res.status(403).json({
                //         error: 'Accès refusé à cette ressource',
                //         code: 'RESOURCE_ACCESS_DENIED'
                //     });
                // }
            }

            next();
        } catch (error) {
            console.error('Ownership check error:', error);
            return res.status(500).json({
                error: 'Erreur lors de la vérification des permissions',
                code: 'OWNERSHIP_CHECK_ERROR'
            });
        }
    };
};

/**
 * Rate limiting per user middleware
 */
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const userRequests = new Map();

    return (req, res, next) => {
        if (!req.user) {
            return next();
        }

        const userId = req.user.id;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean old entries
        if (userRequests.has(userId)) {
            const requests = userRequests.get(userId).filter(time => time > windowStart);
            userRequests.set(userId, requests);
        } else {
            userRequests.set(userId, []);
        }

        const userRequestCount = userRequests.get(userId).length;

        if (userRequestCount >= maxRequests) {
            return res.status(429).json({
                error: 'Trop de requêtes de cet utilisateur',
                code: 'USER_RATE_LIMIT_EXCEEDED',
                retryAfter: Math.ceil(windowMs / 1000)
            });
        }

        // Add current request
        userRequests.get(userId).push(now);
        next();
    };
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            req.user = null;
            return next();
        }

        const token = authHeader.substring(7);
        const decoded = authService.verifyJWT(token);

        const { data: user, error } = await supabase.auth.admin.getUserById(decoded.userId);

        if (error || !user) {
            req.user = null;
            return next();
        }

        req.user = {
            id: user.user.id,
            email: user.user.email,
            role: user.user.user_metadata?.role || 'user',
            permissions: user.user.user_metadata?.permissions || authService.getRolePermissions('user'),
            sessionId: decoded.sessionId,
            mfaVerified: user.user.user_metadata?.mfa_verified || false
        };

        next();
    } catch (error) {
        // If token is invalid, just continue without user
        req.user = null;
        next();
    }
};

module.exports = {
    authMiddleware,
    requireRole,
    requirePermission,
    requireMFA,
    requireOwnership,
    userRateLimit,
    optionalAuth
};