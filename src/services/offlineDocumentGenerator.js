/**
 * Offline Document Generator Service
 * Handles basic document generation when offline using local templates and Ollama
 * Provides fallback functionality when cloud services are unavailable
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { DocumentType, Language } = require('../types/enums.js');
const OfflineStorageService = require('./offlineStorageService');

class OfflineDocumentGeneratorService {
    constructor() {
        this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        this.ollamaModel = process.env.OLLAMA_MODEL || 'llama2';
        this.offlineStorage = new OfflineStorageService();
        this.timeout = 30000; // 30 seconds

        // Initialize basic templates
        this.initializeBasicTemplates();
    }

    /**
     * Initialize basic document templates for offline use
     */
    async initializeBasicTemplates() {
        try {
            const basicTemplates = this.getBasicTemplates();

            for (const template of basicTemplates) {
                const existingTemplate = await this.offlineStorage.getTemplates(
                    template.type,
                    template.language
                );

                if (existingTemplate.length === 0) {
                    await this.offlineStorage.storeTemplate(template);
                }
            }

            console.log('Basic templates initialized for offline use');
        } catch (error) {
            console.error('Error initializing basic templates:', error);
        }
    }

    /**
     * Generate document offline using local resources
     * @param {Object} contractRequest - Contract generation request
     * @returns {Promise<Object>} Generated document
     */
    async generateDocumentOffline(contractRequest) {
        const startTime = Date.now();

        try {
            // Validate input
            this.validateContractRequest(contractRequest);

            let document = null;

            // Try Ollama first if available
            if (await this.isOllamaAvailable()) {
                console.log('Generating document with Ollama (offline)...');
                document = await this.generateWithOllamaOffline(contractRequest);
            }

            // Fallback to template-based generation
            if (!document) {
                console.log('Ollama unavailable, using template-based generation...');
                document = await this.generateFromTemplate(contractRequest);
            }

            if (!document) {
                throw new Error('Offline document generation failed');
            }

            // Mark as offline-generated
            document.metadata = {
                ...document.metadata,
                generatedOffline: true,
                processingTime: Date.now() - startTime,
                generatedAt: new Date(),
                needsOnlineValidation: true
            };

            // Store locally
            await this.offlineStorage.storeDocument(document);

            return document;

        } catch (error) {
            console.error('Offline document generation error:', error);
            throw new Error(`Offline generation failed: ${error.message}`);
        }
    }

    /**
     * Check if Ollama is available locally
     * @returns {Promise<boolean>} Ollama availability
     */
    async isOllamaAvailable() {
        try {
            const response = await axios.get(`${this.ollamaUrl}/api/tags`, {
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    /**
     * Generate document using Ollama with offline-optimized prompts
     * @param {Object} contractRequest - Contract generation request
     * @returns {Promise<Object|null>} Generated document or null
     */
    async generateWithOllamaOffline(contractRequest) {
        try {
            const prompt = this.buildOfflinePrompt(contractRequest);

            const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
                model: this.ollamaModel,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.2, // Lower temperature for more consistent results
                    top_p: 0.8,
                    max_tokens: 2000, // Reduced for offline efficiency
                    stop: ['---END---']
                }
            }, {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data && response.data.response) {
                return this.parseGeneratedDocument(
                    response.data.response,
                    contractRequest,
                    'ollama-offline'
                );
            }

            return null;
        } catch (error) {
            console.error('Ollama offline generation error:', error.message);
            return null;
        }
    }

    /**
     * Generate document from local templates
     * @param {Object} contractRequest - Contract generation request
     * @returns {Promise<Object>} Generated document
     */
    async generateFromTemplate(contractRequest) {
        try {
            // Find matching template
            const templates = await this.offlineStorage.getTemplates(
                contractRequest.type,
                contractRequest.language
            );

            let template = templates.find(t => t.type === contractRequest.type);

            if (!template) {
                // Fallback to generic template
                template = templates.find(t => t.type === 'generic');
            }

            if (!template) {
                throw new Error('No suitable template found for offline generation');
            }

            // Fill template with request data
            const filledContent = this.fillTemplate(template.content, contractRequest);

            // Generate clauses from template
            const clauses = this.generateClausesFromTemplate(template, contractRequest);

            return {
                id: uuidv4(),
                type: contractRequest.type,
                title: this.generateTitle(contractRequest),
                content: filledContent,
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
                    generatedBy: 'template',
                    templateId: template.id,
                    jurisdiction: contractRequest.jurisdiction,
                    tags: [contractRequest.type, contractRequest.language, 'offline']
                },
                createdBy: 'system',
                createdAt: new Date(),
                updatedAt: new Date()
            };

        } catch (error) {
            console.error('Template-based generation error:', error);
            throw error;
        }
    }

    /**
     * Build optimized prompt for offline generation
     * @param {Object} contractRequest - Contract generation request
     * @returns {string} Optimized prompt
     */
    buildOfflinePrompt(contractRequest) {
        const { type, language, description, parties, jurisdiction } = contractRequest;

        const languageInstructions = {
            [Language.FRENCH]: 'Rédigez en français selon le droit malgache.',
            [Language.MALAGASY]: 'Soraty amin\'ny teny malagasy.',
            [Language.ENGLISH]: 'Write in English following Malagasy law.'
        };

        const documentTypes = {
            [DocumentType.CONTRACT]: 'contrat commercial',
            [DocumentType.LEASE]: 'contrat de bail',
            [DocumentType.SALE_AGREEMENT]: 'contrat de vente',
            [DocumentType.EMPLOYMENT_CONTRACT]: 'contrat de travail'
        };

        const partiesInfo = parties.map(party =>
            `${party.name} (${party.role})`
        ).join(', ');

        return `
Créez un ${documentTypes[type] || 'document juridique'} simple et valide.
${languageInstructions[language]}

DESCRIPTION: ${description}
PARTIES: ${partiesInfo}
JURIDICTION: ${jurisdiction}

Incluez uniquement les clauses essentielles:
1. Identification des parties
2. Objet du contrat
3. Obligations principales
4. Durée et résiliation
5. Signatures

Restez concis et professionnel.
---END---
        `.trim();
    }

    /**
     * Fill template with contract request data
     * @param {string} templateContent - Template content
     * @param {Object} contractRequest - Contract request
     * @returns {string} Filled template
     */
    fillTemplate(templateContent, contractRequest) {
        let content = templateContent;

        // Replace placeholders
        const replacements = {
            '{{TITLE}}': this.generateTitle(contractRequest),
            '{{DATE}}': new Date().toLocaleDateString('fr-FR'),
            '{{DESCRIPTION}}': contractRequest.description,
            '{{JURISDICTION}}': contractRequest.jurisdiction,
            '{{PARTY_1_NAME}}': contractRequest.parties[0]?.name || '[PARTIE 1]',
            '{{PARTY_1_ROLE}}': contractRequest.parties[0]?.role || '[RÔLE 1]',
            '{{PARTY_1_EMAIL}}': contractRequest.parties[0]?.email || '[EMAIL 1]',
            '{{PARTY_2_NAME}}': contractRequest.parties[1]?.name || '[PARTIE 2]',
            '{{PARTY_2_ROLE}}': contractRequest.parties[1]?.role || '[RÔLE 2]',
            '{{PARTY_2_EMAIL}}': contractRequest.parties[1]?.email || '[EMAIL 2]',
            '{{SPECIFIC_CLAUSES}}': contractRequest.specificClauses?.join('\n') || ''
        };

        for (const [placeholder, value] of Object.entries(replacements)) {
            content = content.replace(new RegExp(placeholder, 'g'), value);
        }

        return content;
    }

    /**
     * Generate clauses from template
     * @param {Object} template - Document template
     * @param {Object} contractRequest - Contract request
     * @returns {Array} Generated clauses
     */
    generateClausesFromTemplate(template, contractRequest) {
        const clauses = [];
        let position = 0;

        // Standard clauses based on document type
        const standardClauses = this.getStandardClauses(contractRequest.type, contractRequest.language);

        for (const clauseTemplate of standardClauses) {
            clauses.push({
                id: uuidv4(),
                title: clauseTemplate.title,
                content: this.fillTemplate(clauseTemplate.content, contractRequest),
                position: position++,
                isRequired: clauseTemplate.isRequired,
                category: clauseTemplate.category
            });
        }

        // Add specific clauses if provided
        if (contractRequest.specificClauses) {
            for (const specificClause of contractRequest.specificClauses) {
                clauses.push({
                    id: uuidv4(),
                    title: `Clause spécifique ${position + 1}`,
                    content: specificClause,
                    position: position++,
                    isRequired: false,
                    category: 'specific'
                });
            }
        }

        return clauses;
    }

    /**
     * Generate document title
     * @param {Object} contractRequest - Contract request
     * @returns {string} Generated title
     */
    generateTitle(contractRequest) {
        const typeNames = {
            [DocumentType.CONTRACT]: 'Contrat Commercial',
            [DocumentType.LEASE]: 'Contrat de Bail',
            [DocumentType.SALE_AGREEMENT]: 'Contrat de Vente',
            [DocumentType.EMPLOYMENT_CONTRACT]: 'Contrat de Travail',
            [DocumentType.SERVICE_AGREEMENT]: 'Contrat de Prestation',
            [DocumentType.PARTNERSHIP_AGREEMENT]: 'Contrat de Partenariat'
        };

        const baseName = typeNames[contractRequest.type] || 'Document Juridique';
        const date = new Date().toLocaleDateString('fr-FR');

        return `${baseName} - ${date}`;
    }

    /**
     * Parse generated document text into structured format
     * @param {string} generatedText - Generated text
     * @param {Object} contractRequest - Original request
     * @param {string} method - Generation method
     * @returns {Object} Structured document
     */
    parseGeneratedDocument(generatedText, contractRequest, method) {
        const lines = generatedText.split('\n').filter(line => line.trim());
        const title = lines[0] || this.generateTitle(contractRequest);

        // Extract clauses
        const clauses = this.extractClausesFromText(generatedText);

        return {
            id: uuidv4(),
            type: contractRequest.type,
            title: title.replace(/^#+\s*/, ''),
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
                aiModel: method,
                jurisdiction: contractRequest.jurisdiction,
                tags: [contractRequest.type, contractRequest.language, 'offline']
            },
            createdBy: 'system',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * Extract clauses from generated text
     * @param {string} text - Generated text
     * @returns {Array} Extracted clauses
     */
    extractClausesFromText(text) {
        const clauses = [];
        const lines = text.split('\n');
        let currentClause = null;
        let position = 0;

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (this.isClauseHeader(trimmedLine)) {
                if (currentClause) {
                    clauses.push({
                        ...currentClause,
                        content: currentClause.content.trim()
                    });
                }

                currentClause = {
                    id: uuidv4(),
                    title: trimmedLine,
                    content: '',
                    position: position++,
                    isRequired: true,
                    category: 'general'
                };
            } else if (currentClause && trimmedLine) {
                currentClause.content += (currentClause.content ? '\n' : '') + trimmedLine;
            }
        }

        if (currentClause) {
            clauses.push({
                ...currentClause,
                content: currentClause.content.trim()
            });
        }

        return clauses;
    }

    /**
     * Check if line is a clause header
     * @param {string} line - Line to check
     * @returns {boolean} True if clause header
     */
    isClauseHeader(line) {
        const patterns = [
            /^Article\s+\d+/i,
            /^Clause\s+\d+/i,
            /^\d+\.\s+/,
            /^[IVX]+\.\s+/
        ];

        return patterns.some(pattern => pattern.test(line));
    }

    /**
     * Get basic templates for offline use
     * @returns {Array} Basic templates
     */
    getBasicTemplates() {
        return [
            {
                id: 'basic-contract-fr',
                type: DocumentType.CONTRACT,
                language: Language.FRENCH,
                name: 'Contrat Commercial de Base',
                content: `{{TITLE}}

Date: {{DATE}}

ENTRE LES SOUSSIGNÉS :

{{PARTY_1_NAME}}, {{PARTY_1_ROLE}}
Email: {{PARTY_1_EMAIL}}

ET

{{PARTY_2_NAME}}, {{PARTY_2_ROLE}}
Email: {{PARTY_2_EMAIL}}

IL A ÉTÉ CONVENU CE QUI SUIT :

Article 1 - Objet du contrat
{{DESCRIPTION}}

Article 2 - Obligations des parties
Chaque partie s'engage à respecter les termes du présent contrat.

Article 3 - Durée
Le présent contrat prend effet à la date de signature.

Article 4 - Résiliation
Le contrat peut être résilié par accord mutuel des parties.

Article 5 - Juridiction
Tout litige sera soumis aux tribunaux de {{JURISDICTION}}.

{{SPECIFIC_CLAUSES}}

Fait en double exemplaire.

Signatures :
{{PARTY_1_NAME}} : ________________
{{PARTY_2_NAME}} : ________________`
            },
            {
                id: 'basic-lease-fr',
                type: DocumentType.LEASE,
                language: Language.FRENCH,
                name: 'Contrat de Bail de Base',
                content: `CONTRAT DE BAIL

Date: {{DATE}}

ENTRE :
Le bailleur : {{PARTY_1_NAME}}
Email: {{PARTY_1_EMAIL}}

ET :
Le locataire : {{PARTY_2_NAME}}
Email: {{PARTY_2_EMAIL}}

Article 1 - Objet de la location
{{DESCRIPTION}}

Article 2 - Durée du bail
La durée du bail est à convenir entre les parties.

Article 3 - Loyer
Le montant du loyer sera défini par accord mutuel.

Article 4 - Charges
Les charges sont à la charge du locataire sauf accord contraire.

Article 5 - Résiliation
Le bail peut être résilié selon les conditions légales.

Juridiction : {{JURISDICTION}}

{{SPECIFIC_CLAUSES}}

Signatures :
Bailleur : ________________
Locataire : ________________`
            }
        ];
    }

    /**
     * Get standard clauses for document type
     * @param {string} documentType - Document type
     * @param {string} language - Document language
     * @returns {Array} Standard clauses
     */
    getStandardClauses(documentType, language) {
        const clausesByType = {
            [DocumentType.CONTRACT]: [
                {
                    title: 'Objet du contrat',
                    content: '{{DESCRIPTION}}',
                    isRequired: true,
                    category: 'purpose'
                },
                {
                    title: 'Obligations des parties',
                    content: 'Chaque partie s\'engage à respecter les termes du présent contrat.',
                    isRequired: true,
                    category: 'obligations'
                },
                {
                    title: 'Durée',
                    content: 'Le présent contrat prend effet à la date de signature.',
                    isRequired: true,
                    category: 'duration'
                }
            ],
            [DocumentType.LEASE]: [
                {
                    title: 'Objet de la location',
                    content: '{{DESCRIPTION}}',
                    isRequired: true,
                    category: 'purpose'
                },
                {
                    title: 'Durée du bail',
                    content: 'La durée du bail est à convenir entre les parties.',
                    isRequired: true,
                    category: 'duration'
                },
                {
                    title: 'Loyer et charges',
                    content: 'Le montant du loyer et des charges sera défini par accord mutuel.',
                    isRequired: true,
                    category: 'financial'
                }
            ]
        };

        return clausesByType[documentType] || [
            {
                title: 'Objet',
                content: '{{DESCRIPTION}}',
                isRequired: true,
                category: 'general'
            }
        ];
    }

    /**
     * Validate contract request
     * @param {Object} contractRequest - Request to validate
     */
    validateContractRequest(contractRequest) {
        if (!contractRequest) {
            throw new Error('Contract request is required');
        }

        const { type, language, description, parties } = contractRequest;

        if (!Object.values(DocumentType).includes(type)) {
            throw new Error('Invalid document type');
        }

        if (!Object.values(Language).includes(language)) {
            throw new Error('Invalid language');
        }

        if (!description || description.length < 5) {
            throw new Error('Description must be at least 5 characters long');
        }

        if (!parties || parties.length === 0) {
            throw new Error('At least one party is required');
        }
    }

    /**
     * Get offline generation capabilities
     * @returns {Promise<Object>} Capabilities information
     */
    async getOfflineCapabilities() {
        const ollamaAvailable = await this.isOllamaAvailable();
        const templates = await this.offlineStorage.getTemplates();

        return {
            ollamaAvailable,
            templatesCount: templates.length,
            supportedTypes: Object.values(DocumentType),
            supportedLanguages: Object.values(Language),
            features: {
                basicGeneration: true,
                templateBased: true,
                aiGeneration: ollamaAvailable,
                clauseExtraction: true,
                localStorage: true
            }
        };
    }
}

module.exports = OfflineDocumentGeneratorService;