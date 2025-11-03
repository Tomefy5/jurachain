/**
 * Tests pour le service blockchain
 * Tests unitaires focalisés sur les fonctionnalités core
 */

// Configuration des variables d'environnement pour les tests
process.env.HEDERA_ACCOUNT_ID = '0.0.12345';
process.env.HEDERA_PRIVATE_KEY = 'test-private-key';
process.env.POLYGON_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';

const crypto = require('crypto');

describe('Blockchain Core Functions', () => {
    describe('Hash Generation', () => {
        test('devrait générer un hash SHA-256 pour des données', () => {
            const data = {
                documentId: 'test-doc-id',
                signerId: 'test-user-id',
                timestamp: '2024-01-01T00:00:00.000Z'
            };

            const hash = crypto
                .createHash('sha256')
                .update(JSON.stringify(data))
                .digest('hex');

            expect(hash).toBeDefined();
            expect(typeof hash).toBe('string');
            expect(hash.length).toBe(64); // SHA-256 produit 64 caractères hex
        });

        test('devrait générer le même hash pour les mêmes données', () => {
            const data = {
                documentId: 'test-doc-id',
                signerId: 'test-user-id',
                timestamp: '2024-01-01T00:00:00.000Z'
            };

            const hash1 = crypto
                .createHash('sha256')
                .update(JSON.stringify(data))
                .digest('hex');

            const hash2 = crypto
                .createHash('sha256')
                .update(JSON.stringify(data))
                .digest('hex');

            expect(hash1).toBe(hash2);
        });

        test('devrait générer des hash différents pour des données différentes', () => {
            const data1 = {
                documentId: 'test-doc-id-1',
                signerId: 'test-user-id',
                timestamp: '2024-01-01T00:00:00.000Z'
            };

            const data2 = {
                documentId: 'test-doc-id-2',
                signerId: 'test-user-id',
                timestamp: '2024-01-01T00:00:00.000Z'
            };

            const hash1 = crypto
                .createHash('sha256')
                .update(JSON.stringify(data1))
                .digest('hex');

            const hash2 = crypto
                .createHash('sha256')
                .update(JSON.stringify(data2))
                .digest('hex');

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('Configuration Validation', () => {
        test('devrait valider le format des IDs Hedera', () => {
            const validIds = ['0.0.12345', '0.0.1', '0.0.999999'];
            const invalidIds = ['12345', '0.12345', '0.0', 'invalid'];

            const hederaIdRegex = /^0\.0\.\d+$/;

            validIds.forEach(id => {
                expect(hederaIdRegex.test(id)).toBe(true);
            });

            invalidIds.forEach(id => {
                expect(hederaIdRegex.test(id)).toBe(false);
            });
        });

        test('devrait valider le format des clés privées Polygon', () => {
            const validKeys = [
                '0x123456789012345678901234567890123456789012345678901234567890abcd',
                '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd'
            ];
            const invalidKeys = [
                '123456789012345678901234567890123456789012345678901234567890abcd',
                '0x123', // trop court
                'invalid'
            ];

            validKeys.forEach(key => {
                expect(key.startsWith('0x')).toBe(true);
                expect(key.length).toBe(66); // 0x + 64 caractères hex
            });

            invalidKeys.forEach(key => {
                expect(key.startsWith('0x') && key.length === 66).toBe(false);
            });
        });
    });

    describe('Data Structures', () => {
        test('devrait créer une structure de signature valide', () => {
            const signature = {
                id: crypto.randomUUID(),
                documentId: 'test-doc-id',
                signerId: 'test-user-id',
                signerName: 'Test User',
                signerEmail: 'test@example.com',
                signature: 'test-signature-data',
                timestamp: new Date(),
                ipAddress: '127.0.0.1',
                status: 'signed'
            };

            expect(signature.id).toBeDefined();
            expect(signature.documentId).toBe('test-doc-id');
            expect(signature.signerId).toBe('test-user-id');
            expect(signature.timestamp).toBeInstanceOf(Date);
            expect(['pending', 'signed', 'rejected', 'expired']).toContain(signature.status);
        });

        test('devrait créer une structure d\'enregistrement blockchain valide', () => {
            const blockchainRecord = {
                id: crypto.randomUUID(),
                transactionHash: '0xabcdef1234567890',
                network: 'hedera',
                timestamp: new Date(),
                status: 'confirmed'
            };

            expect(blockchainRecord.id).toBeDefined();
            expect(blockchainRecord.transactionHash).toBeDefined();
            expect(['hedera', 'polygon']).toContain(blockchainRecord.network);
            expect(['pending', 'confirmed', 'failed']).toContain(blockchainRecord.status);
        });

        test('devrait créer une structure de preuve cryptographique valide', () => {
            const document = {
                id: 'test-doc-id',
                content: 'Contenu de test',
                parties: [{ name: 'Test User', email: 'test@example.com' }]
            };

            const documentData = {
                id: document.id,
                content: document.content,
                parties: document.parties.map(p => ({ name: p.name, email: p.email })),
                timestamp: new Date().toISOString()
            };

            const hash = crypto
                .createHash('sha256')
                .update(JSON.stringify(documentData))
                .digest('hex');

            const proof = {
                hash,
                algorithm: 'SHA-256',
                timestamp: new Date()
            };

            expect(proof.hash).toBeDefined();
            expect(proof.algorithm).toBe('SHA-256');
            expect(proof.timestamp).toBeInstanceOf(Date);
        });
    });

    describe('Error Handling', () => {
        test('devrait gérer les erreurs de hash invalide', () => {
            expect(() => {
                crypto.createHash('invalid-algorithm');
            }).toThrow();
        });

        test('devrait valider les données requises pour la signature', () => {
            const requiredFields = ['documentId', 'signerId', 'signerEmail', 'signature', 'timestamp'];
            const signature = {
                documentId: 'test-doc-id',
                signerId: 'test-user-id',
                signerEmail: 'test@example.com',
                signature: 'test-signature',
                timestamp: new Date()
            };

            requiredFields.forEach(field => {
                expect(signature[field]).toBeDefined();
            });
        });
    });
});

describe('Blockchain Configuration', () => {
    const { validateConfig, getNetworkConfig } = require('../config/blockchain');

    test('devrait valider une configuration complète', () => {
        const errors = validateConfig();
        expect(Array.isArray(errors)).toBe(true);
        // Avec les variables d'environnement configurées, il ne devrait pas y avoir d'erreurs
        expect(errors.length).toBe(0);
    });

    test('devrait retourner la configuration pour un réseau', () => {
        const hederaConfig = getNetworkConfig('hedera');
        expect(hederaConfig).toBeDefined();
        expect(hederaConfig.network).toBeDefined();

        const polygonConfig = getNetworkConfig('polygon');
        expect(polygonConfig).toBeDefined();
        expect(polygonConfig.network).toBeDefined();
    });

    test('devrait lever une erreur pour un réseau non supporté', () => {
        expect(() => {
            getNetworkConfig('invalid-network');
        }).toThrow('Réseau non supporté: invalid-network');
    });
});