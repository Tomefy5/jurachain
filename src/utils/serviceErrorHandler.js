/**
 * Service-Specific Error Handler
 * Provides specialized error handling and user messages for each JusticeAutomation service
 */

const { ErrorTypes, ErrorMessageService } = require('./errorMessages');
const NetworkErrorHandler = require('./networkErrorHandler');

class ServiceErrorHandler {
    constructor() {
        this.errorMessageService = new ErrorMessageService();
        this.networkErrorHandler = new NetworkErrorHandler();

        // Service-specific error patterns and handling
        this.serviceErrorPatterns = {
            documentGenerator: {
                patterns: {
                    'ollama.*connection': {
                        type: ErrorTypes.AI_SERVICE_ERROR,
                        fallbackMessage: 'Service IA local indisponible, utilisation du service cloud',
                        severity: 'medium',
                        retryable: true
                    },
                    'gemini.*quota': {
                        type: ErrorTypes.AI_SERVICE_ERROR,
                        fallbackMessage: 'Quota API Gemini dépassé, utilisation du service local',
                        severity: 'high',
                        retryable: false
                    },
                    'gemini.*safety': {
                        type: ErrorTypes.VALIDATION_FAILED,
                        fallbackMessage: 'Contenu bloqué par les filtres de sécurité',
                        severity: 'medium',
                        retryable: false
                    },
                    'template.*generation': {
                        type: ErrorTypes.DOCUMENT_GENERATION_FAILED,
                        fallbackMessage: 'Génération par modèle de base utilisée',
                        severity: 'low',
                        retryable: false
                    }
                },
                fallbackStrategies: [
                    'Utilisation du service IA alternatif',
                    'Génération basée sur des modèles',
                    'Mode de génération assistée'
                ]
            },

            blockchain: {
                patterns: {
                    'hedera.*insufficient.*balance': {
                        type: ErrorTypes.BLOCKCHAIN_ERROR,
                        fallbackMessage: 'Solde Hedera insuffisant, utilisation de Polygon',
                        severity: 'medium',
                        retryable: false
                    },
                    'polygon.*insufficient.*funds': {
                        type: ErrorTypes.BLOCKCHAIN_ERROR,
                        fallbackMessage: 'Fonds Polygon insuffisants, stockage local temporaire',
                        severity: 'high',
                        retryable: false
                    },
                    'transaction.*timeout': {
                        type: ErrorTypes.TIMEOUT_ERROR,
                        fallbackMessage: 'Transaction blockchain en attente, vérification ultérieure',
                        severity: 'medium',
                        retryable: true
                    },
                    'network.*congestion': {
                        type: ErrorTypes.SERVICE_UNAVAILABLE,
                        fallbackMessage: 'Réseau blockchain congestionné, nouvelle tentative programmée',
                        severity: 'medium',
                        retryable: true
                    }
                },
                fallbackStrategies: [
                    'Basculement vers réseau blockchain alternatif',
                    'Stockage local avec synchronisation différée',
                    'Mode signature hors ligne'
                ]
            },

            collaborative: {
                patterns: {
                    'google.*docs.*api': {
                        type: ErrorTypes.COLLABORATION_ERROR,
                        fallbackMessage: 'API Google Docs indisponible, édition locale activée',
                        severity: 'medium',
                        retryable: true
                    },
                    'authentication.*failed': {
                        type: ErrorTypes.AUTH_FAILED,
                        fallbackMessage: 'Authentification Google échouée, mode lecture seule',
                        severity: 'high',
                        retryable: false
                    },
                    'quota.*exceeded': {
                        type: ErrorTypes.RATE_LIMIT_EXCEEDED,
                        fallbackMessage: 'Quota Google API dépassé, fonctionnalités limitées',
                        severity: 'high',
                        retryable: false
                    },
                    'document.*locked': {
                        type: ErrorTypes.DOCUMENT_LOCKED,
                        fallbackMessage: 'Document verrouillé par un autre utilisateur',
                        severity: 'low',
                        retryable: true
                    }
                },
                fallbackStrategies: [
                    'Édition collaborative locale via WebSocket',
                    'Mode lecture seule avec synchronisation manuelle',
                    'Téléchargement pour édition hors ligne'
                ]
            },

            translation: {
                patterns: {
                    'translation.*api.*error': {
                        type: ErrorTypes.TRANSLATION_FAILED,
                        fallbackMessage: 'Service de traduction IA indisponible, dictionnaire utilisé',
                        severity: 'medium',
                        retryable: true
                    },
                    'language.*not.*supported': {
                        type: ErrorTypes.TRANSLATION_FAILED,
                        fallbackMessage: 'Langue non supportée par le service de traduction',
                        severity: 'high',
                        retryable: false
                    },
                    'accuracy.*too.*low': {
                        type: ErrorTypes.VALIDATION_FAILED,
                        fallbackMessage: 'Précision de traduction insuffisante, révision manuelle requise',
                        severity: 'medium',
                        retryable: false
                    }
                },
                fallbackStrategies: [
                    'Traduction basée sur dictionnaire',
                    'Mise en file d\'attente pour traduction manuelle',
                    'Traduction partielle avec marquage des sections non traduites'
                ]
            },

            clauseAnalyzer: {
                patterns: {
                    'tensorflow.*model.*load': {
                        type: ErrorTypes.AI_SERVICE_ERROR,
                        fallbackMessage: 'Modèle TensorFlow indisponible, analyse basée sur règles',
                        severity: 'medium',
                        retryable: true
                    },
                    'analysis.*timeout': {
                        type: ErrorTypes.TIMEOUT_ERROR,
                        fallbackMessage: 'Analyse complexe, validation de base effectuée',
                        severity: 'low',
                        retryable: false
                    },
                    'model.*accuracy.*low': {
                        type: ErrorTypes.VALIDATION_FAILED,
                        fallbackMessage: 'Confiance du modèle faible, vérification manuelle recommandée',
                        severity: 'medium',
                        retryable: false
                    }
                },
                fallbackStrategies: [
                    'Analyse basée sur règles prédéfinies',
                    'Validation de base des clauses',
                    'Marquage pour révision manuelle'
                ]
            },

            database: {
                patterns: {
                    'supabase.*connection': {
                        type: ErrorTypes.DATABASE_ERROR,
                        fallbackMessage: 'Base de données temporairement indisponible',
                        severity: 'high',
                        retryable: true
                    },
                    'rate.*limit.*exceeded': {
                        type: ErrorTypes.RATE_LIMIT_EXCEEDED,
                        fallbackMessage: 'Limite de requêtes dépassée, ralentissement automatique',
                        severity: 'medium',
                        retryable: true
                    },
                    'storage.*quota.*exceeded': {
                        type: ErrorTypes.DATABASE_ERROR,
                        fallbackMessage: 'Quota de stockage dépassé, nettoyage requis',
                        severity: 'high',
                        retryable: false
                    }
                },
                fallbackStrategies: [
                    'Cache local temporaire',
                    'Mode hors ligne avec synchronisation différée',
                    'Stockage local avec compression'
                ]
            }
        };
    }

