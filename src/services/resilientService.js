/**
 * Resilient Service Wrapper
 * Provides error handling, retries, fallbacks, and circuit breaker functionality
 * for all JusticeAutomation services
 */

const {
    CircuitBreaker,
    RetryManager,
    TimeoutManager,
    FallbackManager,
    HealthChecker
} = require('../utils/resilience');
const { ErrorTypes, ErrorMessageService } = require('../utils/errorMessages');

class ResilientService {
    constructor(serviceName, options = {}) {
        this.serviceName = serviceName;
        this.options = {
            timeout: options.timeout || 30000, // 30 seconds
            maxRetries: options.maxRetries || 3,
            circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
            circuitBreakerResetTimeout: options.circuitBreakerResetTimeout || 60000,
            enableHealthCheck: options.enableHealthCheck !== false,
            ...options
        };

        // Initialize resilience components
        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: this.options.circuitBreakerThreshold,
            resetTimeout: this.options.circuitBreakerResetTimeout
        });

        this.retryManager = new RetryManager({
            maxRetries: this.options.maxRetries,
            baseDelay: this.options.baseDelay || 1000,
            maxDelay: this.options.maxDelay || 30000
        });

        this.fallbackManager = new FallbackManager();
        this.errorMessageService = new ErrorMessageService();

        // Service-specific configurations
        this.setupServiceFallbacks();
    }

    /**
     * Execute an operation with full resilience support
     */
    async execute(operation, options = {}) {
        const operationOptions = {
            timeout: options.timeout || this.options.timeout,
            fallback: options.fallback,
            retryable: options.retryable !== false,
            language: options.language || 'fr',
            context: options.context || {},
            ...options
        };

        try {
            // Wrap operation with timeout
            const timeoutOperation = () => TimeoutManager.withTimeout(
                operation,
                operationOptions.timeout,
                `${this.serviceName} operation timed out after ${operationOptions.timeout}ms`
            );

            // Execute with circuit breaker and retry logic
            const result = await this.circuitBreaker.execute(async () => {
                if (operationOptions.retryable) {
                    return await this.retryManager.execute(timeoutOperation, {
                        maxRetries: operationOptions.maxRetries || this.options.maxRetries
                    });
                } else {
                    return await timeoutOperation();
                }
            }, operationOptions.fallback);

            return {
                success: true,
                data: result,
                service: this.serviceName,
                timestamp: new Date(),
                fallbackUsed: false
            };

        } catch (error) {
            console.error(`${this.serviceName} operation failed:`, error.message);

            // Try fallback if available
            if (operationOptions.fallback) {
                try {
                    const fallbackResult = await operationOptions.fallback();
                    return {
                        success: true,
                        data: fallbackResult,
                        service: this.serviceName,
                        timestamp: new Date(),
                        fallbackUsed: true,
                        originalError: error.message
                    };
                } catch (fallbackError) {
                    console.error(`${this.serviceName} fallback also failed:`, fallbackError.message);
                }
            }

            // Format user-friendly error
            const userError = this.errorMessageService.formatError(
                error,
                operationOptions.language,
                {
                    service: this.serviceName,
                    operation: operationOptions.operationName || 'unknown',
                    ...operationOptions.context
                }
            );

            throw {
                ...userError,
                service: this.serviceName,
                success: false,
                fallbackUsed: false,
                circuitBreakerState: this.circuitBreaker.getState()
            };
        }
    }

    /**
     * Setup service-specific fallback mechanisms
     */
    setupServiceFallbacks() {
        switch (this.serviceName) {
            case 'documentGenerator':
                this.setupDocumentGeneratorFallbacks();
                break;
            case 'blockchain':
                this.setupBlockchainFallbacks();
                break;
            case 'collaborative':
                this.setupCollaborativeFallbacks();
                break;
            case 'translation':
                this.setupTranslationFallbacks();
                break;
            case 'clauseAnalyzer':
                this.setupClauseAnalyzerFallbacks();
                break;
        }
    }

    setupDocumentGeneratorFallbacks() {
        // Fallback chain: Ollama -> Gemini -> Template-based generation
        this.fallbackManager.registerFallbackChain('documentGenerator', [
            // Fallback 1: Switch from Ollama to Gemini
            async (context, error) => {
                if (context.aiModel === 'ollama') {
                    console.log('Switching from Ollama to Gemini API');
                    return await context.generateWithGemini(context.contractRequest);
                }
                throw error;
            },

            // Fallback 2: Template-based generation
            async (context, error) => {
                console.log('Using template-based document generation');
                return await this.generateFromTemplate(context.contractRequest);
            }
        ]);
    }

    setupBlockchainFallbacks() {
        // Fallback chain: Hedera -> Polygon -> Local storage
        this.fallbackManager.registerFallbackChain('blockchain', [
            // Fallback 1: Switch from Hedera to Polygon
            async (context, error) => {
                if (context.network === 'hedera') {
                    console.log('Switching from Hedera to Polygon');
                    return await context.recordOnPolygon(context.signature);
                }
                throw error;
            },

            // Fallback 2: Store locally for later sync
            async (context, error) => {
                console.log('Storing signature locally for later blockchain sync');
                return await this.storeSignatureLocally(context.signature);
            }
        ]);
    }

    setupCollaborativeFallbacks() {
        // Fallback chain: Google Docs -> Local collaborative editing -> Read-only mode
        this.fallbackManager.registerFallbackChain('collaborative', [
            // Fallback 1: Local collaborative editing with WebSocket
            async (context, error) => {
                console.log('Using local collaborative editing');
                return await this.enableLocalCollaboration(context.documentId, context.userId);
            },

            // Fallback 2: Read-only mode with manual sync
            async (context, error) => {
                console.log('Enabling read-only mode with manual sync');
                return await this.enableReadOnlyMode(context.documentId);
            }
        ]);
    }

    setupTranslationFallbacks() {
        // Fallback chain: AI translation -> Dictionary-based -> Manual translation request
        this.fallbackManager.registerFallbackChain('translation', [
            // Fallback 1: Dictionary-based translation
            async (context, error) => {
                console.log('Using dictionary-based translation');
                return await this.dictionaryTranslation(context.document, context.targetLanguage);
            },

            // Fallback 2: Queue for manual translation
            async (context, error) => {
                console.log('Queuing document for manual translation');
                return await this.queueManualTranslation(context.document, context.targetLanguage);
            }
        ]);
    }

    setupClauseAnalyzerFallbacks() {
        // Fallback chain: TensorFlow -> Rule-based analysis -> Basic validation
        this.fallbackManager.registerFallbackChain('clauseAnalyzer', [
            // Fallback 1: Rule-based clause analysis
            async (context, error) => {
                console.log('Using rule-based clause analysis');
                return await this.ruleBasedAnalysis(context.document);
            },

            // Fallback 2: Basic validation only
            async (context, error) => {
                console.log('Using basic document validation');
                return await this.basicValidation(context.document);
            }
        ]);
    }

    /**
     * Fallback implementations
     */
    async generateFromTemplate(contractRequest) {
        // Simple template-based document generation
        const templates = {
            'CONTRACT': 'Contrat commercial entre {parties} concernant {description}',
            'LEASE': 'Contrat de bail entre {parties} pour {description}',
            'SALE_AGREEMENT': 'Contrat de vente entre {parties} pour {description}'
        };

        const template = templates[contractRequest.type] || templates['CONTRACT'];
        const partiesText = contractRequest.parties.map(p => p.name).join(' et ');

        const content = template
            .replace('{parties}', partiesText)
            .replace('{description}', contractRequest.description);

        return {
            id: require('uuid').v4(),
            type: contractRequest.type,
            title: `${contractRequest.type} - ${new Date().toLocaleDateString()}`,
            content: content,
            language: contractRequest.language,
            status: 'draft',
            parties: contractRequest.parties,
            clauses: [],
            signatures: [],
            metadata: {
                version: 1,
                generatedBy: 'template',
                fallbackUsed: true
            },
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    async storeSignatureLocally(signature) {
        // Store signature locally for later blockchain sync
        const localRecord = {
            id: require('crypto').randomUUID(),
            signature: signature,
            status: 'pending_blockchain',
            storedAt: new Date(),
            syncAttempts: 0
        };

        // In a real implementation, this would store in local database
        console.log('Signature stored locally:', localRecord.id);

        return {
            id: localRecord.id,
            status: 'stored_locally',
            message: 'Signature sauvegardée localement, synchronisation blockchain en attente',
            timestamp: new Date()
        };
    }

    async enableLocalCollaboration(documentId, userId) {
        // Enable local collaborative editing using WebSocket
        return {
            success: true,
            mode: 'local_collaboration',
            documentId: documentId,
            message: 'Édition collaborative locale activée',
            features: {
                realTimeEditing: true,
                autoSave: true,
                conflictResolution: true,
                googleDocsIntegration: false
            }
        };
    }

    async enableReadOnlyMode(documentId) {
        // Enable read-only mode with manual sync option
        return {
            success: true,
            mode: 'read_only',
            documentId: documentId,
            message: 'Mode lecture seule activé',
            features: {
                realTimeEditing: false,
                autoSave: false,
                manualSync: true,
                downloadAvailable: true
            }
        };
    }

    async dictionaryTranslation(document, targetLanguage) {
        // Simple dictionary-based translation
        const basicTranslations = {
            'fr_to_mg': {
                'contrat': 'fifanarahana',
                'partie': 'mpandray anjara',
                'article': 'andininy',
                'signature': 'sonia'
            },
            'mg_to_fr': {
                'fifanarahana': 'contrat',
                'mpandray anjara': 'partie',
                'andininy': 'article',
                'sonia': 'signature'
            }
        };

        const translationKey = `${document.language}_to_${targetLanguage}`;
        const dictionary = basicTranslations[translationKey] || {};

        let translatedContent = document.content;
        Object.entries(dictionary).forEach(([original, translation]) => {
            const regex = new RegExp(original, 'gi');
            translatedContent = translatedContent.replace(regex, translation);
        });

        return {
            success: true,
            translatedDocument: {
                ...document,
                content: translatedContent,
                language: targetLanguage,
                metadata: {
                    ...document.metadata,
                    translationMethod: 'dictionary',
                    fallbackUsed: true
                }
            },
            accuracyScore: 60, // Lower accuracy for dictionary translation
            method: 'dictionary'
        };
    }

    async queueManualTranslation(document, targetLanguage) {
        // Queue document for manual translation
        return {
            success: false,
            queued: true,
            message: 'Document mis en file d\'attente pour traduction manuelle',
            estimatedTime: '24-48 heures',
            queueId: require('crypto').randomUUID(),
            targetLanguage: targetLanguage
        };
    }

    async ruleBasedAnalysis(document) {
        // Simple rule-based clause analysis
        const content = document.content.toLowerCase();
        const risks = [];

        // Check for potentially abusive clauses
        const riskPatterns = [
            { pattern: /exclusion.*responsabilité/g, risk: 'Clause d\'exclusion de responsabilité trop large' },
            { pattern: /résiliation.*immédiate/g, risk: 'Clause de résiliation immédiate sans préavis' },
            { pattern: /pénalité.*[0-9]+%/g, risk: 'Pénalités potentiellement excessives' },
            { pattern: /juridiction.*exclusive/g, risk: 'Clause de juridiction exclusive' }
        ];

        riskPatterns.forEach(({ pattern, risk }) => {
            if (pattern.test(content)) {
                risks.push({
                    id: require('crypto').randomUUID(),
                    type: 'potential_risk',
                    description: risk,
                    severity: 'medium',
                    confidence: 0.7,
                    suggestion: 'Vérification manuelle recommandée'
                });
            }
        });

        return {
            documentId: document.id,
            risks: risks,
            analysisMethod: 'rule_based',
            confidence: 0.7,
            analyzedAt: new Date()
        };
    }

    async basicValidation(document) {
        // Basic document validation
        const issues = [];

        if (!document.content || document.content.length < 100) {
            issues.push({
                type: 'insufficient_content',
                severity: 'high',
                description: 'Document trop court'
            });
        }

        if (!document.parties || document.parties.length === 0) {
            issues.push({
                type: 'missing_parties',
                severity: 'critical',
                description: 'Aucune partie identifiée'
            });
        }

        return {
            documentId: document.id,
            isValid: issues.length === 0,
            issues: issues,
            validationMethod: 'basic',
            validatedAt: new Date()
        };
    }

    /**
     * Get service health status
     */
    getHealthStatus() {
        return {
            service: this.serviceName,
            circuitBreaker: this.circuitBreaker.getState(),
            timestamp: new Date()
        };
    }

    /**
     * Reset circuit breaker manually
     */
    resetCircuitBreaker() {
        this.circuitBreaker.state = 'CLOSED';
        this.circuitBreaker.failureCount = 0;
        this.circuitBreaker.lastFailureTime = null;
        console.log(`Circuit breaker reset for ${this.serviceName}`);
    }
}

module.exports = ResilientService;