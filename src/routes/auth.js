const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const { validationSchemas, validateRequest } = require('../middleware/validation');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authMiddleware, requireRole, requirePermission } = require('../middleware/auth');
const { mfaRateLimit } = require('../middleware/security');
const authService = require('../services/authService');
const auditService = require('../services/auditService');

const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Register new user
router.post('/register',
    validationSchemas.register,
    validateRequest,
    asyncHandler(async (req, res) => {
        const { email, password, firstName, lastName, phone } = req.body;

        // Validate password strength
        const passwordValidation = authService.validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
            throw new AppError(
                'Mot de passe trop faible',
                400,
                'WEAK_PASSWORD',
                { errors: passwordValidation.errors }
            );
        }

        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            user_metadata: {
                firstName,
                lastName,
                phone,
                role: 'user',
                permissions: authService.getRolePermissions('user'),
                created_at: new Date().toISOString(),
                mfa_enabled: false
            },
            email_confirm: true
        });

        if (authError) {
            throw new AppError(
                authError.message === 'User already registered'
                    ? 'Un utilisateur avec cette adresse email existe déjà'
                    : 'Erreur lors de la création du compte',
                400,
                'REGISTRATION_ERROR'
            );
        }

        // Generate enhanced JWT token
        const token = authService.generateJWT(authData.user);

        // Log successful registration
        await auditService.logAuthEvent('USER_REGISTER', req, authData.user, 'SUCCESS');

        res.status(201).json({
            message: 'Compte créé avec succès',
            user: {
                id: authData.user.id,
                email: authData.user.email,
                firstName,
                lastName,
                role: 'user',
                permissions: authService.getRolePermissions('user')
            },
            token,
            mfaRequired: false
        });
    })
);

// Login user
router.post('/login',
    validationSchemas.login,
    validateRequest,
    asyncHandler(async (req, res) => {
        const { email, password } = req.body;

        // Authenticate with Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            // Log failed login attempt
            await auditService.logAuthEvent('FAILED_LOGIN', req, null, 'FAILED', 'Invalid credentials');

            throw new AppError(
                'Email ou mot de passe incorrect',
                401,
                'INVALID_CREDENTIALS'
            );
        }

        const user = authData.user;
        const mfaEnabled = user.user_metadata?.mfa_enabled || false;

        // If MFA is enabled, don't provide full access token yet
        if (mfaEnabled) {
            // Generate temporary token for MFA verification
            const tempToken = jwt.sign(
                {
                    userId: user.id,
                    email: user.email,
                    mfa_pending: true
                },
                process.env.JWT_SECRET,
                { expiresIn: '10m' } // Short expiry for MFA verification
            );

            return res.json({
                message: 'Authentification multi-facteurs requise',
                mfaRequired: true,
                tempToken,
                availableMethods: ['email', 'sms'].filter(method => {
                    if (method === 'email') return true;
                    if (method === 'sms') return user.user_metadata?.phone;
                    return false;
                })
            });
        }

        // Generate full access token
        const token = authService.generateJWT(user);

        // Log successful login
        await auditService.logAuthEvent('USER_LOGIN', req, user, 'SUCCESS');

        res.json({
            message: 'Connexion réussie',
            user: {
                id: user.id,
                email: user.email,
                firstName: user.user_metadata?.firstName,
                lastName: user.user_metadata?.lastName,
                role: user.user_metadata?.role || 'user',
                permissions: user.user_metadata?.permissions || authService.getRolePermissions('user')
            },
            token,
            mfaRequired: false
        });
    })
);