    /**
     * Handle service-specific error with appropriate fallback strategy
     */
    handleServiceError(serviceName, error, options = {}) {
        const servicePatterns = this.serviceErrorPatterns[serviceName];
        if (!servicePatterns) {
            return this.handleGenericError(error, options);
        }

        // Find matching error pattern
        const matchedPattern = this.findMatchingPattern(error, servicePatterns.patterns);

        if (matchedPattern) {
            return this.createServiceSpecificError(
                serviceName,
                error,
                matchedPattern,
                servicePatterns.fallbackStrategies,
                options
            );
        }

        // No specific pattern found, handle as generic error
        return this.handleGenericError(error, options);
    }

    /**
     * Find matching error pattern for the given error
     */
    findMatchingPattern(error, patterns) {
        const errorMessage = error.message?.toLowerCase() || '';
        const errorCode = error.code?.toLowerCase() || '';

        for (const [pattern, config] of Object.entries(patterns)) {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(errorMessage) || regex.test(errorCode)) {
                return config;
            }
        }

        return null;
    }

    /**
     * Create service-specific error with fallback information
     */
    createServiceSpecificError(serviceName, originalError, patternConfig, fallbackStrategies, options) {
        const language = options.language || 'fr';

        // Get base error message
        const baseError = this.errorMessageService.formatError(
            { ...originalError, type: patternConfig.type },
            language,
            {
                service: serviceName,
                operation: options.operationName || 'unknown',
                ...options.context
            }
        );

        // Add service-specific enhancements
        return {
            ...baseError,
            serviceError: true,
            serviceName: serviceName,
            severity: patternConfig.severity,
            retryable: patternConfig.retryable,
            fallbackMessage: patternConfig.fallbackMessage,
            fallbackStrategies: fallbackStrategies,
            recommendations: this.getServiceRecommendations(serviceName, patternConfig),
            troubleshooting: this.getTroubleshootingSteps(serviceName, patternConfig.type),
            estimatedResolution: this.getEstimatedResolutionTime(patternConfig.severity),
            supportContact: this.getSupportContact(patternConfig.severity)
        };
    }

    /**
     * Handle generic errors that don't match service patterns
     */
    handleGenericError(error, options = {}) {
        // Check if it's a network error
        if (this.isNetworkRelatedError(error)) {
            return this.networkErrorHandler.analyzeNetworkError(error, options);
        }

        // Default error handling
        const language = options.language || 'fr';
        return this.errorMessageService.formatError(error, language, options.context);
    }

    /**
     * Check if error is network-related
     */
    isNetworkRelatedError(error) {
        const networkIndicators = [
            'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND',
            'network', 'connection', 'timeout', 'dns'
        ];

        const errorString = (error.message + ' ' + error.code).toLowerCase();
        return networkIndicators.some(indicator => errorString.includes(indicator));
    }

    /**
     * Get service-specific recommendations
     */
    getServiceRecommendations(serviceName, patternConfig) {
        const recommendations = {
            documentGenerator: {
                high: [
                    'Vérifiez la configuration des clés API',
                    'Contactez le support pour assistance prioritaire',
                    'Utilisez la génération par modèles en attendant'
                ],
                medium: [
                    'Vérifiez votre connexion internet',
                    'Réessayez dans quelques minutes',
                    'Le service de secours est automatiquement activé'
                ],
                low: [
                    'Le système fonctionne en mode dégradé',
                    'Toutes les fonctionnalités de base restent disponibles'
                ]
            },
            blockchain: {
                high: [
                    'Vos signatures sont sauvegardées localement',
                    'La synchronisation blockchain reprendra automatiquement',
                    'Contactez le support si le problème persiste'
                ],
                medium: [
                    'Tentative de basculement vers réseau alternatif',
                    'Vos données restent sécurisées',
                    'Synchronisation automatique en cours'
                ],
                low: [
                    'Opération en cours de traitement',
                    'Vérification automatique programmée'
                ]
            },
            collaborative: {
                high: [
                    'Sauvegardez votre travail localement',
                    'Utilisez le mode hors ligne si nécessaire',
                    'Reconnectez-vous pour restaurer la collaboration'
                ],
                medium: [
                    'Édition collaborative locale disponible',
                    'Synchronisation automatique activée',
                    'Rechargez la page si nécessaire'
                ],
                low: [
                    'Attendez que l\'autre utilisateur termine',
                    'Vous pouvez consulter le document en lecture seule'
                ]
            }
        };

        return recommendations[serviceName]?.[patternConfig.severity] || [
            'Réessayez l\'opération',
            'Contactez le support si le problème persiste'
        ];
    }

    /**
     * Get troubleshooting steps for specific error types
     */
    getTroubleshootingSteps(serviceName, errorType) {
        const troubleshooting = {
            [ErrorTypes.NETWORK_ERROR]: [
                '1. Vérifiez votre connexion internet',
                '2. Désactivez temporairement votre VPN',
                '3. Videz le cache de votre navigateur',
                '4. Réessayez dans quelques minutes'
            ],
            [ErrorTypes.AUTH_FAILED]: [
                '1. Déconnectez-vous et reconnectez-vous',
                '2. Vérifiez que vos identifiants sont corrects',
                '3. Videz les cookies du site',
                '4. Contactez le support si le problème persiste'
            ],
            [ErrorTypes.AI_SERVICE_ERROR]: [
                '1. Le service de secours est automatiquement activé',
                '2. Vos données sont préservées',
                '3. Réessayez votre demande',
                '4. Contactez le support pour les problèmes récurrents'
            ],
            [ErrorTypes.BLOCKCHAIN_ERROR]: [
                '1. Vos signatures sont sauvegardées localement',
                '2. La synchronisation reprendra automatiquement',
                '3. Vérifiez l\'état du réseau blockchain',
                '4. Contactez le support pour assistance'
            ]
        };

        return troubleshooting[errorType] || [
            '1. Réessayez l\'opération',
            '2. Rechargez la page',
            '3. Contactez le support technique'
        ];
    }

    /**
     * Get estimated resolution time based on severity
     */
    getEstimatedResolutionTime(severity) {
        const resolutionTimes = {
            low: '< 5 minutes',
            medium: '5-15 minutes',
            high: '15-60 minutes',
            critical: '1-4 heures'
        };

        return resolutionTimes[severity] || 'Temps indéterminé';
    }

    /**
     * Get support contact information based on severity
     */
    getSupportContact(severity) {
        if (severity === 'high' || severity === 'critical') {
            return {
                priority: 'urgent',
                email: 'support-urgent@justiceautomation.mg',
                phone: '+261 XX XX XX XX',
                expectedResponse: '< 2 heures'
            };
        }

        return {
            priority: 'normal',
            email: 'support@justiceautomation.mg',
            expectedResponse: '< 24 heures'
        };
    }

    /**
     * Get service health impact assessment
     */
    getServiceHealthImpact(serviceName, errorType) {
        const impacts = {
            documentGenerator: {
                [ErrorTypes.AI_SERVICE_ERROR]: {
                    impact: 'medium',
                    affectedFeatures: ['Génération IA avancée'],
                    availableFeatures: ['Génération par modèles', 'Édition manuelle'],
                    estimatedDowntime: '5-15 minutes'
                }
            },
            blockchain: {
                [ErrorTypes.BLOCKCHAIN_ERROR]: {
                    impact: 'low',
                    affectedFeatures: ['Signature blockchain immédiate'],
                    availableFeatures: ['Signature locale', 'Synchronisation différée'],
                    estimatedDowntime: '0 minutes (mode dégradé)'
                }
            },
            collaborative: {
                [ErrorTypes.COLLABORATION_ERROR]: {
                    impact: 'medium',
                    affectedFeatures: ['Édition Google Docs'],
                    availableFeatures: ['Édition locale', 'Synchronisation manuelle'],
                    estimatedDowntime: '2-10 minutes'
                }
            }
        };

        return impacts[serviceName]?.[errorType] || {
            impact: 'unknown',
            affectedFeatures: ['Fonctionnalité spécifique'],
            availableFeatures: ['Fonctionnalités de base'],
            estimatedDowntime: 'Indéterminé'
        };
    }

    /**
     * Generate comprehensive error report for monitoring
     */
    generateErrorReport(serviceName, error, options = {}) {
        const serviceError = this.handleServiceError(serviceName, error, options);
        const healthImpact = this.getServiceHealthImpact(serviceName, serviceError.type);

        return {
            timestamp: new Date(),
            serviceName,
            errorDetails: serviceError,
            healthImpact,
            context: options.context || {},
            userAgent: options.userAgent,
            sessionId: options.sessionId,
            userId: options.userId,
            correlationId: options.correlationId || this.generateCorrelationId()
        };
    }

    /**
     * Generate correlation ID for error tracking
     */
    generateCorrelationId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

module.exports = ServiceErrorHandler;