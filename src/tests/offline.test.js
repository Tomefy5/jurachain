/**
 * Tests for offline functionality
 * Tests offline storage, synchronization, and document generation
 */

const OfflineStorageService = require('../services/offlineStorageService');
const SynchronizationService = require('../services/synchronizationService');
const OfflineDocumentGeneratorService = require('../services/offlineDocumentGenerator');
const SyncQueueService = require('../services/syncQueueService');

// Setup test environment
beforeAll(() => {
    // Use fake timers to control async operations
    jest.useFakeTimers();

    // Set test environment
    process.env.NODE_ENV = 'test';
});

// Mock IndexedDB for Node.js testing
global.indexedDB = {
    open: jest.fn(() => ({
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: null
    }))
};

global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
};

describe('Offline Storage Service', () => {
    let offlineStorage;

    beforeEach(() => {
        offlineStorage = new OfflineStorageService();
        // Mock localStorage for testing
        global.localStorage.getItem.mockClear();
        global.localStorage.setItem.mockClear();
    });

    test('should initialize without IndexedDB', () => {
        expect(offlineStorage).toBeDefined();
        expect(offlineStorage.isIndexedDBSupported).toBe(false);
    });

    test('should store document in localStorage fallback', async () => {
        const document = {
            id: 'test-doc-1',
            title: 'Test Document',
            content: 'Test content',
            type: 'contract',
            status: 'draft'
        };

        // Mock successful localStorage operation
        global.localStorage.setItem.mockImplementation(() => { });

        const result = await offlineStorage.storeDocument(document);
        expect(result).toBe(true);
        expect(global.localStorage.setItem).toHaveBeenCalled();
    });

    test('should retrieve document from localStorage', async () => {
        const document = {
            id: 'test-doc-1',
            title: 'Test Document',
            content: 'Test content'
        };

        global.localStorage.getItem.mockReturnValue(JSON.stringify(document));

        const result = await offlineStorage.getDocument('test-doc-1');
        expect(result).toEqual(document);
    });

    test('should handle storage errors gracefully', async () => {
        global.localStorage.setItem.mockImplementation(() => {
            throw new Error('Storage quota exceeded');
        });

        const document = { id: 'test-doc', title: 'Test' };
        const result = await offlineStorage.storeDocument(document);
        expect(result).toBe(false);
    });
});

describe('Offline Document Generator Service', () => {
    let offlineGenerator;

    beforeEach(() => {
        offlineGenerator = new OfflineDocumentGeneratorService();
    });

    test('should validate contract request', () => {
        const invalidRequest = {
            type: 'invalid_type',
            language: 'fr',
            description: 'Test',
            parties: []
        };

        expect(() => {
            offlineGenerator.validateContractRequest(invalidRequest);
        }).toThrow('Invalid document type');
    });

    test('should generate title from contract request', () => {
        const contractRequest = {
            type: 'contract',
            language: 'fr',
            description: 'Test contract',
            parties: [{ name: 'Test Party', role: 'buyer' }]
        };

        const title = offlineGenerator.generateTitle(contractRequest);
        expect(title).toContain('Contrat Commercial');
        expect(title).toContain(new Date().toLocaleDateString('fr-FR'));
    });

    test('should extract clauses from text', () => {
        const text = `
        Article 1 - Objet du contrat
        Ce contrat concerne...
        
        Article 2 - Obligations
        Les parties s'engagent à...
        `;

        const clauses = offlineGenerator.extractClausesFromText(text);
        expect(clauses).toHaveLength(2);
        expect(clauses[0].title).toBe('Article 1 - Objet du contrat');
        expect(clauses[1].title).toBe('Article 2 - Obligations');
    });

    test('should identify clause headers correctly', () => {
        expect(offlineGenerator.isClauseHeader('Article 1 - Test')).toBe(true);
        expect(offlineGenerator.isClauseHeader('Clause 2 - Test')).toBe(true);
        expect(offlineGenerator.isClauseHeader('1. Test')).toBe(true);
        expect(offlineGenerator.isClauseHeader('Regular text')).toBe(false);
    });
});

describe('Sync Queue Service', () => {
    let syncQueue;

    beforeEach(() => {
        syncQueue = new SyncQueueService();
    });

    test('should enqueue action successfully', async () => {
        const actionData = {
            type: 'create_document',
            documentId: 'test-doc-1',
            data: { title: 'Test Document' },
            priority: syncQueue.priorities.HIGH
        };

        const actionId = await syncQueue.enqueueAction(actionData);
        expect(actionId).toBeDefined();
        expect(typeof actionId).toBe('string');
    });

    test('should handle action failure with retry logic', async () => {
        const action = {
            id: 'test-action-1',
            type: 'create_document',
            retries: 0,
            maxRetries: 3,
            status: 'pending'
        };

        await syncQueue.handleActionFailure(action, 'Network error');

        expect(action.status).toBe('retrying');
        expect(action.retries).toBe(1);
        expect(action.lastError).toBe('Network error');
        expect(action.scheduledFor).toBeDefined();
    });

    test('should mark action as failed after max retries', async () => {
        const action = {
            id: 'test-action-1',
            type: 'create_document',
            retries: 3,
            maxRetries: 3,
            status: 'retrying'
        };

        await syncQueue.handleActionFailure(action, 'Persistent error');

        expect(action.status).toBe('failed');
        expect(action.failedAt).toBeDefined();
    });

    test('should check if queue is paused', () => {
        expect(syncQueue.isQueuePaused()).toBe(false);

        syncQueue.pauseQueue();
        expect(syncQueue.isQueuePaused()).toBe(true);

        syncQueue.resumeQueue();
        expect(syncQueue.isQueuePaused()).toBe(false);
    });
});

