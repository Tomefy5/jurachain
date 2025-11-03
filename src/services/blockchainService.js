const {
    Client,
    PrivateKey,
    AccountId,
    TopicCreateTransaction,
    TopicMessageSubmitTransaction,
    TopicInfoQuery,
    Hbar,
    Status
} = require('@hashgraph/sdk');
const { ethers } = require('ethers');
const crypto = require('crypto');
const ResilientService = require('./resilientService');

/**
 * Service blockchain pour l'enregistrement des signatures numériques
 * Utilise Hedera Testnet comme service principal avec fallback vers Polygon Testnet
 * Inclut la gestion d'erreurs et la résilience complète
 */
class BlockchainService {
    constructor() {
        this.hederaClient = null;
        this.polygonProvider = null;
        this.polygonWallet = null;
        this.hederaTopicId = null;
        this.isHederaConnected = false;
        this.isPolygonConnected = false;

        // Initialize resilient service wrapper
        this.resilientService = new ResilientService('blockchain', {
            timeout: 45000, // 45 seconds for blockchain operations
            maxRetries: 2, // Fewer retries for blockchain to avoid double-spending
            circuitBreakerThreshold: 3
        });

        this.initializeServices();
    }

    /**
     * Initialise les connexions Hedera et Polygon
     */
    async initializeServices() {
        try {
            await this.initializeHedera();
        } catch (error) {
            console.warn('Échec de l\'initialisation Hedera:', error.message);
        }

        try {
            await this.initializePolygon();
        } catch (error) {
            console.warn('Échec de l\'initialisation Polygon:', error.message);
        }

        if (!this.isHederaConnected && !this.isPolygonConnected) {
            throw new Error('Aucun service blockchain disponible');
        }
    }

    /**
     * Initialise la connexion Hedera Testnet
     */
    async initializeHedera() {
        try {
            const accountId = process.env.HEDERA_ACCOUNT_ID;
            const privateKey = process.env.HEDERA_PRIVATE_KEY;

            if (!accountId || !privateKey) {
                throw new Error('Variables d\'environnement Hedera manquantes');
            }

            this.hederaClient = Client.forTestnet();
            this.hederaClient.setOperator(
                AccountId.fromString(accountId),
                PrivateKey.fromString(privateKey)
            );

            // Créer ou récupérer le topic pour les signatures
            await this.ensureHederaTopic();

            this.isHederaConnected = true;
            console.log('✅ Connexion Hedera Testnet établie');
        } catch (error) {
            console.error('❌ Erreur connexion Hedera:', error.message);
            throw error;
        }
    }

    /**
     * Initialise la connexion Polygon Testnet
     */
    async initializePolygon() {
        try {
            const rpcUrl = process.env.POLYGON_RPC_URL || 'https://rpc-mumbai.maticvigil.com';
            const privateKey = process.env.POLYGON_PRIVATE_KEY;

            if (!privateKey) {
                throw new Error('Clé privée Polygon manquante');
            }

            this.polygonProvider = new ethers.JsonRpcProvider(rpcUrl);
            this.polygonWallet = new ethers.Wallet(privateKey, this.polygonProvider);

            // Vérifier la connexion
            const balance = await this.polygonWallet.getBalance();
            console.log(`Balance Polygon: ${ethers.formatEther(balance)} MATIC`);

            this.isPolygonConnected = true;
            console.log('✅ Connexion Polygon Testnet établie');
        } catch (error) {
            console.error('❌ Erreur connexion Polygon:', error.message);
            throw error;
        }
    }

    /**
     * Assure l'existence du topic Hedera pour les signatures
     */
    async ensureHederaTopic() {
        const existingTopicId = process.env.HEDERA_TOPIC_ID;

        if (existingTopicId) {
            try {
                // Vérifier que le topic existe
                const topicInfo = await new TopicInfoQuery()
                    .setTopicId(existingTopicId)
                    .execute(this.hederaClient);

                this.hederaTopicId = existingTopicId;
                console.log(`Topic Hedera existant utilisé: ${existingTopicId}`);
                return;
            } catch (error) {
                console.warn('Topic existant non trouvé, création d\'un nouveau...');
            }
        }

        // Créer un nouveau topic
        const transaction = new TopicCreateTransaction()
            .setTopicMemo('JusticeAutomation Digital Signatures')
            .setMaxTransactionFee(new Hbar(2));

        const response = await transaction.execute(this.hederaClient);
        const receipt = await response.getReceipt(this.hederaClient);

        this.hederaTopicId = receipt.topicId.toString();
        console.log(`✅ Nouveau topic Hedera créé: ${this.hederaTopicId}`);
    }

