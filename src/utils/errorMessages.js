/**
 * User-friendly error messages for JusticeAutomation platform
 * Provides localized error messages in French and Malagasy
 */

const ErrorTypes = {
    // Network and connectivity errors
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    CONNECTION_REFUSED: 'CONNECTION_REFUSED',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

    // Authentication and authorization errors
    AUTH_FAILED: 'AUTH_FAILED',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

    // Document generation errors
    DOCUMENT_GENERATION_FAILED: 'DOCUMENT_GENERATION_FAILED',
    AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
    TRANSLATION_FAILED: 'TRANSLATION_FAILED',
    VALIDATION_FAILED: 'VALIDATION_FAILED',

    // Blockchain errors
    BLOCKCHAIN_ERROR: 'BLOCKCHAIN_ERROR',
    SIGNATURE_FAILED: 'SIGNATURE_FAILED',
    VERIFICATION_FAILED: 'VERIFICATION_FAILED',

    // Collaboration errors
    COLLABORATION_ERROR: 'COLLABORATION_ERROR',
    DOCUMENT_LOCKED: 'DOCUMENT_LOCKED',
    SYNC_FAILED: 'SYNC_FAILED',

    // Data errors
    INVALID_INPUT: 'INVALID_INPUT',
    DATA_NOT_FOUND: 'DATA_NOT_FOUND',
    DATABASE_ERROR: 'DATABASE_ERROR',

    // System errors
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    MAINTENANCE_MODE: 'MAINTENANCE_MODE',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
};

