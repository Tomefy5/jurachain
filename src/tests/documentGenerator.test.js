const DocumentGeneratorService = require('../services/documentGenerator');
const { DocumentType, Language } = require('../types/enums.js');

describe('DocumentGeneratorService', () => {
    let documentGenerator;

    beforeEach(() => {
        documentGenerator = new DocumentGeneratorService();
    });

    describe('validateContractRequest', () => {
        test('should validate a valid contract request', () => {
            const validRequest = {
                type: DocumentType.CONTRACT,
                language: Language.FRENCH,
                description: 'Contrat de vente pour un véhicule',
                parties: [
                    { name: 'Jean Dupont', email: 'jean@example.com', role: 'buyer' },
                    { name: 'Marie Martin', email: 'marie@example.com', role: 'seller' }
                ],
                jurisdiction: 'Madagascar'
            };

            expect(() => {
                documentGenerator.validateContractRequest(validRequest);
            }).not.toThrow();
        });

        test('should throw error for missing description', () => {
            const invalidRequest = {
                type: DocumentType.CONTRACT,
                language: Language.FRENCH,
                description: 'short',
                parties: [{ name: 'Test', email: 'test@example.com', role: 'buyer' }],
                jurisdiction: 'Madagascar'
            };

            expect(() => {
                documentGenerator.validateContractRequest(invalidRequest);
            }).toThrow('Description must be at least 10 characters long');
        });

        test('should throw error for invalid document type', () => {
            const invalidRequest = {
                type: 'invalid_type',
                language: Language.FRENCH,
                description: 'Valid description here',
                parties: [{ name: 'Test', email: 'test@example.com', role: 'buyer' }],
                jurisdiction: 'Madagascar'
            };

            expect(() => {
                documentGenerator.validateContractRequest(invalidRequest);
            }).toThrow('Invalid document type');
        });

        test('should throw error for missing parties', () => {
            const invalidRequest = {
                type: DocumentType.CONTRACT,
                language: Language.FRENCH,
                description: 'Valid description here',
                parties: [],
                jurisdiction: 'Madagascar'
            };

            expect(() => {
                documentGenerator.validateContractRequest(invalidRequest);
            }).toThrow('At least one party is required');
        });
    });

    describe('buildPrompt', () => {
        test('should build a proper prompt for French contract', () => {
            const contractRequest = {
                type: DocumentType.CONTRACT,
                language: Language.FRENCH,
                description: 'Contrat de vente d\'un véhicule',
                parties: [
                    { name: 'Jean Dupont', email: 'jean@example.com', role: 'buyer', address: '123 Rue Test' },
                    { name: 'Marie Martin', email: 'marie@example.com', role: 'seller' }
                ],
                jurisdiction: 'Madagascar',
                specificClauses: ['Garantie de 6 mois', 'Paiement en 3 fois']
            };

            const prompt = documentGenerator.buildPrompt(contractRequest);

            expect(prompt).toContain('français');
            expect(prompt).toContain('droit malgache');
            expect(prompt).toContain('contrat commercial');
            expect(prompt).toContain('Jean Dupont');
            expect(prompt).toContain('Marie Martin');
            expect(prompt).toContain('Garantie de 6 mois');
            expect(prompt).toContain('Madagascar');
        });

        test('should build a proper prompt for Malagasy lease', () => {
            const contractRequest = {
                type: DocumentType.LEASE,
                language: Language.MALAGASY,
                description: 'Contrat de bail pour appartement',
                parties: [
                    { name: 'Rakoto', email: 'rakoto@example.com', role: 'tenant' },
                    { name: 'Rasoa', email: 'rasoa@example.com', role: 'landlord' }
                ],
                jurisdiction: 'Antananarivo'
            };

            const prompt = documentGenerator.buildPrompt(contractRequest);

            expect(prompt).toContain('malagasy');
            expect(prompt).toContain('contrat de bail');
            expect(prompt).toContain('Rakoto');
            expect(prompt).toContain('Rasoa');
            expect(prompt).toContain('Antananarivo');
        });
    });

    describe('parseGeneratedDocument', () => {
        test('should parse generated document correctly', () => {
            const generatedText = `
CONTRAT DE VENTE

Article 1 - Objet du contrat
Le présent contrat a pour objet la vente d'un véhicule.

Article 2 - Prix
Le prix de vente est fixé à 1000000 Ar.

Article 3 - Modalités de paiement
Le paiement s'effectue comptant.
            `.trim();

            const contractRequest = {
                type: DocumentType.SALE_AGREEMENT,
                language: Language.FRENCH,
                parties: [
                    { name: 'Jean', email: 'jean@example.com', role: 'buyer' }
                ],
                jurisdiction: 'Madagascar'
            };

            const document = documentGenerator.parseGeneratedDocument(generatedText, contractRequest, 'test');

            expect(document.title).toBe('CONTRAT DE VENTE');
            expect(document.content).toBe(generatedText);
            expect(document.type).toBe(DocumentType.SALE_AGREEMENT);
            expect(document.language).toBe(Language.FRENCH);
            expect(document.clauses).toHaveLength(3);
            expect(document.clauses[0].title).toContain('Article 1');
            expect(document.clauses[0].content).toContain('objet la vente');
            expect(document.metadata.aiModel).toBe('test');
        });
    });

    describe('isClauseHeader', () => {
        test('should identify clause headers correctly', () => {
            expect(documentGenerator.isClauseHeader('Article 1 - Objet')).toBe(true);
            expect(documentGenerator.isClauseHeader('Clause 2 - Prix')).toBe(true);
            expect(documentGenerator.isClauseHeader('1. Introduction')).toBe(true);
            expect(documentGenerator.isClauseHeader('I. Préambule')).toBe(true);
            expect(documentGenerator.isClauseHeader('ARTICLE I')).toBe(true);
            expect(documentGenerator.isClauseHeader('This is regular text')).toBe(false);
            expect(documentGenerator.isClauseHeader('Simple paragraph content')).toBe(false);
        });
    });

    describe('categorizeClause', () => {
        test('should categorize clauses correctly', () => {
            expect(documentGenerator.categorizeClause('Article 1 - Objet du contrat')).toBe('purpose');
            expect(documentGenerator.categorizeClause('Clause 2 - Prix de vente')).toBe('financial');
            expect(documentGenerator.categorizeClause('Article 3 - Durée du contrat')).toBe('duration');
            expect(documentGenerator.categorizeClause('Clause 4 - Résiliation')).toBe('termination');
            expect(documentGenerator.categorizeClause('Article 5 - Responsabilité')).toBe('liability');
            expect(documentGenerator.categorizeClause('Clause 6 - Signature')).toBe('execution');
            expect(documentGenerator.categorizeClause('Article 7 - Litiges')).toBe('dispute');
            expect(documentGenerator.categorizeClause('Article 8 - Divers')).toBe('general');
        });
    });

    describe('getRequiredClauses', () => {
        test('should return required clauses for contract', () => {
            const clauses = documentGenerator.getRequiredClauses(DocumentType.CONTRACT);
            expect(clauses).toHaveLength(4);
            expect(clauses.some(c => c.name.includes('Objet'))).toBe(true);
            expect(clauses.some(c => c.name.includes('Prix'))).toBe(true);
        });

        test('should return required clauses for lease', () => {
            const clauses = documentGenerator.getRequiredClauses(DocumentType.LEASE);
            expect(clauses).toHaveLength(4);
            expect(clauses.some(c => c.name.includes('bien'))).toBe(true);
            expect(clauses.some(c => c.name.includes('Loyer'))).toBe(true);
        });

        test('should return default clauses for unknown type', () => {
            const clauses = documentGenerator.getRequiredClauses('unknown');
            expect(clauses).toHaveLength(2);
            expect(clauses.some(c => c.name.includes('Objet'))).toBe(true);
        });
    });

    describe('validateCompliance', () => {
        test('should validate document compliance', async () => {
            const document = {
                id: 'test-id',
                type: DocumentType.CONTRACT,
                content: 'Contrat avec objet défini, prix fixé, obligations des parties et clause de résiliation.',
                parties: [{ name: 'Test', email: 'test@example.com' }],
                metadata: { jurisdiction: 'Madagascar' }
            };

            const report = await documentGenerator.validateCompliance(document);

            expect(report.documentId).toBe('test-id');
            expect(report.jurisdiction).toBe('Madagascar');
            expect(report.score).toBeGreaterThan(0);
            expect(report.isCompliant).toBeDefined();
            expect(Array.isArray(report.issues)).toBe(true);
        });

        test('should detect missing parties', async () => {
            const document = {
                id: 'test-id',
                type: DocumentType.CONTRACT,
                content: 'Contrat complet avec toutes les clauses nécessaires.',
                parties: [],
                metadata: { jurisdiction: 'Madagascar' }
            };

            const report = await documentGenerator.validateCompliance(document);

            expect(report.score).toBeLessThan(100);
            expect(report.issues.some(issue => issue.type === 'missing_parties')).toBe(true);
        });

        test('should detect insufficient content', async () => {
            const document = {
                id: 'test-id',
                type: DocumentType.CONTRACT,
                content: 'Court',
                parties: [{ name: 'Test' }],
                metadata: { jurisdiction: 'Madagascar' }
            };

            const report = await documentGenerator.validateCompliance(document);

            expect(report.issues.some(issue => issue.type === 'insufficient_content')).toBe(true);
        });
    });

    describe('translateDocument', () => {
        test('should translate document using translation service', async () => {
            const document = {
                id: 'test-doc-id',
                content: 'Contrat de vente en français',
                language: Language.FRENCH,
                type: DocumentType.CONTRACT,
                title: 'Contrat de Vente',
                metadata: {
                    jurisdiction: 'Madagascar'
                }
            };

            // Mock the translation service method
            const mockTranslationResult = {
                success: true,
                translatedDocument: {
                    ...document,
                    id: 'translated-doc-id',
                    content: 'Fifanarahana fivarotana amin\'ny teny malagasy',
                    language: Language.MALAGASY
                },
                accuracyScore: 85,
                validationReport: {
                    isAccurate: true,
                    legalTermsPreserved: true,
                    structurePreserved: true
                }
            };

            documentGenerator.translationService.translateDocument = jest.fn().mockResolvedValue(mockTranslationResult);

            const result = await documentGenerator.translateDocument(document, Language.MALAGASY);

            expect(result.success).toBe(true);
            expect(result.translatedDocument.language).toBe(Language.MALAGASY);
            expect(result.accuracyScore).toBe(85);
            expect(documentGenerator.translationService.translateDocument).toHaveBeenCalledWith(document, Language.MALAGASY);
        });

        test('should handle translation errors', async () => {
            const document = {
                id: 'test-doc-id',
                content: 'Test content',
                language: Language.FRENCH
            };

            documentGenerator.translationService.translateDocument = jest.fn().mockRejectedValue(new Error('Translation failed'));

            await expect(documentGenerator.translateDocument(document, Language.MALAGASY))
                .rejects.toThrow('Document translation failed: Translation failed');
        });
    });
});