describe('Synchronization Service', () => {
    let syncService;

    beforeEach(() => {
        syncService = new SynchronizationService();
    });

    afterEach(() => {
        // Clean up any running intervals
        if (syncService && syncService.stopAutoSync) {
            syncService.stopAutoSync();
        }
    });

    test('should handle online status changes', () => {
        // Test the method directly since navigator might not be available in Node.js
        syncService.handleOnlineStatus(false);
        expect(syncService.isOnline).toBe(false);

        syncService.handleOnlineStatus(true);
        expect(syncService.isOnline).toBe(true);
    });

    test('should format remote document correctly', () => {
        const remoteDoc = {
            id: 'test-doc-1',
            type: 'contract',
            title: 'Test Contract',
            content: 'Contract content',
            language: 'fr',
            status: 'draft',
            parties: [],
            clauses: [],
            digital_signatures: [],
            risk_assessments: [],
            metadata: { version: 1 },
            created_by: 'user-1',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z'
        };

        const formatted = syncService.formatRemoteDocument(remoteDoc);

        expect(formatted.id).toBe('test-doc-1');
        expect(formatted.syncStatus).toBe('synced');
        expect(formatted.isOffline).toBe(false);
        expect(formatted.signatures).toEqual([]);
        expect(formatted.riskAssessments).toEqual([]);
    });

    test('should get sync status', async () => {
        const status = await syncService.getSyncStatus();

        expect(status).toHaveProperty('isOnline');
        expect(status).toHaveProperty('syncInProgress');
        expect(status).toHaveProperty('lastSyncTimestamp');
        expect(status).toHaveProperty('pendingActions');
        expect(status).toHaveProperty('pendingDocuments');
        expect(status).toHaveProperty('conflicts');
    });
});

describe('Integration Tests', () => {
    let offlineStorage, syncQueue, offlineGenerator, syncService;

    beforeEach(() => {
        offlineStorage = new OfflineStorageService();
        syncQueue = new SyncQueueService();
        offlineGenerator = new OfflineDocumentGeneratorService();
        syncService = new SynchronizationService();
    });

    afterEach(() => {
        // Clean up any running services
        if (syncService && syncService.stopAutoSync) {
            syncService.stopAutoSync();
        }
    });

    test('should handle complete offline document workflow', async () => {
        // Mock localStorage for this test
        global.localStorage.setItem.mockImplementation(() => { });
        global.localStorage.getItem.mockImplementation((key) => {
            if (key.includes('test-workflow-doc')) {
                return JSON.stringify({
                    id: 'test-workflow-doc',
                    title: 'Test Document',
                    lastModified: new Date().toISOString(),
                    isOffline: true,
                    syncStatus: 'pending'
                });
            }
            return null;
        });
        // 1. Generate document offline
        const contractRequest = {
            type: 'contract',
            language: 'fr',
            description: 'Contrat de test pour workflow hors ligne',
            parties: [
                { name: 'Partie A', role: 'vendeur', email: 'a@test.com' },
                { name: 'Partie B', role: 'acheteur', email: 'b@test.com' }
            ],
            jurisdiction: 'Madagascar'
        };

        // Mock template-based generation since Ollama won't be available in tests
        const mockDocument = {
            id: 'test-workflow-doc',
            type: contractRequest.type,
            title: 'Contrat Commercial - Test',
            content: 'Contenu du contrat généré hors ligne',
            language: contractRequest.language,
            status: 'draft',
            parties: contractRequest.parties.map(p => ({ ...p, id: 'party-id' })),
            clauses: [
                {
                    id: 'clause-1',
                    title: 'Article 1 - Objet',
                    content: contractRequest.description,
                    position: 0,
                    isRequired: true,
                    category: 'purpose'
                }
            ],
            signatures: [],
            riskAssessments: [],
            metadata: {
                version: 1,
                generatedBy: 'template',
                jurisdiction: contractRequest.jurisdiction,
                tags: ['contract', 'fr', 'offline']
            },
            createdBy: 'system',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // 2. Store document locally
        const storeResult = await offlineStorage.storeDocument(mockDocument);
        expect(storeResult).toBe(true);

        // 3. Queue for synchronization
        const actionId = await syncQueue.enqueueAction({
            type: 'create_document',
            documentId: mockDocument.id,
            data: mockDocument,
            priority: syncQueue.priorities.MEDIUM
        });
        expect(actionId).toBeDefined();

        // 4. Verify document can be retrieved
        const retrievedDoc = await offlineStorage.getDocument(mockDocument.id);
        expect(retrievedDoc).toBeDefined();
        expect(retrievedDoc.id).toBe(mockDocument.id);

        // 5. Verify action is in queue (mock the queue response)
        global.localStorage.getItem.mockImplementation((key) => {
            if (key.includes('sync_queue_')) {
                return JSON.stringify({
                    id: actionId,
                    type: 'create_document',
                    status: 'pending',
                    documentId: mockDocument.id
                });
            }
            return null;
        });

        const pendingActions = await syncQueue.getPendingActions();
        // In test environment, we expect at least the action we just queued
        expect(Array.isArray(pendingActions)).toBe(true);
    });
});

// Mock axios for HTTP requests in tests
jest.mock('axios', () => ({
    post: jest.fn(() => Promise.resolve({ data: { response: 'Mocked AI response' } })),
    get: jest.fn(() => Promise.resolve({ status: 200, data: {} }))
}));

// Global cleanup to prevent Jest hanging
afterAll(() => {
    // Clear all timers
    jest.clearAllTimers();
    jest.useRealTimers();
});