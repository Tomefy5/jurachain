// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.HEDERA_ACCOUNT_ID = '0.0.123456';
process.env.HEDERA_PRIVATE_KEY = 'test-private-key';
process.env.POLYGON_RPC_URL = 'https://test-rpc.com';
process.env.POLYGON_PRIVATE_KEY = 'test-polygon-key';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.OLLAMA_URL = 'http://localhost:11434';

const request = require('supertest');
const CollaborativeService = require('../services/collaborativeService');

describe('Collaborative Editing System', () => {
    let authToken;
    let testDocumentId;
    let collaborativeService;

    beforeAll(async () => {
        collaborativeService = new CollaborativeService();

        // Mock authentication token for testing
        authToken = 'Bearer test-jwt-token';
    });

    describe('CollaborativeService', () => {
        test('should create collaborative service instance', () => {
            expect(collaborativeService).toBeDefined();
            expect(collaborativeService.activeDocuments).toBeDefined();
            expect(collaborativeService.documentSessions).toBeDefined();
        });

        test('should track active documents', () => {
            const documentId = 'test-doc-123';
            const userId = 'test-user-123';

            // Mock document session
            const documentSession = {
                id: 'session-123',
                googleDocId: 'google-doc-123',
                localDocumentId: documentId,
                title: 'Test Document',
                createdBy: userId,
                collaborators: new Set([userId]),
                createdAt: new Date(),
                lastActivity: new Date(),
                status: 'active'
            };

            collaborativeService.activeDocuments.set(documentId, documentSession);

            expect(collaborativeService.activeDocuments.has(documentId)).toBe(true);
            expect(collaborativeService.activeDocuments.get(documentId).title).toBe('Test Document');
        });

        test('should get active collaborators', () => {
            const documentId = 'test-doc-123';
            const userId = 'test-user-123';
            const sessionId = 'session-123';

            // Mock user session
            collaborativeService.documentSessions.set(sessionId, {
                documentId: documentId,
                userId: userId,
                socketId: 'socket-123',
                joinedAt: new Date()
            });

            const collaborators = collaborativeService.getActiveCollaborators(documentId);

            expect(collaborators).toBeDefined();
            expect(Array.isArray(collaborators)).toBe(true);
            expect(collaborators.length).toBe(1);
            expect(collaborators[0].userId).toBe(userId);
        });

        test('should notify collaborators', () => {
            const documentId = 'test-doc-123';
            const notification = {
                message: 'Test notification',
                type: 'info'
            };

            const notifiedUsers = collaborativeService.notifyCollaborators(
                documentId,
                notification,
                'exclude-user-123'
            );

            expect(notifiedUsers).toBeDefined();
            expect(Array.isArray(notifiedUsers)).toBe(true);
        });

        test('should cleanup inactive sessions', () => {
            const initialSize = collaborativeService.activeDocuments.size;

            // This should not throw an error
            expect(() => {
                collaborativeService.cleanupInactiveSessions(0.01); // 0.01 minutes = 0.6 seconds
            }).not.toThrow();
        });
    });

    describe('Service Integration', () => {
        test('should have required methods for Google Docs integration', () => {
            expect(typeof collaborativeService.createCollaborativeDocument).toBe('function');
            expect(typeof collaborativeService.joinCollaborativeSession).toBe('function');
            expect(typeof collaborativeService.leaveCollaborativeSession).toBe('function');
            expect(typeof collaborativeService.getDocumentContent).toBe('function');
            expect(typeof collaborativeService.updateDocumentContent).toBe('function');
            expect(typeof collaborativeService.getDocumentHistory).toBe('function');
        });

        test('should handle session management', () => {
            expect(collaborativeService.activeDocuments).toBeInstanceOf(Map);
            expect(collaborativeService.documentSessions).toBeInstanceOf(Map);
        });

        test('should support cleanup operations', () => {
            expect(typeof collaborativeService.cleanupInactiveSessions).toBe('function');

            // Test cleanup doesn't throw errors
            expect(() => {
                collaborativeService.cleanupInactiveSessions(30);
            }).not.toThrow();
        });
    });
});

describe('Real-time Features', () => {
    test('should support auto-save functionality', () => {
        const collaborativeService = new CollaborativeService();

        // Test that auto-save related methods exist
        expect(typeof collaborativeService.updateDocumentContent).toBe('function');
        expect(typeof collaborativeService.getDocumentContent).toBe('function');
    });

    test('should support notification system', () => {
        const collaborativeService = new CollaborativeService();

        // Test that notification methods exist
        expect(typeof collaborativeService.notifyCollaborators).toBe('function');
    });

    test('should support session management', () => {
        const collaborativeService = new CollaborativeService();

        // Test that session management methods exist
        expect(typeof collaborativeService.joinCollaborativeSession).toBe('function');
        expect(typeof collaborativeService.leaveCollaborativeSession).toBe('function');
        expect(typeof collaborativeService.getActiveCollaborators).toBe('function');
    });
});