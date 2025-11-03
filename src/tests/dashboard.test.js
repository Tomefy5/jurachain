/**
 * Dashboard Service Tests
 * Tests for user document tracking, status management, and analytics integration
 */

// Set up environment variables before importing modules
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.ANALYTICS_SERVICE_URL = 'http://localhost:8000';

const request = require('supertest');
const DashboardService = require('../services/dashboardService');

// Mock Supabase
jest.mock('../database/index.ts', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    order: jest.fn(() => ({
                        data: [],
                        error: null
                    })),
                    single: jest.fn(() => ({
                        data: {
                            id: 'test-doc-id',
                            status: 'draft',
                            title: 'Test Document',
                            created_by: 'test-user-id'
                        },
                        error: null
                    }))
                }))
            })),
            update: jest.fn(() => ({
                eq: jest.fn(() => ({
                    select: jest.fn(() => ({
                        single: jest.fn(() => ({
                            data: {
                                id: 'test-doc-id',
                                status: 'signed',
                                title: 'Test Document',
                                type: 'contract'
                            },
                            error: null
                        }))
                    }))
                }))
            })),
            insert: jest.fn(() => ({
                error: null
            }))
        }))
    }
}));

// Mock axios for analytics service
jest.mock('axios', () => ({
    get: jest.fn(() => Promise.resolve({
        data: {
            documents: { total: 5, successful: 4, failed: 1, avg_generation_time: 2.5 },
            blockchain: { total_transactions: 3, successful_transactions: 3, avg_transaction_time: 1.2 }
        }
    })),
    post: jest.fn(() => Promise.resolve({ data: { message: 'Event recorded' } }))
}));

describe('Dashboard Service', () => {
    let dashboardService;
    let mockUser;

    beforeEach(() => {
        dashboardService = new DashboardService();
        mockUser = {
            id: 'test-user-id',
            email: 'test@example.com',
            role: 'user'
        };
        jest.clearAllMocks();
    });

    describe('getUserDashboard', () => {
        test('should return user dashboard data successfully', async () => {
            const result = await dashboardService.getUserDashboard(mockUser.id);

            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty('documents');
            expect(result.data).toHaveProperty('statistics');
            expect(result.data).toHaveProperty('analytics');
            expect(result.data.statistics).toHaveProperty('total');
            expect(result.data.statistics).toHaveProperty('byStatus');
        });

        test('should calculate document statistics correctly', () => {
            const mockDocuments = [
                { status: 'draft', type: 'contract', language: 'fr', risk_assessments: [] },
                { status: 'signed', type: 'lease', language: 'mg', risk_assessments: [{ risk_level: 'low' }] },
                { status: 'archived', type: 'contract', language: 'fr', risk_assessments: [{ risk_level: 'high' }] }
            ];

            const stats = dashboardService.calculateDocumentStats(mockDocuments);

            expect(stats.total).toBe(3);
            expect(stats.byStatus.draft).toBe(1);
            expect(stats.byStatus.signed).toBe(1);
            expect(stats.byStatus.archived).toBe(1);
            expect(stats.byType.contract).toBe(2);
            expect(stats.byType.lease).toBe(1);
            expect(stats.byLanguage.fr).toBe(2);
            expect(stats.byLanguage.mg).toBe(1);
            expect(stats.riskSummary.low).toBe(1);
            expect(stats.riskSummary.high).toBe(1);
        });
    });

    describe('updateDocumentStatus', () => {
        test('should update document status successfully', async () => {
            const result = await dashboardService.updateDocumentStatus(
                'test-doc-id',
                'signed',
                mockUser.id
            );

            expect(result.success).toBe(true);
            expect(result.data.status).toBe('signed');
            expect(result.message).toContain('draft');
            expect(result.message).toContain('signed');
        });

        test('should reject unauthorized status update', async () => {
            // Mock unauthorized user
            const { supabase } = require('../database/index.ts');
            supabase.from().select().eq().single.mockReturnValueOnce({
                data: {
                    id: 'test-doc-id',
                    status: 'draft',
                    title: 'Test Document',
                    created_by: 'different-user-id'
                },
                error: null
            });

            const result = await dashboardService.updateDocumentStatus(
                'test-doc-id',
                'signed',
                mockUser.id
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unauthorized');
        });
    });

    describe('getStatusLabel', () => {
        test('should return correct French labels for statuses', () => {
            expect(dashboardService.getStatusLabel('draft')).toBe('Brouillon');
            expect(dashboardService.getStatusLabel('signed')).toBe('Signé');
            expect(dashboardService.getStatusLabel('archived')).toBe('Archivé');
            expect(dashboardService.getStatusLabel('unknown')).toBe('unknown');
        });
    });

    describe('recordAnalyticsEvent', () => {
        test('should record analytics event successfully', async () => {
            const axios = require('axios');

            await dashboardService.recordAnalyticsEvent(
                mockUser.id,
                'test-doc-id',
                'status_change',
                { old_status: 'draft', new_status: 'signed' }
            );

            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/events/document'),
                expect.objectContaining({
                    user_id: mockUser.id,
                    document_id: 'test-doc-id',
                    event_type: 'status_change'
                }),
                expect.any(Object)
            );
        });
    });
});

describe('Analytics Routes', () => {
    let mockUser;

    beforeEach(() => {
        mockUser = {
            id: 'test-user-id',
            email: 'test@example.com',
            role: 'user'
        };
    });

    describe('GET /api/analytics/dashboard', () => {
        test('should return dashboard data for authenticated user', async () => {
            // Mock authentication middleware
            const mockAuth = (req, res, next) => {
                req.user = mockUser;
                next();
            };

            const response = await request(app)
                .get('/api/analytics/dashboard')
                .set('Authorization', 'Bearer mock-token')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('documents');
            expect(response.body.data).toHaveProperty('statistics');
        });
    });

    describe('PUT /api/analytics/documents/:id/status', () => {
        test('should update document status successfully', async () => {
            const mockAuth = (req, res, next) => {
                req.user = mockUser;
                next();
            };

            const response = await request(app)
                .put('/api/analytics/documents/test-doc-id/status')
                .set('Authorization', 'Bearer mock-token')
                .send({ status: 'signed' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('signed');
        });

        test('should reject invalid status', async () => {
            const mockAuth = (req, res, next) => {
                req.user = mockUser;
                next();
            };

            const response = await request(app)
                .put('/api/analytics/documents/test-doc-id/status')
                .set('Authorization', 'Bearer mock-token')
                .send({ status: 'invalid_status' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Statut invalide');
        });
    });
});