const ErrorMessages = {
    [ErrorTypes.NETWORK_ERROR]: {
        fr: {
            title: 'Problème de connexion',
            message: 'Impossible de se connecter au service. Vérifiez votre connexion internet et réessayez.',
            action: 'Réessayer dans quelques instants'
        },
        mg: {
            title: 'Olana amin\'ny fifandraisana',
            message: 'Tsy afaka mifandray amin\'ny serivisy. Hamarino ny fifandraisanao amin\'ny Internet ary andramo indray.',
            action: 'Andramo indray afaka kelikely'
        }
    },

    [ErrorTypes.TIMEOUT_ERROR]: {
        fr: {
            title: 'Délai d\'attente dépassé',
            message: 'L\'opération prend plus de temps que prévu. Le service pourrait être temporairement surchargé.',
            action: 'Veuillez patienter et réessayer'
        },
        mg: {
            title: 'Lany ny fotoana fiandrasana',
            message: 'Maharitra loatra ny asa. Mety ho be loatra ny fampiasana ny serivisy ankehitriny.',
            action: 'Miandrasa kely ary andramo indray'
        }
    },

    [ErrorTypes.SERVICE_UNAVAILABLE]: {
        fr: {
            title: 'Service temporairement indisponible',
            message: 'Le service demandé n\'est pas disponible actuellement. Nous utilisons un service de secours.',
            action: 'Fonctionnalité limitée disponible'
        },
        mg: {
            title: 'Tsy misy serivisy ankehitriny',
            message: 'Tsy misy ny serivisy takiana ankehitriny. Mampiasa serivisy hafa isika.',
            action: 'Misy fiasa voafetra azo ampiasaina'
        }
    },

    [ErrorTypes.AUTH_FAILED]: {
        fr: {
            title: 'Échec de l\'authentification',
            message: 'Vos identifiants sont incorrects ou votre session a expiré.',
            action: 'Veuillez vous reconnecter'
        },
        mg: {
            title: 'Tsy nahomby ny fidirana',
            message: 'Diso ny anaranao na ny teny miafina, na lany ny fotoana fidirana.',
            action: 'Midira indray azafady'
        }
    },

    [ErrorTypes.TOKEN_EXPIRED]: {
        fr: {
            title: 'Session expirée',
            message: 'Votre session a expiré pour des raisons de sécurité.',
            action: 'Reconnectez-vous pour continuer'
        },
        mg: {
            title: 'Lany ny fotoana fidirana',
            message: 'Lany ny fotoana fidirana noho ny fiarovana.',
            action: 'Midira indray mba hanohy'
        }
    },

    [ErrorTypes.DOCUMENT_GENERATION_FAILED]: {
        fr: {
            title: 'Échec de génération du document',
            message: 'Impossible de générer le document demandé. Vérifiez les informations fournies.',
            action: 'Vérifiez vos données et réessayez'
        },
        mg: {
            title: 'Tsy nahomby ny famoronana antontan-taratasy',
            message: 'Tsy afaka namorona ny antontan-taratasy takaina. Hamarino ny fampahalalana nomenao.',
            action: 'Hamarino ny angon-drakitrao ary andramo indray'
        }
    },

    [ErrorTypes.AI_SERVICE_ERROR]: {
        fr: {
            title: 'Service IA temporairement indisponible',
            message: 'Le service d\'intelligence artificielle rencontre des difficultés. Nous utilisons un service alternatif.',
            action: 'Génération en cours avec service de secours'
        },
        mg: {
            title: 'Tsy misy serivisy AI ankehitriny',
            message: 'Misy olana ny serivisy faharanitan-tsaina artifisialy. Mampiasa serivisy hafa isika.',
            action: 'Miasa amin\'ny serivisy hafa ny famoronana'
        }
    },

    [ErrorTypes.TRANSLATION_FAILED]: {
        fr: {
            title: 'Échec de la traduction',
            message: 'Impossible de traduire le document dans la langue demandée.',
            action: 'Essayez avec une autre langue ou réessayez plus tard'
        },
        mg: {
            title: 'Tsy nahomby ny fandikana',
            message: 'Tsy afaka nadika tamin\'ny fiteny takaina ny antontan-taratasy.',
            action: 'Andramo amin\'ny fiteny hafa na andramo indray tatỳ aoriana'
        }
    },

    [ErrorTypes.BLOCKCHAIN_ERROR]: {
        fr: {
            title: 'Erreur blockchain',
            message: 'Problème avec l\'enregistrement blockchain. Vos données sont sauvegardées localement.',
            action: 'L\'enregistrement sera tenté automatiquement plus tard'
        },
        mg: {
            title: 'Olana amin\'ny blockchain',
            message: 'Misy olana amin\'ny firaketana blockchain. Voatahiry eto an-toerana ny angon-drakitrao.',
            action: 'Hanandrana indray ho azy ny firaketana tatỳ aoriana'
        }
    },

    [ErrorTypes.SIGNATURE_FAILED]: {
        fr: {
            title: 'Échec de la signature numérique',
            message: 'Impossible d\'enregistrer la signature numérique sur la blockchain.',
            action: 'Réessayez la signature ou contactez le support'
        },
        mg: {
            title: 'Tsy nahomby ny sonia nomerika',
            message: 'Tsy afaka narakitra tamin\'ny blockchain ny sonia nomerika.',
            action: 'Andramo indray ny sonia na mifandraisa amin\'ny mpanohana'
        }
    },

    [ErrorTypes.COLLABORATION_ERROR]: {
        fr: {
            title: 'Erreur de collaboration',
            message: 'Problème avec l\'édition collaborative. Vos modifications sont sauvegardées localement.',
            action: 'Rechargez la page pour reconnecter'
        },
        mg: {
            title: 'Olana amin\'ny fiaraha-miasa',
            message: 'Misy olana amin\'ny fanovana miaraka. Voatahiry eto an-toerana ny fanovana nataonao.',
            action: 'Avereno alaina ny pejy mba hifandray indray'
        }
    },

    [ErrorTypes.SYNC_FAILED]: {
        fr: {
            title: 'Échec de synchronisation',
            message: 'Impossible de synchroniser vos données. Elles restent disponibles hors ligne.',
            action: 'La synchronisation sera tentée automatiquement'
        },
        mg: {
            title: 'Tsy nahomby ny fampifanarahana',
            message: 'Tsy afaka nampifanaraka ny angon-drakitrao. Mbola azo ampiasaina tsy misy Internet ihany.',
            action: 'Hanandrana ho azy ny fampifanarahana'
        }
    },

    [ErrorTypes.INVALID_INPUT]: {
        fr: {
            title: 'Données invalides',
            message: 'Les informations fournies ne sont pas valides ou incomplètes.',
            action: 'Vérifiez et corrigez les champs marqués en rouge'
        },
        mg: {
            title: 'Angon-drakitra tsy mety',
            message: 'Tsy mety na tsy feno ny fampahalalana nomenao.',
            action: 'Hamarino sy ahitsio ny saha voamarika mena'
        }
    },

    [ErrorTypes.DATA_NOT_FOUND]: {
        fr: {
            title: 'Document non trouvé',
            message: 'Le document demandé n\'existe pas ou a été supprimé.',
            action: 'Vérifiez l\'URL ou retournez à la liste des documents'
        },
        mg: {
            title: 'Tsy hita ny antontan-taratasy',
            message: 'Tsy misy na voafafa ny antontan-taratasy takaina.',
            action: 'Hamarino ny URL na miverina any amin\'ny lisitry ny antontan-taratasy'
        }
    },

    [ErrorTypes.RATE_LIMIT_EXCEEDED]: {
        fr: {
            title: 'Trop de requêtes',
            message: 'Vous avez effectué trop de requêtes. Veuillez patienter avant de réessayer.',
            action: 'Attendez quelques minutes avant de continuer'
        },
        mg: {
            title: 'Be loatra ny fangatahana',
            message: 'Nanao fangatahana be loatra ianao. Miandrasa aloha vao manandrana indray.',
            action: 'Miandry minitra vitsivitsy alohan\'ny hanohy'
        }
    },

    [ErrorTypes.INTERNAL_ERROR]: {
        fr: {
            title: 'Erreur système',
            message: 'Une erreur inattendue s\'est produite. Notre équipe technique a été notifiée.',
            action: 'Réessayez dans quelques minutes'
        },
        mg: {
            title: 'Olana amin\'ny rafitra',
            message: 'Nisy olana tsy nampoizina. Efa nampandrenesina ny ekipanay ara-teknika.',
            action: 'Andramo indray afaka minitra vitsivitsy'
        }
    }
};