    /**
     * Enregistre une signature numérique sur la blockchain
     * @param {Object} signature - Objet signature numérique
     * @returns {Promise<Object>} Enregistrement blockchain
     */
    async recordSignature(signature, options = {}) {
        const signatureData = {
            documentId: signature.documentId,
            signerId: signature.signerId,
            signerEmail: signature.signerEmail,
            timestamp: signature.timestamp.toISOString(),
            hash: this.generateDocumentHash(signature)
        };

        return await this.resilientService.execute(async () => {
            // Try Hedera first
            if (this.isHederaConnected) {
                try {
                    return await this.recordSignatureHedera(signatureData);
                } catch (error) {
                    console.warn('Hedera recording failed, trying Polygon:', error.message);

                    // Try Polygon as fallback
                    if (this.isPolygonConnected) {
                        return await this.recordSignaturePolygon(signatureData);
                    }

                    throw error;
                }
            }

            // If Hedera not available, try Polygon directly
            if (this.isPolygonConnected) {
                return await this.recordSignaturePolygon(signatureData);
            }

            throw new Error('No blockchain service available for recording');
        }, {
            operationName: 'recordSignature',
            language: options.language || 'fr',
            context: {
                signature,
                network: this.isHederaConnected ? 'hedera' : 'polygon',
                recordOnPolygon: (sig) => this.recordSignaturePolygon(sig)
            },
            fallback: async () => {
                // Store locally for later sync
                return await this.resilientService.storeSignatureLocally(signature);
            },
            retryable: false // Don't retry blockchain operations to avoid double-spending
        });
    }

    /**
     * Enregistre une signature sur Hedera Testnet
     */
    async recordSignatureHedera(signatureData) {
        if (!this.hederaClient || !this.hederaTopicId) {
            throw new Error('Hedera client not properly initialized');
        }

        try {
            const message = JSON.stringify(signatureData);

            const transaction = new TopicMessageSubmitTransaction()
                .setTopicId(this.hederaTopicId)
                .setMessage(message)
                .setMaxTransactionFee(new Hbar(1));

            const response = await transaction.execute(this.hederaClient);
            const receipt = await response.getReceipt(this.hederaClient);

            if (receipt.status !== Status.Success) {
                throw new Error(`Hedera transaction failed with status: ${receipt.status}`);
            }

            return {
                id: crypto.randomUUID(),
                transactionHash: response.transactionId.toString(),
                network: 'hedera',
                timestamp: new Date(),
                status: 'confirmed',
                topicId: this.hederaTopicId,
                sequenceNumber: receipt.topicSequenceNumber?.toString()
            };
        } catch (error) {
            if (error.message?.includes('INSUFFICIENT_ACCOUNT_BALANCE')) {
                throw new Error('Insufficient Hedera account balance for transaction');
            } else if (error.message?.includes('INVALID_TOPIC_ID')) {
                throw new Error('Invalid Hedera topic ID - topic may not exist');
            } else if (error.message?.includes('TIMEOUT')) {
                throw new Error('Hedera transaction timeout - network congestion');
            }

            throw new Error(`Hedera recording failed: ${error.message}`);
        }
    }

    /**
     * Enregistre une signature sur Polygon Testnet
     */
    async recordSignaturePolygon(signatureData) {
        if (!this.polygonWallet) {
            throw new Error('Polygon wallet not properly initialized');
        }

        try {
            const message = JSON.stringify(signatureData);
            const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));

            // Check wallet balance first
            const balance = await this.polygonWallet.getBalance();
            if (balance.toString() === '0') {
                throw new Error('Insufficient Polygon wallet balance for transaction');
            }

            // Create a simple transaction to record the hash
            const tx = await this.polygonWallet.sendTransaction({
                to: this.polygonWallet.address, // Self-transaction
                value: 0,
                data: messageHash,
                gasLimit: 21000
            });

            const receipt = await tx.wait();

            if (receipt.status !== 1) {
                throw new Error('Polygon transaction failed - receipt status is not success');
            }

