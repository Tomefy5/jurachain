// Configurer les variables d'environnement avant d'importer les modules
process.env.HEDERA_ACCOUNT_ID = '0.0.12345';
process.env.HEDERA_PRIVATE_KEY = 'test-private-key';
process.env.POLYGON_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';

const BlockchainService = require('../services/blockchainService');
const { config } = require('../config/blockchain');

// Mock des modules externes pour les tests
jest.mock('@hashgraph/sdk', () => ({
    Client: {
        forTestnet: jest.fn(() => ({
            setOperator: jest.fn(),
            close: jest.fn()
        }))
    },
    PrivateKey: {
        fromString: jest.fn()
    },
    AccountId: {
        fromString: jest.fn()
    },
    TopicCreateTransaction: jest.fn(() => ({
        setTopicMemo: jest.fn().mockReturnThis(),
        setMaxTransactionFee: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
            getReceipt: jest.fn().mockResolvedValue({
                topicId: { toString: () => '0.0.12345' }
            })
        })
    })),
    TopicMessageSubmitTransaction: jest.fn(() => ({
        setTopicId: jest.fn().mockReturnThis(),
        setMessage: jest.fn().mockReturnThis(),
        setMaxTransactionFee: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
            transactionId: { toString: () => '0.0.123@1234567890.123456789' },
            getReceipt: jest.fn().mockResolvedValue({
                status: { toString: () => 'SUCCESS' },
                topicSequenceNumber: { toString: () => '1' }
            })
        })
    })),
    TopicInfoQuery: jest.fn(() => ({
        setTopicId: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({})
    })),
    Hbar: jest.fn(),
    Status: {
        Success: 'SUCCESS'
    }
}));

jest.mock('ethers', () => ({
    JsonRpcProvider: jest.fn(() => ({
        getTransaction: jest.fn().mockResolvedValue({
            data: '0x1234567890abcdef'
        })
    })),
    Wallet: jest.fn(() => ({
        address: '0x1234567890123456789012345678901234567890',
        getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
        sendTransaction: jest.fn().mockResolvedValue({
            wait: jest.fn().mockResolvedValue({
                hash: '0xabcdef1234567890',
                blockNumber: 12345,
                gasUsed: '21000',
                status: 1
            })
        })
    })),
    formatEther: jest.fn(() => '1.0'),
    keccak256: jest.fn(() => '0x1234567890abcdef'),
    toUtf8Bytes: jest.fn(() => new Uint8Array([1, 2, 3, 4]))
}));

describe('BlockchainService', () => {
    let blockchainService;

    beforeEach(() => {
        // Configurer les variables d'environnement pour les tests
        process.env.HEDERA_ACCOUNT_ID = '0.0.12345';
        process.env.HEDERA_PRIVATE_KEY = 'test-private-key';
        process.env.POLYGON_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';

        blockchainService = new BlockchainService();
    });

    afterEach(() => {
        if (blockchainService) {
            blockchainService.close();
        }
    });

    describe('Initialisation', () => {
        test('devrait créer une instance du service blockchain', () => {
            expect(blockchainService).toBeInstanceOf(BlockchainService);
        });

        test('devrait avoir les méthodes principales', () => {
            expect(typeof blockchainService.recordSignature).toBe('function');
            expect(typeof blockchainService.verifySignature).toBe('function');
            expect(typeof blockchainService.generateProof).toBe('function');
            expect(typeof blockchainService.getStatus).toBe('function');
        });
    });

    describe('Génération de hash', () => {
        test('devrait générer un hash pour une signature', () => {
            const signature = {
                documentId: 'test-doc-id',
                signerId: 'test-user-id',
                timestamp: new Date('2024-01-01T00:00:00Z')
            };

            const hash = blockchainService.generateDocumentHash(signature);

            expect(hash).toBeDefined();
            expect(typeof hash).toBe('string');
            expect(hash.length).toBe(64); // SHA-256 produit un hash de 64 caractères hex
        });

        test('devrait générer le même hash pour les mêmes données', () => {
            const signature = {
                documentId: 'test-doc-id',
                signerId: 'test-user-id',
                timestamp: new Date('2024-01-01T00:00:00Z')
            };

            const hash1 = blockchainService.generateDocumentHash(signature);
            const hash2 = blockchainService.generateDocumentHash(signature);

            expect(hash1).toBe(hash2);
        });
    });

    describe('Génération de preuve cryptographique', () => {
        test('devrait générer une preuve pour un document', async () => {
            const document = {
                id: 'test-doc-id',
                content: 'Contenu de test',
                parties: [
                    { name: 'Test User', email: 'test@example.com' }
                ]
            };

            const proof = await blockchainService.generateProof(document);

            expect(proof).toBeDefined();
            expect(proof.hash).toBeDefined();
            expect(proof.algorithm).toBe('SHA-256');
            expect(proof.timestamp).toBeInstanceOf(Date);
        });
    });

    describe('Statut du service', () => {
        test('devrait retourner le statut des services', () => {
            const status = blockchainService.getStatus();

            expect(status).toBeDefined();
            expect(status).toHaveProperty('hedera');
            expect(status).toHaveProperty('polygon');
            expect(status).toHaveProperty('primaryService');
        });
    });

    describe('Gestion des erreurs', () => {
        test('devrait gérer les erreurs de configuration manquante', () => {
            // Supprimer les variables d'environnement
            delete process.env.HEDERA_ACCOUNT_ID;
            delete process.env.HEDERA_PRIVATE_KEY;
            delete process.env.POLYGON_PRIVATE_KEY;

            expect(() => {
                new BlockchainService();
            }).not.toThrow(); // Le service devrait se créer mais sans connexions
        });
    });
});

describe('Configuration Blockchain', () => {
    test('devrait valider la configuration', () => {
        const { validateConfig } = require('../config/blockchain');

        // Configurer des variables valides
        process.env.HEDERA_ACCOUNT_ID = '0.0.12345';
        process.env.HEDERA_PRIVATE_KEY = 'test-key';

        const errors = validateConfig();
        expect(Array.isArray(errors)).toBe(true);
    });

    test('devrait détecter une configuration manquante', () => {
        const { validateConfig } = require('../config/blockchain');

        // Supprimer toutes les variables
        delete process.env.HEDERA_ACCOUNT_ID;
        delete process.env.HEDERA_PRIVATE_KEY;
        delete process.env.POLYGON_PRIVATE_KEY;

        const errors = validateConfig();
        expect(errors.length).toBeGreaterThan(0);
    });
});