class ErrorMessageService {
    constructor(defaultLanguage = 'fr') {
        this.defaultLanguage = defaultLanguage;
    }

    getMessage(errorType, language = null) {
        const lang = language || this.defaultLanguage;
        const errorConfig = ErrorMessages[errorType];

        if (!errorConfig) {
            return this.getDefaultMessage(lang);
        }

        return errorConfig[lang] || errorConfig[this.defaultLanguage] || this.getDefaultMessage(lang);
    }

    getDefaultMessage(language) {
        const defaultMessages = {
            fr: {
                title: 'Erreur',
                message: 'Une erreur inattendue s\'est produite.',
                action: 'Veuillez réessayer'
            },
            mg: {
                title: 'Olana',
                message: 'Nisy olana tsy nampoizina.',
                action: 'Andramo indray azafady'
            }
        };

        return defaultMessages[language] || defaultMessages.fr;
    }

    formatError(error, language = null, context = {}) {
        let errorType = ErrorTypes.INTERNAL_ERROR;

        // Determine error type based on error properties
        if (error.code) {
            switch (error.code) {
                case 'ECONNRESET':
                case 'ENOTFOUND':
                case 'ECONNREFUSED':
                    errorType = ErrorTypes.NETWORK_ERROR;
                    break;
                case 'ETIMEDOUT':
                    errorType = ErrorTypes.TIMEOUT_ERROR;
                    break;
                case 'RATE_LIMIT_EXCEEDED':
                    errorType = ErrorTypes.RATE_LIMIT_EXCEEDED;
                    break;
                default:
                    if (error.code.includes('AUTH')) {
                        errorType = ErrorTypes.AUTH_FAILED;
                    }
            }
        } else if (error.message) {
            const message = error.message.toLowerCase();

            if (message.includes('timeout')) {
                errorType = ErrorTypes.TIMEOUT_ERROR;
            } else if (message.includes('network') || message.includes('connection')) {
                errorType = ErrorTypes.NETWORK_ERROR;
            } else if (message.includes('unauthorized') || message.includes('forbidden')) {
                errorType = ErrorTypes.AUTH_FAILED;
            } else if (message.includes('not found')) {
                errorType = ErrorTypes.DATA_NOT_FOUND;
            } else if (message.includes('validation')) {
                errorType = ErrorTypes.INVALID_INPUT;
            } else if (message.includes('blockchain')) {
                errorType = ErrorTypes.BLOCKCHAIN_ERROR;
            } else if (message.includes('translation')) {
                errorType = ErrorTypes.TRANSLATION_FAILED;
            } else if (message.includes('collaboration')) {
                errorType = ErrorTypes.COLLABORATION_ERROR;
            }
        }

        // Override with custom error type if provided
        if (error.type && ErrorTypes[error.type]) {
            errorType = error.type;
        }

        const messageConfig = this.getMessage(errorType, language);

        return {
            type: errorType,
            title: messageConfig.title,
            message: messageConfig.message,
            action: messageConfig.action,
            timestamp: new Date().toISOString(),
            context: context,
            originalError: process.env.NODE_ENV === 'development' ? error.message : undefined
        };
    }

    createUserFriendlyError(errorType, language = null, customMessage = null, context = {}) {
        const messageConfig = this.getMessage(errorType, language);

        return {
            type: errorType,
            title: messageConfig.title,
            message: customMessage || messageConfig.message,
            action: messageConfig.action,
            timestamp: new Date().toISOString(),
            context: context
        };
    }
}

module.exports = {
    ErrorTypes,
    ErrorMessages,
    ErrorMessageService
};