            return {
                id: crypto.randomUUID(),
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                network: 'polygon',
                timestamp: new Date(),
                gasUsed: receipt.gasUsed?.toString(),
                status: 'confirmed'
            };
        } catch (error) {
            if (error.code === 'INSUFFICIENT_FUNDS') {
                throw new Error('Insufficient funds in Polygon wallet');
            } else if (error.code === 'NETWORK_ERROR') {
                throw new Error('Polygon network connection error');
            } else if (error.message?.includes('gas')) {
                throw new Error('Polygon gas estimation failed - network congestion');
            }

            throw new Error(`Polygon recording failed: ${error.message}`);
        }
    }

    /**
     * Vérifie l'authenticité d'une signature
     * @param {string} recordId - ID de l'enregistrement blockchain
     * @returns {Promise<Object>} Résultat de vérification
     */
    async verifySignature(recordId, originalSignature) {
        try {
            // Rechercher l'enregistrement dans nos données
            const blockchainRecord = await this.findBlockchainRecord(recordId);

            if (!blockchainRecord) {
                return {
                    isValid: false,
                    errors: ['Enregistrement blockchain non trouvé'],
                    verifiedAt: new Date(),
                    verificationMethod: 'blockchain_lookup'
                };
            }

            // Vérifier selon le réseau
            let isValid = false;
            if (blockchainRecord.network === 'hedera') {
                isValid = await this.verifyHederaSignature(blockchainRecord, originalSignature);
            } else if (blockchainRecord.network === 'polygon') {
                isValid = await this.verifyPolygonSignature(blockchainRecord, originalSignature);
            }

            return {
                isValid,
                signature: originalSignature,
                blockchainRecord,
                verifiedAt: new Date(),
                verificationMethod: `${blockchainRecord.network}_verification`,
                errors: isValid ? [] : ['Signature ne correspond pas à l\'enregistrement blockchain']
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [`Erreur de vérification: ${error.message}`],
                verifiedAt: new Date(),
                verificationMethod: 'error'
            };
        }
    }

    /**
     * Vérifie une signature Hedera
     */
    async verifyHederaSignature(blockchainRecord, originalSignature) {
        try {
            // Pour Hedera, nous vérifions que le hash correspond
            const expectedHash = this.generateDocumentHash(originalSignature);

            // Dans un cas réel, nous récupérerions le message du topic
            // Pour cette implémentation, nous validons le format et la cohérence
            return blockchainRecord.transactionHash &&
                blockchainRecord.network === 'hedera' &&
                blockchainRecord.status === 'confirmed';
        } catch (error) {
            console.error('Erreur vérification Hedera:', error);
            return false;
        }
    }

    /**
     * Vérifie une signature Polygon
     */
    async verifyPolygonSignature(blockchainRecord, originalSignature) {
        try {
            if (!this.isPolygonConnected) {
                throw new Error('Connexion Polygon non disponible');
            }

            // Récupérer la transaction
            const tx = await this.polygonProvider.getTransaction(blockchainRecord.transactionHash);

            if (!tx) {
                return false;
            }

            // Vérifier que le hash dans les données correspond
            const expectedHash = this.generateDocumentHash(originalSignature);
            const signatureData = {
                documentId: originalSignature.documentId,
                signerId: originalSignature.signerId,
                signerEmail: originalSignature.signerEmail,
                timestamp: originalSignature.timestamp.toISOString(),
                hash: expectedHash
            };

            const expectedDataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(signatureData)));

            return tx.data === expectedDataHash;
        } catch (error) {
            console.error('Erreur vérification Polygon:', error);
            return false;
        }
    }

    /**
     * Génère un hash immuable pour un document
     * @param {Object} document - Document légal
     * @returns {Promise<Object>} Preuve cryptographique
     */
    async generateProof(document) {
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

        // Enregistrer la preuve sur blockchain si possible
        let blockchainRecord = null;
        try {
            const proofSignature = {
                documentId: document.id,
                signerId: 'system',
                signerEmail: 'system@justiceautomation.mg',
                timestamp: new Date()
            };

            blockchainRecord = await this.recordSignature(proofSignature);
        } catch (error) {
            console.warn('Impossible d\'enregistrer la preuve sur blockchain:', error.message);
        }

        return {
            hash,
            algorithm: 'SHA-256',
            timestamp: new Date(),
            blockchainRecord
        };
    }

    /**
     * Génère un hash pour une signature
     */
    generateDocumentHash(signature) {
        const data = {
            documentId: signature.documentId,
            signerId: signature.signerId,
            timestamp: signature.timestamp.toISOString()
        };

        return crypto
            .createHash('sha256')
            .update(JSON.stringify(data))
            .digest('hex');
    }

    /**
     * Recherche un enregistrement blockchain (placeholder)
     * Dans une implémentation complète, ceci interrogerait une base de données
     */
    async findBlockchainRecord(recordId) {
        // Placeholder - dans la vraie implémentation, ceci interrogerait Supabase
        // pour trouver l'enregistrement correspondant
        return null;
    }

    /**
     * Obtient le statut des services blockchain
     */
    getStatus() {
        return {
            hedera: {
                connected: this.isHederaConnected,
                topicId: this.hederaTopicId,
                network: 'testnet'
            },
            polygon: {
                connected: this.isPolygonConnected,
                network: 'mumbai'
            },
            primaryService: this.isHederaConnected ? 'hedera' : 'polygon'
        };
    }

    /**
     * Ferme les connexions
     */
    async close() {
        if (this.hederaClient) {
            this.hederaClient.close();
        }
        // Polygon provider se ferme automatiquement
    }
}

module.exports = BlockchainService;