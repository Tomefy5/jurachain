const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');
const { DocumentType, Language } = require('../types/enums.js');
const TranslationService = require('./translationService');
const ResilientService = require('./resilientService');

/**
 * AI Document Generator Service
 * Handles document generation using Ollama (local) and Gemini API (cloud)
 * with automatic fallback mechanisms and comprehensive error handling
 */
class DocumentGeneratorService {
    constructor() {
        this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        this.ollamaModel = process.env.OLLAMA_MODEL || 'llama2';
        this.geminiApiKey = process.env.GEMINI_API_KEY;
        this.geminiModel = process.env.GEMINI_MODEL || 'gemini-pro';

        // Initialize Gemini AI if API key is available
        if (this.geminiApiKey) {
            this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
            this.geminiModelInstance = this.genAI.getGenerativeModel({ model: this.geminiModel });
        }

        // Initialize resilient service wrapper
        this.resilientService = new ResilientService('documentGenerator', {
            timeout: 30000,
            maxRetries: 3,
            circuitBreakerThreshold: 5
        });

        // Initialize translation service
        this.translationService = new TranslationService();
    }

    /**
     * Generate a legal document based on the contract request
     * @param {Object} contractRequest - The contract generation request
     * @returns {Promise<Object>} Generated legal document
     */
    async generateContract(contractRequest, options = {}) {
        const startTime = Date.now();

        return await this.resilientService.execute(async () => {
            // Validate input
            this.validateContractRequest(contractRequest);

            // Try Ollama first, then Gemini as fallback
            let document = await this.generateWithOllama(contractRequest);

            if (!document) {
                console.log('Ollama generation failed, trying Gemini API');
                document = await this.generateWithGemini(contractRequest);
            }

            if (!document) {
                throw new Error('Both Ollama and Gemini generation failed');
            }

            // Validate generated document compliance
            const complianceReport = await this.validateCompliance(document);

            const processingTime = Date.now() - startTime;

            return {
                ...document,
                complianceReport,
                metadata: {
                    ...document.metadata,
                    processingTime,
                    generatedAt: new Date()
                }
            };
        }, {
            operationName: 'generateContract',
            language: options.language || 'fr',
            context: {
                contractRequest,
                aiModel: 'ollama',
                generateWithGemini: (req) => this.generateWithGemini(req)
            },
            fallback: async () => {
                // Template-based fallback is handled by ResilientService
                return await this.resilientService.generateFromTemplate(contractRequest);
            }
        });
    }

    /**
     * Generate document using Ollama (local processing)
     * @param {Object} contractRequest - The contract generation request
     * @returns {Promise<Object|null>} Generated document or null if failed
     */
    async generateWithOllama(contractRequest) {
        try {
            const prompt = this.buildPrompt(contractRequest);

            const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
                model: this.ollamaModel,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.3, // Lower temperature for more consistent legal documents
                    top_p: 0.9,
                    max_tokens: 4000
                }
            }, {
                timeout: 30000, // 30 seconds timeout
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.response) {
                return this.parseGeneratedDocument(response.data.response, contractRequest, 'ollama');
            }

