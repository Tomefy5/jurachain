const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const BlockchainService = require('../services/blockchainService');
const { config, validateConfig } = require('../config/blockchain');

const router = express.Router();

// Initialize blockchain service for health checks
let blockchainService = null;

// Health check for blockchain services
router.get('/status',
    asyncHandler(async (req, res) => {
        try {
            // Valider la configuration
            const configErrors = validateConfig();

            if (configErrors.length > 0) {
                return res.status(503).json({
                    success: false,
                    status: 'unhealthy',
                    message: 'Configuration blockchain invalide',
                    errors: configErrors,
                    timestamp: new Date()
                });
            }

            // Initialiser le service si nécessaire
            if (!blockchainService) {
                blockchainService = new BlockchainService();
                await new Promise(resolve => setTimeout(resolve, 2000)); // Attendre l'initialisation
            }

            const status = blockchainService.getStatus();
            const isHealthy = status.hedera.connected || status.polygon.connected;

            res.status(isHealthy ? 200 : 503).json({
                success: isHealthy,
                status: isHealthy ? 'healthy' : 'unhealthy',
                services: status,
                primaryService: status.primaryService,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('Erreur health check blockchain:', error);
            res.status(503).json({
                success: false,
                status: 'unhealthy',
                message: 'Erreur lors de la vérification des services blockchain',
                error: error.message,
                timestamp: new Date()
            });
        }
    })
);

// Test de signature blockchain
router.post('/test-signature',
    asyncHandler(async (req, res) => {
        try {
            if (!blockchainService) {
                blockchainService = new BlockchainService();
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Créer une signature de test
            const testSignature = {
                documentId: 'test-document-id',
                signerId: 'test-user-id',
                signerEmail: 'test@example.com',
                timestamp: new Date()
            };

            const startTime = Date.now();
            const blockchainRecord = await blockchainService.recordSignature(testSignature);
            const processingTime = Date.now() - startTime;

            res.json({
                success: true,
                message: 'Test de signature blockchain réussi',
                blockchainRecord,
                processingTime,
                network: blockchainRecord.network,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('Erreur test signature:', error);
            res.status(500).json({
                success: false,
                message: 'Échec du test de signature blockchain',
                error: error.message,
                timestamp: new Date()
            });
        }
    })
);

// Test de génération de preuve
router.post('/test-proof',
    asyncHandler(async (req, res) => {
        try {
            if (!blockchainService) {
                blockchainService = new BlockchainService();
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Créer un document de test
            const testDocument = {
                id: 'test-document-id',
                content: 'Contenu de test pour la génération de preuve cryptographique',
                parties: [
                    { name: 'Test User', email: 'test@example.com' }
                ]
            };

            const startTime = Date.now();
            const proof = await blockchainService.generateProof(testDocument);
            const processingTime = Date.now() - startTime;

            res.json({
                success: true,
                message: 'Test de génération de preuve réussi',
                proof,
                processingTime,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('Erreur test preuve:', error);
            res.status(500).json({
                success: false,
                message: 'Échec du test de génération de preuve',
                error: error.message,
                timestamp: new Date()
            });
        }
    })
);

// Configuration blockchain (sans données sensibles)
router.get('/config',
    asyncHandler(async (req, res) => {
        const safeConfig = {
            hedera: {
                network: config.hedera.network,
                enabled: config.hedera.enabled,
                hasAccountId: !!config.hedera.accountId,
                hasPrivateKey: !!config.hedera.privateKey,
                hasTopicId: !!config.hedera.topicId
            },
            polygon: {
                network: config.polygon.network,
                rpcUrl: config.polygon.rpcUrl,
                enabled: config.polygon.enabled,
                hasPrivateKey: !!config.polygon.privateKey
            },
            general: {
                primaryService: config.general.primaryService,
                fallbackEnabled: config.general.fallbackEnabled,
                supportedNetworks: config.general.supportedNetworks,
                supportedHashAlgorithms: config.general.supportedHashAlgorithms,
                defaultHashAlgorithm: config.general.defaultHashAlgorithm
            }
        };

        res.json({
            success: true,
            config: safeConfig,
            timestamp: new Date()
        });
    })
);

// Métriques blockchain
router.get('/metrics',
    asyncHandler(async (req, res) => {
        try {
            if (!blockchainService) {
                return res.json({
                    success: true,
                    metrics: {
                        initialized: false,
                        message: 'Service blockchain non initialisé'
                    },
                    timestamp: new Date()
                });
            }

            const status = blockchainService.getStatus();

            // Métriques basiques (dans une vraie implémentation, ces données viendraient d'une base de données)
            const metrics = {
                initialized: true,
                services: {
                    hedera: {
                        connected: status.hedera.connected,
                        network: status.hedera.network,
                        topicId: status.hedera.topicId
                    },
                    polygon: {
                        connected: status.polygon.connected,
                        network: status.polygon.network
                    }
                },
                primaryService: status.primaryService,
                // Ces métriques seraient calculées à partir de données réelles
                stats: {
                    totalSignatures: 0,
                    totalProofs: 0,
                    successRate: 100,
                    averageProcessingTime: 0
                }
            };

            res.json({
                success: true,
                metrics,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('Erreur métriques blockchain:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des métriques',
                error: error.message,
                timestamp: new Date()
            });
        }
    })
);

module.exports = router;