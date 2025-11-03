const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Language } = require('../types/enums.js');
const { v4: uuidv4 } = require('uuid');

/**
 * Translation Service for JusticeAutomation
 * Handles French/Malagasy translation with legal accuracy validation
 * Supports both Ollama (local) and Gemini API (cloud) with fallback
 */
class TranslationService {
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

        this.timeout = 30000; // 30 seconds
        this.maxRetries = 3;

        // Legal terminology dictionaries for validation
        this.legalTerms = {
            [Language.FRENCH]: {
                'contrat': ['contrat', 'accord', 'convention'],
                'clause': ['clause', 'article', 'disposition'],
                'partie': ['partie', 'contractant', 'signataire'],
                'obligation': ['obligation', 'engagement', 'devoir'],
                'responsabilité': ['responsabilité', 'liability'],
                'résiliation': ['résiliation', 'annulation', 'rupture'],
                'signature': ['signature', 'paraphe', 'seing'],
                'juridiction': ['juridiction', 'tribunal', 'cour']
            },
            [Language.MALAGASY]: {
                'fifanarahana': ['fifanarahana', 'fanekena', 'sonia'],
                'fepetra': ['fepetra', 'lalàna', 'fitsipika'],
                'mpandray anjara': ['mpandray anjara', 'mpisonia'],
                'adidy': ['adidy', 'andraikitra'],
                'tompon\'andraikitra': ['tompon\'andraikitra', 'mpitondra'],
                'fanafoana': ['fanafoana', 'fanafoanana'],
                'sonia': ['sonia', 'fanekena'],
                'fitsarana': ['fitsarana', 'fitsarana']
            }
        };
    }

    /**
     * Translate a legal document between French and Malagasy
     * @param {Object} document - Document to translate
     * @param {string} targetLanguage - Target language (fr or mg)
     * @returns {Promise<Object>} Translation result with accuracy validation
     */
    async translateDocument(document, targetLanguage) {
        try {
            // Validate input
            this.validateTranslationRequest(document, targetLanguage);

            // Skip translation if already in target language
            if (document.language === targetLanguage) {
                return {
                    success: true,
                    translatedDocument: document,
                    accuracyScore: 100,
                    validationReport: {
                        isAccurate: true,
                        issues: [],
                        legalTermsPreserved: true,
                        structurePreserved: true,
                        validatedAt: new Date()
                    },
                    processingTime: 0
                };
            }

            const startTime = Date.now();

            // Perform translation
            const translatedContent = await this.performTranslation(
                document.content,
                document.language,
                targetLanguage,
                document.type
            );

            if (!translatedContent) {
                throw new Error('Translation failed with all available services');
            }

            // Create translated document
            const translatedDocument = {
                ...document,
                id: uuidv4(),
                content: translatedContent,
                language: targetLanguage,
                metadata: {
                    ...document.metadata,
                    translatedFrom: document.language,
                    translatedAt: new Date(),
                    translationProcessingTime: Date.now() - startTime
                }
            };

            // Validate translation accuracy
            const validationReport = await this.validateTranslationAccuracy(
                document.content,
                translatedContent,
                document.language,
                targetLanguage
            );

            return {
                success: true,
                translatedDocument,
                accuracyScore: validationReport.accuracyScore,
                validationReport,
                processingTime: Date.now() - startTime
            };

        } catch (error) {
            console.error('Translation error:', error);
            return {
                success: false,
                error: error.message,
                translatedDocument: null,
                accuracyScore: 0,
                validationReport: null
            };
        }
    }

    /**
     * Perform the actual translation using available AI services
     * @param {string} content - Content to translate
     * @param {string} sourceLanguage - Source language
     * @param {string} targetLanguage - Target language
     * @param {string} documentType - Type of document for context
     * @returns {Promise<string>} Translated content
     */
    async performTranslation(content, sourceLanguage, targetLanguage, documentType) {
        const translationPrompt = this.buildTranslationPrompt(
            content,
            sourceLanguage,
            targetLanguage,
            documentType
        );

        // Try Gemini first (better multilingual support)
        let translatedContent = await this.translateWithGemini(translationPrompt);

        // Fallback to Ollama if Gemini fails
        if (!translatedContent) {
            console.log('Gemini translation failed, falling back to Ollama');
            translatedContent = await this.translateWithOllama(translationPrompt);
        }

        return translatedContent;
    }

    /**
     * Build translation prompt with legal context
     * @param {string} content - Content to translate
     * @param {string} sourceLanguage - Source language
     * @param {string} targetLanguage - Target language
     * @param {string} documentType - Document type for context
     * @returns {string} Translation prompt
     */
    buildTranslationPrompt(content, sourceLanguage, targetLanguage, documentType) {
        const languageNames = {
            [Language.FRENCH]: 'français',
            [Language.MALAGASY]: 'malgache (malagasy)',
            [Language.ENGLISH]: 'anglais'
        };

        const sourceLanguageName = languageNames[sourceLanguage];
        const targetLanguageName = languageNames[targetLanguage];

        const legalContext = this.getLegalTranslationContext(documentType, targetLanguage);

        return `
Vous êtes un traducteur juridique expert spécialisé dans le droit malgache.

TÂCHE: Traduire ce document juridique du ${sourceLanguageName} vers le ${targetLanguageName}.

EXIGENCES CRITIQUES:
1. Préserver la précision juridique de tous les termes légaux
2. Maintenir la structure et le formatage du document
3. Respecter les conventions juridiques malgaches
4. Conserver le ton professionnel et formel
5. Traduire les références légales selon le droit malgache
6. Maintenir la numérotation des articles et clauses

CONTEXTE JURIDIQUE:
${legalContext}

DOCUMENT À TRADUIRE:
${content}

INSTRUCTIONS:
- Fournissez UNIQUEMENT la traduction, sans commentaires
- Préservez tous les éléments de formatage (numérotation, structure)
- Utilisez la terminologie juridique appropriée pour Madagascar
- Assurez-vous que la traduction est juridiquement valide

TRADUCTION:
        `.trim();
    }

    /**
     * Get legal translation context for specific document types
     * @param {string} documentType - Type of document
     * @param {string} targetLanguage - Target language
     * @returns {string} Legal context information
     */
    getLegalTranslationContext(documentType, targetLanguage) {
        const contexts = {
            [Language.FRENCH]: {
                'contract': 'Contrat commercial selon le Code de Commerce malgache',
                'lease': 'Contrat de bail selon la législation malgache sur les baux',
                'sale_agreement': 'Contrat de vente selon le Code Civil malgache',
                'employment_contract': 'Contrat de travail selon le Code du Travail malgache'
            },
            [Language.MALAGASY]: {
                'contract': 'Fifanarahana ara-barotra araka ny Fehezan-dalàna momba ny varotra malagasy',
                'lease': 'Fifanarahana fanofana araka ny lalàna malagasy momba ny fanofana',
                'sale_agreement': 'Fifanarahana fivarotana araka ny Fehezan-dalàna sivily malagasy',
                'employment_contract': 'Fifanarahana asa araka ny Fehezan-dalàna momba ny asa malagasy'
            }
        };

        return contexts[targetLanguage]?.[documentType] ||
            'Document juridique selon la législation malgache';
    }

    /**
     * Translate using Gemini API
     * @param {string} prompt - Translation prompt
     * @returns {Promise<string|null>} Translated content or null
     */
    async translateWithGemini(prompt) {
        try {
            if (!this.geminiModelInstance) {
                console.log('Gemini API not configured');
                return null;
            }

            const result = await this.geminiModelInstance.generateContent(prompt);
            const response = await result.response;
            const translatedText = response.text();

            return translatedText?.trim() || null;
        } catch (error) {
            console.error('Gemini translation error:', error.message);
            return null;
        }
    }

    /**
     * Translate using Ollama
     * @param {string} prompt - Translation prompt
     * @returns {Promise<string|null>} Translated content or null
     */
    async translateWithOllama(prompt) {
        try {
            const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
                model: this.ollamaModel,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.2, // Lower temperature for more accurate translation
                    top_p: 0.9,
                    max_tokens: 4000
                }
            }, {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return response.data?.response?.trim() || null;
        } catch (error) {
            console.error('Ollama translation error:', error.message);
            return null;
        }
    }

    /**
     * Validate translation accuracy for legal documents
     * @param {string} originalContent - Original document content
     * @param {string} translatedContent - Translated content
     * @param {string} sourceLanguage - Source language
     * @param {string} targetLanguage - Target language
     * @returns {Promise<Object>} Validation report
     */
    async validateTranslationAccuracy(originalContent, translatedContent, sourceLanguage, targetLanguage) {
        const issues = [];
        let accuracyScore = 100;

        try {
            // Check length consistency (translated text shouldn't be too different in length)
            const lengthRatio = translatedContent.length / originalContent.length;
            if (lengthRatio < 0.5 || lengthRatio > 2.0) {
                issues.push({
                    type: 'length_inconsistency',
                    severity: 'medium',
                    description: 'La longueur de la traduction semble incohérente',
                    suggestion: 'Vérifier que la traduction est complète'
                });
                accuracyScore -= 15;
            }

            // Check for preserved legal terms
            const legalTermsCheck = this.validateLegalTermsPreservation(
                originalContent,
                translatedContent,
                sourceLanguage,
                targetLanguage
            );

            if (!legalTermsCheck.allTermsPreserved) {
                issues.push(...legalTermsCheck.issues);
                accuracyScore -= legalTermsCheck.penaltyScore;
            }

            // Check structure preservation (articles, clauses numbering)
            const structureCheck = this.validateStructurePreservation(originalContent, translatedContent);
            if (!structureCheck.structurePreserved) {
                issues.push(...structureCheck.issues);
                accuracyScore -= structureCheck.penaltyScore;
            }

            // Check for missing content
            const completenessCheck = this.validateTranslationCompleteness(originalContent, translatedContent);
            if (!completenessCheck.isComplete) {
                issues.push(...completenessCheck.issues);
                accuracyScore -= completenessCheck.penaltyScore;
            }

            return {
                isAccurate: accuracyScore >= 70,
                accuracyScore: Math.max(0, accuracyScore),
                issues,
                legalTermsPreserved: legalTermsCheck.allTermsPreserved,
                structurePreserved: structureCheck.structurePreserved,
                validatedAt: new Date()
            };

        } catch (error) {
            console.error('Translation validation error:', error);
            return {
                isAccurate: false,
                accuracyScore: 0,
                issues: [{
                    type: 'validation_error',
                    severity: 'critical',
                    description: 'Erreur lors de la validation de la traduction',
                    suggestion: 'Réviser manuellement la traduction'
                }],
                legalTermsPreserved: false,
                structurePreserved: false,
                validatedAt: new Date()
            };
        }
    }

    /**
     * Validate that legal terms are properly preserved in translation
     * @param {string} originalContent - Original content
     * @param {string} translatedContent - Translated content
     * @param {string} sourceLanguage - Source language
     * @param {string} targetLanguage - Target language
     * @returns {Object} Legal terms validation result
     */
    validateLegalTermsPreservation(originalContent, translatedContent, sourceLanguage, targetLanguage) {
        const issues = [];
        let penaltyScore = 0;
        const sourceTerms = this.legalTerms[sourceLanguage] || {};
        const targetTerms = this.legalTerms[targetLanguage] || {};

        const originalLower = originalContent.toLowerCase();
        const translatedLower = translatedContent.toLowerCase();

        // Check if key legal terms from source are appropriately translated
        for (const [frenchTerm, variations] of Object.entries(sourceTerms)) {
            const termFound = variations.some(variation =>
                originalLower.includes(variation.toLowerCase())
            );

            if (termFound) {
                // Check if corresponding term exists in translation
                const correspondingTargetTerm = this.findCorrespondingTerm(frenchTerm, targetTerms);
                if (correspondingTargetTerm) {
                    const targetTermFound = correspondingTargetTerm.some(variation =>
                        translatedLower.includes(variation.toLowerCase())
                    );

                    if (!targetTermFound) {
                        issues.push({
                            type: 'missing_legal_term',
                            severity: 'high',
                            description: `Terme juridique manquant dans la traduction: ${frenchTerm}`,
                            suggestion: `Ajouter la traduction appropriée du terme "${frenchTerm}"`
                        });
                        penaltyScore += 10;
                    }
                }
            }
        }

        return {
            allTermsPreserved: issues.length === 0,
            issues,
            penaltyScore
        };
    }

    /**
     * Find corresponding legal term in target language
     * @param {string} sourceTerm - Source term
     * @param {Object} targetTerms - Target language terms dictionary
     * @returns {Array|null} Corresponding terms or null
     */
    findCorrespondingTerm(sourceTerm, targetTerms) {
        // Simple mapping - in a real implementation, this would be more sophisticated
        const termMappings = {
            'contrat': 'fifanarahana',
            'clause': 'fepetra',
            'partie': 'mpandray anjara',
            'obligation': 'adidy',
            'responsabilité': 'tompon\'andraikitra',
            'résiliation': 'fanafoana',
            'signature': 'sonia',
            'juridiction': 'fitsarana'
        };

        const mappedTerm = termMappings[sourceTerm];
        return mappedTerm ? targetTerms[mappedTerm] : null;
    }

    /**
     * Validate that document structure is preserved in translation
     * @param {string} originalContent - Original content
     * @param {string} translatedContent - Translated content
     * @returns {Object} Structure validation result
     */
    validateStructurePreservation(originalContent, translatedContent) {
        const issues = [];
        let penaltyScore = 0;

        // Check for article/clause numbering preservation
        const originalArticles = this.extractStructuralElements(originalContent);
        const translatedArticles = this.extractStructuralElements(translatedContent);

        if (originalArticles.length !== translatedArticles.length) {
            issues.push({
                type: 'structure_mismatch',
                severity: 'high',
                description: 'Le nombre d\'articles/clauses ne correspond pas entre l\'original et la traduction',
                suggestion: 'Vérifier que tous les articles sont traduits'
            });
            penaltyScore += 20;
        }

        // Check for formatting preservation
        const originalFormatting = this.analyzeFormatting(originalContent);
        const translatedFormatting = this.analyzeFormatting(translatedContent);

        if (Math.abs(originalFormatting.paragraphs - translatedFormatting.paragraphs) > 2) {
            issues.push({
                type: 'formatting_loss',
                severity: 'medium',
                description: 'La structure de paragraphes n\'est pas préservée',
                suggestion: 'Maintenir la structure de paragraphes de l\'original'
            });
            penaltyScore += 10;
        }

        return {
            structurePreserved: issues.length === 0,
            issues,
            penaltyScore
        };
    }

    /**
     * Extract structural elements (articles, clauses) from content
     * @param {string} content - Document content
     * @returns {Array} Array of structural elements
     */
    extractStructuralElements(content) {
        const patterns = [
            /^Article\s+\d+/gmi,
            /^Clause\s+\d+/gmi,
            /^\d+\.\s+/gm,
            /^[IVX]+\.\s+/gm
        ];

        const elements = [];
        patterns.forEach(pattern => {
            const matches = content.match(pattern) || [];
            elements.push(...matches);
        });

        return elements;
    }

    /**
     * Analyze formatting characteristics of content
     * @param {string} content - Content to analyze
     * @returns {Object} Formatting analysis
     */
    analyzeFormatting(content) {
        return {
            paragraphs: content.split('\n\n').length,
            lines: content.split('\n').length,
            sentences: content.split(/[.!?]+/).length
        };
    }

    /**
     * Validate translation completeness
     * @param {string} originalContent - Original content
     * @param {string} translatedContent - Translated content
     * @returns {Object} Completeness validation result
     */
    validateTranslationCompleteness(originalContent, translatedContent) {
        const issues = [];
        let penaltyScore = 0;

        // Check if translation is significantly shorter (might indicate missing content)
        if (translatedContent.length < originalContent.length * 0.6) {
            issues.push({
                type: 'incomplete_translation',
                severity: 'critical',
                description: 'La traduction semble incomplète (trop courte)',
                suggestion: 'Vérifier que tout le contenu a été traduit'
            });
            penaltyScore += 30;
        }

        // Check for empty or very short translation
        if (translatedContent.trim().length < 100) {
            issues.push({
                type: 'insufficient_content',
                severity: 'critical',
                description: 'La traduction est trop courte pour être valide',
                suggestion: 'Recommencer la traduction'
            });
            penaltyScore += 50;
        }

        return {
            isComplete: issues.length === 0,
            issues,
            penaltyScore
        };
    }

    /**
     * Create side-by-side comparison data for translated documents
     * @param {Object} originalDocument - Original document
     * @param {Object} translatedDocument - Translated document
     * @returns {Object} Comparison data structure
     */
    createSideBySideComparison(originalDocument, translatedDocument) {
        try {
            const originalParagraphs = this.splitIntoParagraphs(originalDocument.content);
            const translatedParagraphs = this.splitIntoParagraphs(translatedDocument.content);

            // Align paragraphs for comparison
            const alignedComparison = this.alignParagraphsForComparison(
                originalParagraphs,
                translatedParagraphs
            );

            return {
                id: uuidv4(),
                originalDocument: {
                    id: originalDocument.id,
                    language: originalDocument.language,
                    title: originalDocument.title
                },
                translatedDocument: {
                    id: translatedDocument.id,
                    language: translatedDocument.language,
                    title: translatedDocument.title
                },
                comparison: alignedComparison,
                metadata: {
                    createdAt: new Date(),
                    totalParagraphs: Math.max(originalParagraphs.length, translatedParagraphs.length),
                    alignmentAccuracy: this.calculateAlignmentAccuracy(alignedComparison)
                }
            };
        } catch (error) {
            console.error('Error creating side-by-side comparison:', error);
            throw new Error(`Failed to create comparison: ${error.message}`);
        }
    }

    /**
     * Split document content into paragraphs for comparison
     * @param {string} content - Document content
     * @returns {Array} Array of paragraph objects
     */
    splitIntoParagraphs(content) {
        return content
            .split('\n\n')
            .map((paragraph, index) => ({
                id: uuidv4(),
                index,
                content: paragraph.trim(),
                type: this.identifyParagraphType(paragraph.trim())
            }))
            .filter(p => p.content.length > 0);
    }

    /**
     * Identify the type of paragraph (title, article, clause, etc.)
     * @param {string} content - Paragraph content
     * @returns {string} Paragraph type
     */
    identifyParagraphType(content) {
        if (/^Article\s+\d+/i.test(content)) return 'article';
        if (/^Clause\s+\d+/i.test(content)) return 'clause';
        if (/^\d+\.\s+/.test(content)) return 'numbered_item';
        if (/^[A-Z][A-Z\s]+:$/.test(content)) return 'section_title';
        if (content.length < 100 && content.endsWith(':')) return 'subtitle';
        return 'paragraph';
    }

    /**
     * Align paragraphs between original and translated versions
     * @param {Array} originalParagraphs - Original paragraphs
     * @param {Array} translatedParagraphs - Translated paragraphs
     * @returns {Array} Aligned comparison data
     */
    alignParagraphsForComparison(originalParagraphs, translatedParagraphs) {
        const aligned = [];
        const maxLength = Math.max(originalParagraphs.length, translatedParagraphs.length);

        for (let i = 0; i < maxLength; i++) {
            const original = originalParagraphs[i] || null;
            const translated = translatedParagraphs[i] || null;

            aligned.push({
                id: uuidv4(),
                index: i,
                original,
                translated,
                isAligned: original && translated && original.type === translated.type,
                confidence: this.calculateParagraphAlignmentConfidence(original, translated)
            });
        }

        return aligned;
    }

    /**
     * Calculate alignment confidence between two paragraphs
     * @param {Object|null} original - Original paragraph
     * @param {Object|null} translated - Translated paragraph
     * @returns {number} Confidence score (0-1)
     */
    calculateParagraphAlignmentConfidence(original, translated) {
        if (!original || !translated) return 0;
        if (original.type !== translated.type) return 0.3;

        // Simple length-based confidence (can be improved with more sophisticated algorithms)
        const lengthRatio = Math.min(original.content.length, translated.content.length) /
            Math.max(original.content.length, translated.content.length);

        return lengthRatio * 0.7 + 0.3; // Base confidence + length similarity
    }

    /**
     * Calculate overall alignment accuracy for the comparison
     * @param {Array} alignedComparison - Aligned comparison data
     * @returns {number} Accuracy percentage (0-100)
     */
    calculateAlignmentAccuracy(alignedComparison) {
        if (alignedComparison.length === 0) return 0;

        const alignedCount = alignedComparison.filter(item => item.isAligned).length;
        return Math.round((alignedCount / alignedComparison.length) * 100);
    }

    /**
     * Validate translation request input
     * @param {Object} document - Document to translate
     * @param {string} targetLanguage - Target language
     * @throws {Error} If validation fails
     */
    validateTranslationRequest(document, targetLanguage) {
        if (!document) {
            throw new Error('Document is required for translation');
        }

        if (!document.content || document.content.trim().length === 0) {
            throw new Error('Document content cannot be empty');
        }

        if (!Object.values(Language).includes(targetLanguage)) {
            throw new Error('Invalid target language');
        }

        if (!Object.values(Language).includes(document.language)) {
            throw new Error('Invalid source language in document');
        }

        // Check if translation is supported (allow same language)
        if (document.language !== targetLanguage) {
            const supportedPairs = [
                [Language.FRENCH, Language.MALAGASY],
                [Language.MALAGASY, Language.FRENCH],
                [Language.FRENCH, Language.ENGLISH],
                [Language.ENGLISH, Language.FRENCH]
            ];

            const isSupported = supportedPairs.some(([source, target]) =>
                document.language === source && targetLanguage === target
            );

            if (!isSupported) {
                throw new Error(`Translation from ${document.language} to ${targetLanguage} is not supported`);
            }
        }
    }
}

module.exports = TranslationService;