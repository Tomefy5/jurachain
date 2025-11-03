const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class AuthService {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        this.jwtSecret = process.env.JWT_SECRET;
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
        this.mfaCodeExpiry = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Generate JWT token with enhanced claims
     */
    generateJWT(user, sessionId = null) {
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.user_metadata?.role || 'user',
            permissions: user.user_metadata?.permissions || [],
            sessionId: sessionId || crypto.randomUUID(),
            iat: Math.floor(Date.now() / 1000)
        };

        return jwt.sign(payload, this.jwtSecret, {
            expiresIn: this.jwtExpiresIn,
            issuer: 'justice-automation',
            audience: 'justice-automation-users'
        });
    }

    /**
     * Verify and decode JWT token
     */
    verifyJWT(token) {
        try {
            return jwt.verify(token, this.jwtSecret, {
                issuer: 'justice-automation',
                audience: 'justice-automation-users'
            });
        } catch (error) {
            throw new Error(`JWT verification failed: ${error.message}`);
        }
    }

    /**
     * Generate MFA code
     */
    generateMFACode() {
        return {
            code: crypto.randomInt(100000, 999999).toString(),
            expiresAt: new Date(Date.now() + this.mfaCodeExpiry)
        };
    }

    /**
     * Send MFA code via email
     */
    async sendMFACodeEmail(email, code) {
        try {
            // Using Supabase's built-in email service
            const { error } = await this.supabase.auth.admin.generateLink({
                type: 'magiclink',
                email: email,
                options: {
                    data: {
                        mfa_code: code,
                        purpose: 'mfa_verification'
                    }
                }
            });

            if (error) {
                throw new Error(`Failed to send MFA email: ${error.message}`);
            }

            return true;
        } catch (error) {
            console.error('MFA Email Error:', error);
            throw error;
        }
    }

    /**
     * Send MFA code via SMS (placeholder for SMS service integration)
     */
    async sendMFACodeSMS(phone, code) {
        try {
            // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
            console.log(`SMS MFA Code for ${phone}: ${code}`);

            // For now, we'll store the code in user metadata
            // In production, integrate with actual SMS service
            return true;
        } catch (error) {
            console.error('MFA SMS Error:', error);
            throw error;
        }
    }

    /**
     * Store MFA code in user metadata
     */
    async storeMFACode(userId, code, expiresAt, method) {
        try {
            const { error } = await this.supabase.auth.admin.updateUserById(userId, {
                user_metadata: {
                    mfa_code: code,
                    mfa_expires_at: expiresAt.toISOString(),
                    mfa_method: method,
                    mfa_attempts: 0
                }
            });

            if (error) {
                throw new Error(`Failed to store MFA code: ${error.message}`);
            }

            return true;
        } catch (error) {
            console.error('Store MFA Code Error:', error);
            throw error;
        }
    }

    /**
     * Verify MFA code
     */
    async verifyMFACode(userId, providedCode) {
        try {
            const { data: user, error } = await this.supabase.auth.admin.getUserById(userId);

            if (error || !user) {
                throw new Error('User not found');
            }

            const storedCode = user.user.user_metadata?.mfa_code;
            const expiresAt = user.user.user_metadata?.mfa_expires_at;
            const attempts = user.user.user_metadata?.mfa_attempts || 0;

            // Check if too many attempts
            if (attempts >= 3) {
                throw new Error('Too many MFA attempts. Please request a new code.');
            }

            // Check if code exists and hasn't expired
            if (!storedCode || !expiresAt) {
                throw new Error('No MFA code found. Please request a new code.');
            }

            if (new Date() > new Date(expiresAt)) {
                throw new Error('MFA code has expired. Please request a new code.');
            }

            // Verify code
            if (storedCode !== providedCode) {
                // Increment attempts
                await this.supabase.auth.admin.updateUserById(userId, {
                    user_metadata: {
                        ...user.user.user_metadata,
                        mfa_attempts: attempts + 1
                    }
                });
                throw new Error('Invalid MFA code');
            }

            // Clear MFA code after successful verification
            await this.supabase.auth.admin.updateUserById(userId, {
                user_metadata: {
                    ...user.user.user_metadata,
                    mfa_code: null,
                    mfa_expires_at: null,
                    mfa_method: null,
                    mfa_attempts: 0,
                    mfa_verified: true,
                    mfa_verified_at: new Date().toISOString()
                }
            });

            return true;
        } catch (error) {
            console.error('Verify MFA Code Error:', error);
            throw error;
        }
    }

    /**
     * Check if user has required permissions
     */
    hasPermission(userPermissions, requiredPermission) {
        if (!Array.isArray(userPermissions)) {
            return false;
        }

        // Admin role has all permissions
        if (userPermissions.includes('admin:*')) {
            return true;
        }

        // Check for specific permission or wildcard
        return userPermissions.some(permission => {
            if (permission === requiredPermission) {
                return true;
            }

            // Check wildcard permissions (e.g., 'documents:*' matches 'documents:create')
            if (permission.endsWith(':*')) {
                const permissionPrefix = permission.slice(0, -1);
                return requiredPermission.startsWith(permissionPrefix);
            }

            return false;
        });
    }

    /**
     * Get user role permissions
     */
    getRolePermissions(role) {
        const rolePermissions = {
            'admin': [
                'admin:*'
            ],
            'lawyer': [
                'documents:*',
                'blockchain:*',
                'analytics:read',
                'users:read'
            ],
            'user': [
                'documents:create',
                'documents:read:own',
                'documents:update:own',
                'documents:delete:own',
                'blockchain:sign:own',
                'analytics:read:own'
            ],
            'guest': [
                'documents:read:public'
            ]
        };

        return rolePermissions[role] || rolePermissions['guest'];
    }

    /**
     * Update user role and permissions
     */
    async updateUserRole(userId, newRole, additionalPermissions = []) {
        try {
            const basePermissions = this.getRolePermissions(newRole);
            const allPermissions = [...new Set([...basePermissions, ...additionalPermissions])];

            const { error } = await this.supabase.auth.admin.updateUserById(userId, {
                user_metadata: {
                    role: newRole,
                    permissions: allPermissions,
                    role_updated_at: new Date().toISOString()
                }
            });

            if (error) {
                throw new Error(`Failed to update user role: ${error.message}`);
            }

            return { role: newRole, permissions: allPermissions };
        } catch (error) {
            console.error('Update User Role Error:', error);
            throw error;
        }
    }

    /**
     * Revoke user session
     */
    async revokeSession(userId, sessionId = null) {
        try {
            // If specific session ID provided, we could maintain a blacklist
            // For now, we'll sign out the user from Supabase
            const { error } = await this.supabase.auth.admin.signOut(userId);

            if (error) {
                console.error('Session revocation error:', error);
            }

            return true;
        } catch (error) {
            console.error('Revoke Session Error:', error);
            throw error;
        }
    }

    /**
     * Validate password strength
     */
    validatePasswordStrength(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[@$!%*?&]/.test(password);

        const errors = [];

        if (password.length < minLength) {
            errors.push(`Le mot de passe doit contenir au moins ${minLength} caractères`);
        }

        if (!hasUpperCase) {
            errors.push('Le mot de passe doit contenir au moins une majuscule');
        }

        if (!hasLowerCase) {
            errors.push('Le mot de passe doit contenir au moins une minuscule');
        }

        if (!hasNumbers) {
            errors.push('Le mot de passe doit contenir au moins un chiffre');
        }

        if (!hasSpecialChar) {
            errors.push('Le mot de passe doit contenir au moins un caractère spécial (@$!%*?&)');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

module.exports = new AuthService();