// Refresh token
router.post('/refresh',
    asyncHandler(async (req, res) => {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            throw new AppError('Token de rafraîchissement requis', 400, 'MISSING_REFRESH_TOKEN');
        }

        const { data, error } = await supabase.auth.refreshSession({
            refresh_token: refreshToken
        });

        if (error) {
            throw new AppError('Token de rafraîchissement invalide', 401, 'INVALID_REFRESH_TOKEN');
        }

        // Generate new JWT token
        const token = jwt.sign(
            {
                userId: data.user.id,
                email: data.user.email,
                role: data.user.user_metadata?.role || 'user'
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.json({
            message: 'Token rafraîchi avec succès',
            token,
            refreshToken: data.session.refresh_token
        });
    })
);

// Logout user
router.post('/logout',
    asyncHandler(async (req, res) => {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);

            // Sign out from Supabase
            await supabase.auth.signOut();
        }

        res.json({
            message: 'Déconnexion réussie'
        });
    })
);

// Request password reset
router.post('/forgot-password',
    [validationSchemas.register[0]], // email validation
    validateRequest,
    asyncHandler(async (req, res) => {
        const { email } = req.body;

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.FRONTEND_URL}/reset-password`
        });

        if (error) {
            throw new AppError('Erreur lors de l\'envoi de l\'email de réinitialisation', 500, 'RESET_EMAIL_ERROR');
        }

        res.json({
            message: 'Email de réinitialisation envoyé avec succès'
        });
    })
);

// Reset password
router.post('/reset-password',
    [
        validationSchemas.register[1], // password validation
        body('token').notEmpty().withMessage('Token de réinitialisation requis')
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        const { password, token } = req.body;

        // Validate password strength
        const passwordValidation = authService.validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
            throw new AppError(
                'Mot de passe trop faible',
                400,
                'WEAK_PASSWORD',
                { errors: passwordValidation.errors }
            );
        }

        const { error } = await supabase.auth.updateUser({
            password
        });

        if (error) {
            throw new AppError('Erreur lors de la réinitialisation du mot de passe', 400, 'PASSWORD_RESET_ERROR');
        }

        res.json({
            message: 'Mot de passe réinitialisé avec succès'
        });
    })
);

// Request MFA code
router.post('/mfa/request',
    mfaRateLimit,
    [
        body('method').isIn(['email', 'sms']).withMessage('Méthode MFA invalide (email ou sms)'),
        body('tempToken').notEmpty().withMessage('Token temporaire requis')
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        const { method, tempToken } = req.body;

        try {
            // Verify temporary token
            const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);

            if (!decoded.mfa_pending) {
                throw new AppError('Token temporaire invalide', 401, 'INVALID_TEMP_TOKEN');
            }

            // Get user data
            const { data: user, error } = await supabase.auth.admin.getUserById(decoded.userId);
            if (error || !user) {
                throw new AppError('Utilisateur non trouvé', 404, 'USER_NOT_FOUND');
            }

            // Generate MFA code
            const { code, expiresAt } = authService.generateMFACode();

            // Store MFA code
            await authService.storeMFACode(decoded.userId, code, expiresAt, method);

            // Send MFA code
            if (method === 'email') {
                await authService.sendMFACodeEmail(user.user.email, code);
            } else if (method === 'sms') {
                const phone = user.user.user_metadata?.phone;
                if (!phone) {
                    throw new AppError('Numéro de téléphone non configuré', 400, 'PHONE_NOT_CONFIGURED');
                }
                await authService.sendMFACodeSMS(phone, code);
            }

            res.json({
                message: `Code MFA envoyé par ${method}`,
                expiresIn: 300 // 5 minutes
            });

        } catch (error) {
            if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
                throw new AppError('Token temporaire invalide ou expiré', 401, 'INVALID_TEMP_TOKEN');
            }
            throw error;
        }
    })
);

// Verify MFA code
router.post('/mfa/verify',
    mfaRateLimit,
    [
        body('code').isLength({ min: 6, max: 6 }).withMessage('Code MFA invalide'),
        body('tempToken').notEmpty().withMessage('Token temporaire requis')
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        const { code, tempToken } = req.body;

        try {
            // Verify temporary token
            const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);

            if (!decoded.mfa_pending) {
                throw new AppError('Token temporaire invalide', 401, 'INVALID_TEMP_TOKEN');
            }

            // Verify MFA code
            await authService.verifyMFACode(decoded.userId, code);

            // Get updated user data
            const { data: user, error } = await supabase.auth.admin.getUserById(decoded.userId);
            if (error || !user) {
                throw new AppError('Utilisateur non trouvé', 404, 'USER_NOT_FOUND');
            }

            // Generate full access token
            const token = authService.generateJWT(user.user);

            res.json({
                message: 'Authentification multi-facteurs réussie',
                user: {
                    id: user.user.id,
                    email: user.user.email,
                    firstName: user.user.user_metadata?.firstName,
                    lastName: user.user.user_metadata?.lastName,
                    role: user.user.user_metadata?.role || 'user',
                    permissions: user.user.user_metadata?.permissions || authService.getRolePermissions('user')
                },
                token
            });

        } catch (error) {
            if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
                throw new AppError('Token temporaire invalide ou expiré', 401, 'INVALID_TEMP_TOKEN');
            }
            throw error;
        }
    })
);

// Enable MFA for user
router.post('/mfa/enable',
    authMiddleware,
    [
        body('method').isIn(['email', 'sms']).withMessage('Méthode MFA invalide (email ou sms)')
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        const { method } = req.body;
        const userId = req.user.id;

        // Update user metadata to enable MFA
        const { error } = await supabase.auth.admin.updateUserById(userId, {
            user_metadata: {
                ...req.user,
                mfa_enabled: true,
                mfa_method: method,
                mfa_enabled_at: new Date().toISOString()
            }
        });

        if (error) {
            throw new AppError('Erreur lors de l\'activation de MFA', 500, 'MFA_ENABLE_ERROR');
        }

        res.json({
            message: 'Authentification multi-facteurs activée avec succès',
            method
        });
    })
);

// Disable MFA for user
router.post('/mfa/disable',
    authMiddleware,
    asyncHandler(async (req, res) => {
        const userId = req.user.id;

        // Update user metadata to disable MFA
        const { error } = await supabase.auth.admin.updateUserById(userId, {
            user_metadata: {
                ...req.user,
                mfa_enabled: false,
                mfa_method: null,
                mfa_disabled_at: new Date().toISOString()
            }
        });

        if (error) {
            throw new AppError('Erreur lors de la désactivation de MFA', 500, 'MFA_DISABLE_ERROR');
        }

        res.json({
            message: 'Authentification multi-facteurs désactivée avec succès'
        });
    })
);

// Get user profile
router.get('/profile',
    authMiddleware,
    asyncHandler(async (req, res) => {
        res.json({
            user: {
                id: req.user.id,
                email: req.user.email,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                phone: req.user.phone,
                role: req.user.role,
                permissions: req.user.permissions,
                mfaEnabled: req.user.mfaEnabled || false
            }
        });
    })
);

// Update user role (admin only)
router.put('/users/:userId/role',
    authMiddleware,
    requireRole(['admin']),
    [
        body('role').isIn(['admin', 'lawyer', 'user', 'guest']).withMessage('Rôle invalide'),
        body('permissions').optional().isArray().withMessage('Les permissions doivent être un tableau')
    ],
    validateRequest,
    asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const { role, permissions = [] } = req.body;

        const result = await authService.updateUserRole(userId, role, permissions);

        res.json({
            message: 'Rôle utilisateur mis à jour avec succès',
            userId,
            ...result
        });
    })
);

// Revoke user session (admin only)
router.post('/users/:userId/revoke-session',
    authMiddleware,
    requireRole(['admin']),
    asyncHandler(async (req, res) => {
        const { userId } = req.params;
        const { sessionId } = req.body;

        await authService.revokeSession(userId, sessionId);

        res.json({
            message: 'Session utilisateur révoquée avec succès',
            userId
        });
    })
);

module.exports = router;