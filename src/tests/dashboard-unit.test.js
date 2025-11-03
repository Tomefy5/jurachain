/**
 * Dashboard Service Unit Tests
 * Focused unit tests for dashboard functionality
 */

// Set up environment variables
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.ANALYTICS_SERVICE_URL = 'http://localhost:8000';

const DashboardService = require('../services/dashboardService');

// Mock axios
jest.mock('axios', () => ({
    get: jest.fn(() => Promise.resolve({
        data: {
            documents: { total: 5, successful: 4, failed: 1, avg_generation_time: 2.5 },
            blockchain: { total_transactions: 3, successful_transactions: 3, avg_transaction_time: 1.2 }
        }
    })),
    post: jest.fn(() => Promise.resolve({ data: { message: 'Event recorded' } }))
}));

describe('Dashboard Service Unit Tests', () => {
    let dashboardService;

    beforeEach(() => {
        dashboardService = new DashboardService();
        jest.clearAllMocks();
    });

    describe('calculateDocumentStats', () => {
        test('should calculate statistics for empty document list', () => {
            const stats = dashboardService.calculateDocumentStats([]);

            expect(stats.total).toBe(0);
            expect(stats.byStatus.draft).toBe(0);
            expect(stats.byStatus.signed).toBe(0);
            expect(stats.byType).toEqual({});
            expect(stats.byLanguage).toEqual({});
            expect(stats.riskSummary.low).toBe(0);
            expect(stats.recentActivity).toEqual([]);
        });

        test('should calculate statistics correctly for multiple documents', () => {
            const mockDocuments = [
                {
                    id: '1',
                    status: 'draft',
                    type: 'contract',
                    language: 'fr',
                    title: 'Contract 1',
                    updated_at: new Date().toISOString(),
                    risk_assessments: [{ risk_level: 'low' }]
                },
                {
                    id: '2',
                    status: 'signed',
                    type: 'lease',
                    language: 'mg',
                    title: 'Lease 1',
                    updated_at: new Date().toISOString(),
                    risk_assessments: [{ risk_level: 'high' }, { risk_level: 'medium' }]
                },
                {
                    id: '3',
                    status: 'archived',
                    type: 'contract',
                    language: 'fr',
                    title: 'Contract 2',
                    updated_at: '2020-01-01T00:00:00Z', // Old date
                    risk_assessments: []
                }
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
            expect(stats.riskSummary.high).toBe(1); // Highest risk level for document 2
            expect(stats.recentActivity).toHaveLength(2); // Only recent documents
        });

        test('should handle documents with no risk assessments', () => {
            const mockDocuments = [
                {
                    id: '1',
                    status: 'draft',
                    type: 'contract',
                    language: 'fr',
                    title: 'Contract 1',
                    updated_at: new Date().toISOString(),
                    risk_assessments: []
                }
            ];

            const stats = dashboardService.calculateDocumentStats(mockDocuments);

            expect(stats.total).toBe(1);
            expect(stats.riskSummary.low).toBe(0);
            expect(stats.riskSummary.medium).toBe(0);
            expect(stats.riskSummary.high).toBe(0);
            expect(stats.riskSummary.critical).toBe(0);
        });
    });

    describe('getStatusLabel', () => {
        test('should return correct French labels for all statuses', () => {
            expect(dashboardService.getStatusLabel('draft')).toBe('Brouillon');
            expect(dashboardService.getStatusLabel('in_review')).toBe('En révision');
            expect(dashboardService.getStatusLabel('pending_signature')).toBe('En attente de signature');
            expect(dashboardService.getStatusLabel('signed')).toBe('Signé');
            expect(dashboardService.getStatusLabel('archived')).toBe('Archivé');
            expect(dashboardService.getStatusLabel('cancelled')).toBe('Annulé');
        });

        test('should return original status for unknown statuses', () => {
            expect(dashboardService.getStatusLabel('unknown_status')).toBe('unknown_status');
            expect(dashboardService.getStatusLabel('')).toBe('');
            expect(dashboardService.getStatusLabel(null)).toBe(null);
        });
    });

    describe('recordAnalyticsEvent', () => {
        test('should call analytics service with correct parameters', async () => {
            const axios = require('axios');

            await dashboardService.recordAnalyticsEvent(
                'user-123',
                'doc-456',
                'status_change',
                { old_status: 'draft', new_status: 'signed' }
            );

            expect(axios.post).toHaveBeenCalledWith(
                'http://localhost:8000/events/document',
                {
                    user_id: 'user-123',
                    document_id: 'doc-456',
                    event_type: 'status_change',
                    status: 'success',
                    metadata: { old_status: 'draft', new_status: 'signed' }
                },
                { timeout: 3000 }
            );
        });

        test('should handle analytics service errors gracefully', async () => {
            const axios = require('axios');
            axios.post.mockRejectedValueOnce(new Error('Service unavailable'));

            // Should not throw error
            await expect(
                dashboardService.recordAnalyticsEvent('user-123', 'doc-456', 'test_event')
            ).resolves.toBeUndefined();
        });
    });
});

describe('Dashboard Service Integration', () => {
    test('should initialize with correct analytics service URL', () => {
        const service = new DashboardService();
        expect(service.analyticsServiceUrl).toBe('http://localhost:8000');
    });

    test('should use default analytics service URL when env var not set', () => {
        const originalUrl = process.env.ANALYTICS_SERVICE_URL;
        delete process.env.ANALYTICS_SERVICE_URL;

        const service = new DashboardService();
        expect(service.analyticsServiceUrl).toBe('http://analytics:8000');

        // Restore original value
        process.env.ANALYTICS_SERVICE_URL = originalUrl;
    });
});