            throw new Error('Ollama returned empty response');
        } catch (error) {
            // Let the error bubble up to be handled by resilient service
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Ollama service not available - connection refused');
            } else if (error.code === 'ETIMEDOUT') {
                throw new Error('Ollama service timeout - request took too long');
            } else if (error.response?.status === 404) {
                throw new Error('Ollama model not found - check model configuration');
            }

            throw new Error(`Ollama generation failed: ${error.message}`);
        }
    }

    /**
     * Generate document using Gemini API (cloud processing)
     * @param {Object} contractRequest - The contract generation request
     * @returns {Promise<Object|null>} Generated document or null if failed
     */
    async generateWithGemini(contractRequest) {
        if (!this.geminiModelInstance) {
            throw new Error('Gemini API not configured - missing API key');
        }

        try {
            const prompt = this.buildPrompt(contractRequest);

            const result = await this.geminiModelInstance.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            if (text) {
                return this.parseGeneratedDocument(text, contractRequest, 'gemini');
            }

            throw new Error('Gemini returned empty response');
        } catch (error) {
            // Handle specific Gemini API errors
            if (error.message?.includes('quota')) {
                throw new Error('Gemini API quota exceeded - service temporarily unavailable');
            } else if (error.message?.includes('safety')) {
                throw new Error('Content blocked by Gemini safety filters');
            } else if (error.message?.includes('rate limit')) {
                throw new Error('Gemini API rate limit exceeded');
            }

            throw new Error(`Gemini generation failed: ${error.message}`);
        }
    }

    /**
     * Build the prompt for AI document generation
     * @param {Object} contractRequest - The contract generation request
     * @returns {string} Formatted prompt
     */
    buildPrompt(contractRequest) {
        const { type, language, description, parties, jurisdiction, specificClauses } = contractRequest;

        const languageInstructions = {
            [Language.FRENCH]: 'Rédigez le document en français, en respectant le droit malgache.',
            [Language.MALAGASY]: 'Soraty amin\'ny teny malagasy ny antontan-taratasy, miaraka amin\'ny lalàna malagasy.',
            [Language.ENGLISH]: 'Write the document in English, following Malagasy law.'
        };

        const documentTypeInstructions = {
            [DocumentType.CONTRACT]: 'contrat commercial',
            [DocumentType.LEASE]: 'contrat de bail',
            [DocumentType.SALE_AGREEMENT]: 'contrat de vente',
            [DocumentType.EMPLOYMENT_CONTRACT]: 'contrat de travail',
            [DocumentType.SERVICE_AGREEMENT]: 'contrat de prestation de services',
            [DocumentType.PARTNERSHIP_AGREEMENT]: 'contrat de partenariat',
            [DocumentType.NON_DISCLOSURE_AGREEMENT]: 'accord de confidentialité',
            [DocumentType.POWER_OF_ATTORNEY]: 'procuration',
            [DocumentType.OTHER]: 'document juridique'
        };

        const partiesInfo = parties.map(party =>
            `- ${party.name} (${party.role}): ${party.email}${party.address ? ', ' + party.address : ''}`
        ).join('\n');

        const clausesInfo = specificClauses && specificClauses.length > 0
            ? `\n\nClauses spécifiques à inclure:\n${specificClauses.map(clause => `- ${clause}`).join('\n')}`
            : '';

        return `
Vous êtes un expert juridique spécialisé dans le droit malgache. ${languageInstructions[language]}

Générez un ${documentTypeInstructions[type]} professionnel et juridiquement valide selon les spécifications suivantes:

DESCRIPTION: ${description}

PARTIES CONTRACTANTES:
${partiesInfo}

JURIDICTION: ${jurisdiction}
${clausesInfo}

INSTRUCTIONS IMPORTANTES:
1. Respectez strictement le droit malgache et les pratiques juridiques locales
2. Incluez toutes les clauses essentielles pour ce type de document
3. Utilisez un langage juridique précis et professionnel
4. Assurez-vous que les droits et obligations de chaque partie sont clairement définis
5. Incluez les clauses de résolution de conflits appropriées
6. Respectez les exigences de forme du droit malgache

FORMAT DE RÉPONSE:
Structurez le document avec:
- Titre du document
- Préambule avec identification des parties
- Articles numérotés avec clauses spécifiques
- Clauses de signature et de date
- Mentions légales obligatoires

Le document doit être complet, professionnel et prêt à être signé.
        `.trim();
    }

    /**
     * Parse the generated document text into structured format
     * @param {string} generatedText - Raw generated text
     * @param {Object} contractRequest - Original request
     * @param {string} aiModel - AI model used for generation
     * @returns {Object} Structured document object
     */
    parseGeneratedDocument(generatedText, contractRequest, aiModel) {
        // Extract title from the first line or generate one
        const lines = generatedText.split('\n').filter(line => line.trim());
        const title = lines[0] || `${contractRequest.type} - ${new Date().toLocaleDateString()}`;

        // Generate clauses by splitting content into logical sections
        const clauses = this.extractClauses(generatedText);

        return {
            id: uuidv4(),
            type: contractRequest.type,
            title: title.replace(/^#+\s*/, ''), // Remove markdown headers
            content: generatedText,
            language: contractRequest.language,
            status: 'draft',
            parties: contractRequest.parties.map(party => ({
                ...party,
                id: uuidv4()
            })),
            clauses: clauses,
            signatures: [],
            riskAssessments: [],
            metadata: {
                version: 1,
                generatedBy: 'ai',
                aiModel: aiModel,
                jurisdiction: contractRequest.jurisdiction,
                tags: [contractRequest.type, contractRequest.language]
            },
            createdBy: 'system', // Will be updated with actual user ID
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Extract clauses from generated document text
     * @param {string} text - Generated document text
     * @returns {Array} Array of clause objects
     */
    extractClauses(text) {
        const clauses = [];
        const lines = text.split('\n');
        let currentClause = null;
        let position = 0;

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Detect clause headers (Article, Clause, numbered sections, etc.)
            if (this.isClauseHeader(trimmedLine)) {
                // Save previous clause if exists
                if (currentClause) {
                    clauses.push({
                        ...currentClause,
                        content: currentClause.content.trim()
                    });
                }

                // Start new clause
                currentClause = {
                    id: uuidv4(),
                    title: trimmedLine,
                    content: '',
                    position: position++,
                    isRequired: true,
                    category: this.categorizeClause(trimmedLine)
                };
            } else if (currentClause && trimmedLine) {
                // Add content to current clause
                currentClause.content += (currentClause.content ? '\n' : '') + trimmedLine;
            }
        }

        // Add the last clause
        if (currentClause) {
            clauses.push({
                ...currentClause,
                content: currentClause.content.trim()
            });
        }

        return clauses;
    }

    /**
     * Check if a line is a clause header
     * @param {string} line - Line to check
     * @returns {boolean} True if it's a clause header
     */
    isClauseHeader(line) {
        const patterns = [
            /^Article\s+\d+/i,
            /^Clause\s+\d+/i,
            /^\d+\.\s+/,
            /^[IVX]+\.\s+/,
            /^[A-Z][A-Z\s]+:$/,
            /^ARTICLE\s+[IVX\d]+/i
        ];

        return patterns.some(pattern => pattern.test(line));
    }

    /**
     * Categorize a clause based on its title
     * @param {string} title - Clause title
     * @returns {string} Clause category
     */
    categorizeClause(title) {
        const titleLower = title.toLowerCase();

        if (titleLower.includes('objet') || titleLower.includes('purpose')) return 'purpose';
        if (titleLower.includes('prix') || titleLower.includes('payment') || titleLower.includes('montant')) return 'financial';
        if (titleLower.includes('durée') || titleLower.includes('duration') || titleLower.includes('terme')) return 'duration';
        if (titleLower.includes('résiliation') || titleLower.includes('termination')) return 'termination';
        if (titleLower.includes('responsabilité') || titleLower.includes('liability')) return 'liability';
        if (titleLower.includes('signature') || titleLower.includes('execution')) return 'execution';
        if (titleLower.includes('litige') || titleLower.includes('dispute') || titleLower.includes('conflit')) return 'dispute';

        return 'general';
    }

    /**
     * Validate compliance of generated document
     * @param {Object} document - Generated document
     * @returns {Promise<Object>} Compliance report
     */
    async validateCompliance(document) {
        const issues = [];
        let score = 100;

        // Check for essential clauses based on document type
        const requiredClauses = this.getRequiredClauses(document.type);
        const documentContent = document.content.toLowerCase();

        for (const requiredClause of requiredClauses) {
            if (!documentContent.includes(requiredClause.keyword.toLowerCase())) {
                issues.push({
                    type: 'missing_clause',
                    severity: 'high',
                    description: `Clause manquante: ${requiredClause.name}`,
                    suggestion: `Ajouter une clause concernant ${requiredClause.name}`
                });
                score -= 15;
            }
        }

        // Check document length (too short might be incomplete)
        if (document.content.length < 500) {
            issues.push({
                type: 'insufficient_content',
                severity: 'medium',
                description: 'Le document semble trop court pour être complet',
                suggestion: 'Vérifier que toutes les clauses nécessaires sont incluses'
            });
            score -= 10;
        }

        // Check for party information
        if (document.parties.length === 0) {
            issues.push({
                type: 'missing_parties',
                severity: 'critical',
                description: 'Aucune partie identifiée dans le document',
                suggestion: 'Ajouter les informations des parties contractantes'
            });
            score -= 25;
        }

        return {
            documentId: document.id,
            isCompliant: score >= 70,
            jurisdiction: document.metadata.jurisdiction,
            checkedAt: new Date(),
            issues: issues,
            score: Math.max(0, score)
        };
    }

    /**
     * Get required clauses for a document type
     * @param {string} documentType - Type of document
     * @returns {Array} Array of required clauses
     */
    getRequiredClauses(documentType) {
        const clausesByType = {
            [DocumentType.CONTRACT]: [
                { name: 'Objet du contrat', keyword: 'objet' },
                { name: 'Prix et modalités de paiement', keyword: 'prix' },
                { name: 'Obligations des parties', keyword: 'obligations' },
                { name: 'Résiliation', keyword: 'résiliation' }
            ],
            [DocumentType.LEASE]: [
                { name: 'Description du bien', keyword: 'bien' },
                { name: 'Loyer et charges', keyword: 'loyer' },
                { name: 'Durée du bail', keyword: 'durée' },
                { name: 'Dépôt de garantie', keyword: 'garantie' }
            ],
            [DocumentType.SALE_AGREEMENT]: [
                { name: 'Description du bien vendu', keyword: 'vendu' },
                { name: 'Prix de vente', keyword: 'prix' },
                { name: 'Modalités de paiement', keyword: 'paiement' },
                { name: 'Transfert de propriété', keyword: 'propriété' }
            ],
            [DocumentType.EMPLOYMENT_CONTRACT]: [
                { name: 'Poste et fonctions', keyword: 'fonctions' },
                { name: 'Rémunération', keyword: 'salaire' },
                { name: 'Durée du contrat', keyword: 'durée' },
                { name: 'Période d\'essai', keyword: 'essai' }
            ]
        };

        return clausesByType[documentType] || [
            { name: 'Objet', keyword: 'objet' },
            { name: 'Obligations', keyword: 'obligations' }
        ];
    }

    /**
     * Translate document to specified language with accuracy validation
     * @param {Object} document - Document to translate
     * @param {string} targetLanguage - Target language
     * @returns {Promise<Object>} Translation result with validation
     */
    async translateDocument(document, targetLanguage) {
        try {
            return await this.translationService.translateDocument(document, targetLanguage);
        } catch (error) {
            console.error('Document translation error:', error);
            throw new Error(`Document translation failed: ${error.message}`);
        }
    }

    /**
     * Create side-by-side comparison of original and translated documents
     * @param {Object} originalDocument - Original document
     * @param {Object} translatedDocument - Translated document
     * @returns {Object} Comparison data for UI display
     */
    async createTranslationComparison(originalDocument, translatedDocument) {
        try {
            return this.translationService.createSideBySideComparison(
                originalDocument,
                translatedDocument
            );
        } catch (error) {
            console.error('Translation comparison error:', error);
            throw new Error(`Failed to create translation comparison: ${error.message}`);
        }
    }

    /**
     * Generate document in multiple languages simultaneously
     * @param {Object} contractRequest - Contract generation request
     * @param {Array} targetLanguages - Array of target languages
     * @returns {Promise<Object>} Multi-language generation result
     */
    async generateMultilingualDocument(contractRequest, targetLanguages = []) {
        try {
            // Generate the primary document
            const primaryDocument = await this.generateContract(contractRequest);

            const results = {
                primary: primaryDocument,
                translations: {},
                comparisons: {},
                summary: {
                    totalLanguages: 1 + targetLanguages.length,
                    successfulTranslations: 0,
                    failedTranslations: 0,
                    averageAccuracyScore: 0
                }
            };

            // Generate translations for each target language
            const translationPromises = targetLanguages.map(async (targetLanguage) => {
                try {
                    const translationResult = await this.translateDocument(primaryDocument, targetLanguage);

                    if (translationResult.success) {
                        results.translations[targetLanguage] = translationResult.translatedDocument;
                        results.comparisons[targetLanguage] = await this.createTranslationComparison(
                            primaryDocument,
                            translationResult.translatedDocument
                        );
                        results.summary.successfulTranslations++;
                        return translationResult.accuracyScore;
                    } else {
                        results.summary.failedTranslations++;
                        return 0;
                    }
                } catch (error) {
                    console.error(`Translation to ${targetLanguage} failed:`, error);
                    results.summary.failedTranslations++;
                    return 0;
                }
            });

            const accuracyScores = await Promise.all(translationPromises);
            const validScores = accuracyScores.filter(score => score > 0);

            results.summary.averageAccuracyScore = validScores.length > 0
                ? Math.round(validScores.reduce((sum, score) => sum + score, 0) / validScores.length)
                : 0;

            return results;

        } catch (error) {
            console.error('Multilingual document generation error:', error);
            throw new Error(`Multilingual generation failed: ${error.message}`);
        }
    }



    /**
     * Validate contract request input
     * @param {Object} contractRequest - Request to validate
     * @throws {Error} If validation fails
     */
    validateContractRequest(contractRequest) {
        if (!contractRequest) {
            throw new Error('Contract request is required');
        }

        const { type, language, description, parties, jurisdiction } = contractRequest;

        if (!Object.values(DocumentType).includes(type)) {
            throw new Error('Invalid document type');
        }

        if (!Object.values(Language).includes(language)) {
            throw new Error('Invalid language');
        }

        if (!description || description.length < 10) {
            throw new Error('Description must be at least 10 characters long');
        }

        if (!parties || parties.length === 0) {
            throw new Error('At least one party is required');
        }

        if (!jurisdiction) {
            throw new Error('Jurisdiction is required');
        }
    }
}

module.exports = DocumentGeneratorService;