// Setup test environment
require('./setup');

const authService = require('../services/authService');
const securityConfig = require('../config/security');

describe('Authentication Service', () => {
    describe('Password Validation', () => {
        test('should validate strong password', () => {
            const result = authService.validatePasswordStrength('StrongPass123!');
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should reject weak password', () => {
            const result = authService.validatePasswordStrength('weak');
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('JWT Token Management', () => {
        test('should generate valid JWT token', () => {
            const mockUser = {
                id: 'test-user-id',
                email: 'test@example.com',
                user_metadata: {
                    role: 'user',
                    permissions: ['documents:read:own']
                }
            };

            const token = authService.generateJWT(mockUser);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
        });

        test('should verify valid JWT token', () => {
            const mockUser = {
                id: 'test-user-id',
                email: 'test@example.com',
                user_metadata: {
                    role: 'user',
                    permissions: ['documents:read:own']
                }
            };

            const token = authService.generateJWT(mockUser);
            const decoded = authService.verifyJWT(token);

            expect(decoded.userId).toBe(mockUser.id);
            expect(decoded.email).toBe(mockUser.email);
            expect(decoded.role).toBe('user');
        });
    });

    describe('Permission Management', () => {
        test('should check permissions correctly', () => {
            const userPermissions = ['documents:read:own', 'documents:create'];

            expect(authService.hasPermission(userPermissions, 'documents:read:own')).toBe(true);
            expect(authService.hasPermission(userPermissions, 'documents:create')).toBe(true);
            expect(authService.hasPermission(userPermissions, 'documents:delete')).toBe(false);
        });

        test('should handle wildcard permissions', () => {
            const adminPermissions = ['admin:*'];

            expect(authService.hasPermission(adminPermissions, 'documents:create')).toBe(true);
            expect(authService.hasPermission(adminPermissions, 'users:delete')).toBe(true);
        });

        test('should get role permissions', () => {
            const userPermissions = authService.getRolePermissions('user');
            const adminPermissions = authService.getRolePermissions('admin');

            expect(userPermissions).toContain('documents:create');
            expect(adminPermissions).toContain('admin:*');
        });
    });

    describe('MFA Code Generation', () => {
        test('should generate valid MFA code', () => {
            const { code, expiresAt } = authService.generateMFACode();

            expect(code).toBeDefined();
            expect(code).toMatch(/^\d{6}$/); // 6 digits
            expect(expiresAt).toBeInstanceOf(Date);
            expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
        });
    });
});

// Mock Supabase client to avoid actual API calls
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
        auth: {
            admin: {
                createUser: jest.fn(),
                getUserById: jest.fn(),
                updateUserById: jest.fn(),
                signOut: jest.fn()
            },
            signInWithPassword: jest.fn(),
            getUser: jest.fn(),
            refreshSession: jest.fn(),
            resetPasswordForEmail: jest.fn(),
            updateUser: jest.fn()
        }
    }))
}));