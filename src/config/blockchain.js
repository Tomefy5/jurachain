/**
 * Configuration pour les services blockchain
 * Hedera Testnet et Polygon Testnet
 */

const config = {
    // Configuration Hedera Testnet
    hedera: {
        network: process.env.HEDERA_NETWORK || 'testnet',
        accountId: process.env.HEDERA_ACCOUNT_ID,
        privateKey: process.env.HEDERA_PRIVATE_KEY,
        topicId: process.env.HEDERA_TOPIC_ID,
        maxTransactionFee: 2, // Hbar
        maxRetries: 3,
        retryDelay: 1000, // ms
        timeout: 30000, // ms
        enabled: !!(process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY)
    },

    // Configuration Polygon Testnet (Mumbai)
    polygon: {
        network: process.env.POLYGON_NETWORK || 'mumbai',
        rpcUrl: process.env.POLYGON_RPC_URL || 'https://rpc-mumbai.maticvigil.com',
        privateKey: process.env.POLYGON_PRIVATE_KEY,
        gasLimit: 21000,
        maxRetries: 3,
        retryDelay: 1000, // ms
        timeout: 30000, // ms
        enabled: !!process.env.POLYGON_PRIVATE_KEY
    },

    // Configuration générale
    general: {
        primaryService: 'hedera', // Service principal
        fallbackEnabled: true,
        maxTotalRetries: 5,
        signatureTimeout: 60000, // 1 minute
        verificationTimeout: 30000, // 30 secondes
        proofTimeout: 45000, // 45 secondes

        // Algorithmes de hash supportés
        supportedHashAlgorithms: ['SHA-256', 'SHA-512', 'KECCAK-256'],
        defaultHashAlgorithm: 'SHA-256',

        // Réseaux supportés
        supportedNetworks: ['hedera', 'polygon'],

        // Statuts de transaction
        transactionStatuses: ['pending', 'confirmed', 'failed'],

        // Types de signature
        signatureTypes: ['digital', 'electronic'],

        // Monitoring
        enableMetrics: true,
        enableLogging: true,
        logLevel: process.env.LOG_LEVEL || 'info'
    },

    // URLs des explorateurs blockchain
    explorers: {
        hedera: {
            testnet: 'https://hashscan.io/testnet',
            mainnet: 'https://hashscan.io/mainnet'
        },
        polygon: {
            mumbai: 'https://mumbai.polygonscan.com',
            mainnet: 'https://polygonscan.com'
        }
    },

    // Messages d'erreur
    errorMessages: {
        CONNECTION_FAILED: 'Échec de connexion au service blockchain',
        TRANSACTION_FAILED: 'Échec de la transaction blockchain',
        VERIFICATION_FAILED: 'Échec de la vérification de signature',
        INVALID_SIGNATURE: 'Signature invalide',
        NETWORK_UNAVAILABLE: 'Réseau blockchain indisponible',
        INSUFFICIENT_BALANCE: 'Solde insuffisant pour la transaction',
        TIMEOUT: 'Timeout de la transaction blockchain',
        INVALID_HASH: 'Hash de document invalide',
        RECORD_NOT_FOUND: 'Enregistrement blockchain non trouvé'
    },

    // Validation des paramètres
    validation: {
        maxSignatureLength: 10000,
        maxDocumentSize: 50 * 1024 * 1024, // 50MB
        minHashLength: 32,
        maxHashLength: 128,
        maxRetries: 10,
        minTimeout: 5000,
        maxTimeout: 300000 // 5 minutes
    }
};

/**
 * Valide la configuration blockchain
 */
function validateConfig() {
    const errors = [];

    // Vérifier qu'au moins un service est configuré
    if (!config.hedera.enabled && !config.polygon.enabled) {
        errors.push('Aucun service blockchain configuré. Configurez au moins Hedera ou Polygon.');
    }

    // Vérifier la configuration Hedera si activée
    if (config.hedera.enabled) {
        if (!config.hedera.accountId) {
            errors.push('HEDERA_ACCOUNT_ID manquant');
        }
        if (!config.hedera.privateKey) {
            errors.push('HEDERA_PRIVATE_KEY manquant');
        }
        if (config.hedera.accountId && !config.hedera.accountId.match(/^0\.0\.\d+$/)) {
            errors.push('Format HEDERA_ACCOUNT_ID invalide (attendu: 0.0.xxxxx)');
        }
    }

    // Vérifier la configuration Polygon si activée
    if (config.polygon.enabled) {
        if (!config.polygon.privateKey) {
            errors.push('POLYGON_PRIVATE_KEY manquant');
        }
        if (config.polygon.privateKey && !config.polygon.privateKey.startsWith('0x')) {
            errors.push('POLYGON_PRIVATE_KEY doit commencer par 0x');
        }
        if (!config.polygon.rpcUrl.startsWith('http')) {
            errors.push('POLYGON_RPC_URL invalide');
        }
    }

    return errors;
}

/**
 * Obtient la configuration pour un réseau spécifique
 */
function getNetworkConfig(network) {
    switch (network) {
        case 'hedera':
            return config.hedera;
        case 'polygon':
            return config.polygon;
        default:
            throw new Error(`Réseau non supporté: ${network}`);
    }
}

/**
 * Obtient l'URL de l'explorateur pour une transaction
 */
function getExplorerUrl(network, transactionHash) {
    const networkConfig = getNetworkConfig(network);
    const explorerConfig = config.explorers[network];

    if (!explorerConfig) {
        return null;
    }

    const baseUrl = explorerConfig[networkConfig.network];
    if (!baseUrl) {
        return null;
    }

    switch (network) {
        case 'hedera':
            return `${baseUrl}/transaction/${transactionHash}`;
        case 'polygon':
            return `${baseUrl}/tx/${transactionHash}`;
        default:
            return null;
    }
}

/**
 * Obtient le service blockchain primaire disponible
 */
function getPrimaryService() {
    if (config.general.primaryService === 'hedera' && config.hedera.enabled) {
        return 'hedera';
    }
    if (config.general.primaryService === 'polygon' && config.polygon.enabled) {
        return 'polygon';
    }

    // Fallback au premier service disponible
    if (config.hedera.enabled) {
        return 'hedera';
    }
    if (config.polygon.enabled) {
        return 'polygon';
    }

    throw new Error('Aucun service blockchain disponible');
}

module.exports = {
    config,
    validateConfig,
    getNetworkConfig,
    getExplorerUrl,
    getPrimaryService
};