/**
 * Security configuration for JusticeAutomation
 */

const securityConfig = {
    // JWT Configuration
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        issuer: 'justice-automation',
        audience: 'justice-automation-users',
        algorithm: 'HS256'
    },

    // MFA Configuration
    mfa: {
        codeLength: 6,
        codeExpiry: 5 * 60 * 1000, // 5 minutes
        maxAttempts: 3,
        methods: ['email', 'sms']
    },

    // Password Policy
    password: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        specialChars: '@$!%*?&',
        maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
        preventReuse: 5 // Last 5 passwords
    },

    // Session Management
    session: {
        maxConcurrentSessions: 5,
        inactivityTimeout: 30 * 60 * 1000, // 30 minutes
        absoluteTimeout: 8 * 60 * 60 * 1000, // 8 hours
        renewalThreshold: 15 * 60 * 1000 // 15 minutes before expiry
    },

    // Rate Limiting
    rateLimit: {
        global: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // requests per window
        },
        auth: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5 // login attempts per window
        },
        mfa: {
            windowMs: 5 * 60 * 1000, // 5 minutes
            max: 3 // MFA attempts per window
        },
        api: {
            windowMs: 1 * 60 * 1000, // 1 minute
            max: 60 // API calls per minute
        }
    },

    // Account Security
    account: {
        maxLoginAttempts: 5,
        lockoutDuration: 30 * 60 * 1000, // 30 minutes
        passwordResetExpiry: 1 * 60 * 60 * 1000, // 1 hour
        emailVerificationExpiry: 24 * 60 * 60 * 1000, // 24 hours
        suspensionReasons: [
            'MULTIPLE_FAILED_LOGINS',
            'SUSPICIOUS_ACTIVITY',
            'POLICY_VIOLATION',
            'ADMIN_ACTION'
        ]
    },

    // Role-Based Access Control
    rbac: {
        roles: {
            admin: {
                name: 'Administrateur',
                permissions: ['admin:*'],
                canElevate: false
            },
            lawyer: {
                name: 'Avocat',
                permissions: [
                    'documents:*',
                    'blockchain:*',
                    'analytics:read',
                    'users:read'
                ],
                canElevate: false
            },
            user: {
                name: 'Utilisateur',
                permissions: [
                    'documents:create',
                    'documents:read:own',
                    'documents:update:own',
                    'documents:delete:own',
                    'blockchain:sign:own',
                    'analytics:read:own'
                ],
                canElevate: false
            },
            guest: {
                name: 'Invité',
                permissions: [
                    'documents:read:public'
                ],
                canElevate: true
            }
        },
        permissions: {
            'admin:*': 'Accès administrateur complet',
            'documents:create': 'Créer des documents',
            'documents:read': 'Lire tous les documents',
            'documents:read:own': 'Lire ses propres documents',
            'documents:read:public': 'Lire les documents publics',
            'documents:update': 'Modifier tous les documents',
            'documents:update:own': 'Modifier ses propres documents',
            'documents:delete': 'Supprimer tous les documents',
            'documents:delete:own': 'Supprimer ses propres documents',
            'documents:*': 'Accès complet aux documents',
            'blockchain:sign': 'Signer tous les documents',
            'blockchain:sign:own': 'Signer ses propres documents',
            'blockchain:verify': 'Vérifier les signatures',
            'blockchain:*': 'Accès complet blockchain',
            'analytics:read': 'Consulter toutes les analytics',
            'analytics:read:own': 'Consulter ses propres analytics',
            'users:read': 'Consulter les utilisateurs',
            'users:update': 'Modifier les utilisateurs',
            'users:delete': 'Supprimer les utilisateurs'
        }
    },

    // Security Headers
    headers: {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "https://api.gemini.com", "https://*.supabase.co"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"]
            }
        },
        hsts: {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true
        },
        noSniff: true,
        frameguard: { action: 'deny' },
        xssFilter: true
    },

    // CORS Configuration
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'X-MFA-Code',
            'X-Session-ID'
        ],
        exposedHeaders: [
            'X-RateLimit-Limit',
            'X-RateLimit-Remaining',
            'X-RateLimit-Reset'
        ]
    },

    // Audit Logging
    audit: {
        events: [
            'USER_LOGIN',
            'USER_LOGOUT',
            'USER_REGISTER',
            'PASSWORD_CHANGE',
            'MFA_ENABLE',
            'MFA_DISABLE',
            'ROLE_CHANGE',
            'PERMISSION_CHANGE',
            'DOCUMENT_CREATE',
            'DOCUMENT_SIGN',
            'BLOCKCHAIN_TRANSACTION',
            'FAILED_LOGIN',
            'SUSPICIOUS_ACTIVITY'
        ],
        retention: 365 * 24 * 60 * 60 * 1000, // 1 year
        sensitiveFields: [
            'password',
            'token',
            'mfa_code',
            'private_key'
        ]
    },

    // Encryption
    encryption: {
        algorithm: 'aes-256-gcm',
        keyDerivation: 'pbkdf2',
        iterations: 100000,
        saltLength: 32,
        ivLength: 16,
        tagLength: 16
    }
};

module.exports = securityConfig;