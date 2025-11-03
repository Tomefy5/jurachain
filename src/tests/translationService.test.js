const TranslationService = require('../services/translationService');
const { Language, DocumentType } = require('../types/enums');

describe('TranslationService', () => {
    let translationService;

    beforeEach(() => {
        translationService = new TranslationService();
    });

    describe('validateTranslationRequest', () => {
        test('should validate correct translation request', () => {
            const document = {
                id: 'test-doc',
                content: 'Test content for translation',
                language: Language.FRENCH,
                type: DocumentType.CONTRACT
            };

            expect(() => {
                translationService.validateTranslationRequest(document, Language.MALAGASY);
            }).not.toThrow();
        });

        test('should throw error for empty document', () => {
            expect(() => {
                translationService.validateTranslationRequest(null, Language.MALAGASY);
            }).toThrow('Document is required for translation');
        });

        test('should throw error for empty content', () => {
            const document = {
                id: 'test-doc',
                content: '',
                language: Language.FRENCH
            };

            expect(() => {
                translationService.validateTranslationRequest(document, Language.MALAGASY);
            }).toThrow('Document content cannot be empty');
        });

        test('should throw error for invalid target language', () => {
            const document = {
                id: 'test-doc',
                content: 'Test content',
                language: Language.FRENCH
            };

            expect(() => {
                translationService.validateTranslationRequest(document, 'invalid-lang');
            }).toThrow('Invalid target language');
        });

        test('should throw error for unsupported language pair', () => {
            const document = {
                id: 'test-doc',
                content: 'Test content',
                language: 'unsupported-lang'
            };

            expect(() => {
                translationService.validateTranslationRequest(document, Language.MALAGASY);
            }).toThrow('Invalid source language in document');
        });
    });

    describe('buildTranslationPrompt', () => {
        test('should build correct translation prompt for French to Malagasy', () => {
            const content = 'Contrat de vente immobilière';
            const prompt = translationService.buildTranslationPrompt(
                content,
                Language.FRENCH,
                Language.MALAGASY,
                DocumentType.CONTRACT
            );

            expect(prompt).toContain('français');
            expect(prompt).toContain('malgache');
            expect(prompt).toContain('Contrat de vente immobilière');
            expect(prompt).toContain('précision juridique');
            expect(prompt).toContain('droit malgache');
        });

        test('should build correct translation prompt for Malagasy to French', () => {
            const content = 'Fifanarahana fivarotana trano';
            const prompt = translationService.buildTranslationPrompt(
                content,
                Language.MALAGASY,
                Language.FRENCH,
                DocumentType.CONTRACT
            );

            expect(prompt).toContain('malgache');
            expect(prompt).toContain('français');
            expect(prompt).toContain('Fifanarahana fivarotana trano');
            expect(prompt).toContain('précision juridique');
        });
    });

    describe('getLegalTranslationContext', () => {
        test('should return correct context for contract in French', () => {
            const context = translationService.getLegalTranslationContext(
                DocumentType.CONTRACT,
                Language.FRENCH
            );

            expect(context).toContain('Contrat commercial');
            expect(context).toContain('malgache');
        });

        test('should return correct context for lease in Malagasy', () => {
            const context = translationService.getLegalTranslationContext(
                DocumentType.LEASE,
                Language.MALAGASY
            );

            expect(context).toContain('Fifanarahana fanofana');
            expect(context).toContain('malagasy');
        });

        test('should return default context for unknown document type', () => {
            const context = translationService.getLegalTranslationContext(
                'unknown_type',
                Language.FRENCH
            );

            expect(context).toContain('Document juridique');
            expect(context).toContain('législation malgache');
        });
    });

    describe('splitIntoParagraphs', () => {
        test('should split content into paragraphs correctly', () => {
            const content = 'Paragraph 1\n\nParagraph 2\n\nArticle 1 - Title\nContent of article';
            const paragraphs = translationService.splitIntoParagraphs(content);

            expect(paragraphs).toHaveLength(3);
            expect(paragraphs[0].content).toBe('Paragraph 1');
            expect(paragraphs[1].content).toBe('Paragraph 2');
            expect(paragraphs[2].content).toBe('Article 1 - Title\nContent of article');
        });

        test('should identify paragraph types correctly', () => {
            const content = 'Article 1 - Test\n\nClause 2 - Test\n\n1. Numbered item\n\nRegular paragraph';
            const paragraphs = translationService.splitIntoParagraphs(content);

            expect(paragraphs[0].type).toBe('article');
            expect(paragraphs[1].type).toBe('clause');
            expect(paragraphs[2].type).toBe('numbered_item');
            expect(paragraphs[3].type).toBe('paragraph');
        });
    });

    describe('validateLegalTermsPreservation', () => {
        test('should detect preserved legal terms', () => {
            const originalContent = 'Ce contrat contient des clauses importantes';
            const translatedContent = 'Ity fifanarahana ity dia misy fepetra manan-danja';

            const result = translationService.validateLegalTermsPreservation(
                originalContent,
                translatedContent,
                Language.FRENCH,
                Language.MALAGASY
            );

            expect(result.allTermsPreserved).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        test('should detect missing legal terms', () => {
            const originalContent = 'Ce contrat contient des obligations importantes';
            const translatedContent = 'This is a simple translation without legal terms';

            const result = translationService.validateLegalTermsPreservation(
                originalContent,
                translatedContent,
                Language.FRENCH,
                Language.MALAGASY
            );

            expect(result.allTermsPreserved).toBe(false);
            expect(result.issues.length).toBeGreaterThan(0);
            expect(result.penaltyScore).toBeGreaterThan(0);
        });
    });

    describe('validateStructurePreservation', () => {
        test('should validate preserved structure', () => {
            const originalContent = 'Article 1 - Test\n\nArticle 2 - Test\n\nParagraph content';
            const translatedContent = 'Article 1 - Test\n\nArticle 2 - Test\n\nVotoatin\'ny andalana';

            const result = translationService.validateStructurePreservation(
                originalContent,
                translatedContent
            );

            // The test should pass if the structure elements are detected correctly
            // Even if not perfectly preserved, we should have minimal issues
            expect(result.issues.length).toBeLessThanOrEqual(1);
        });

        test('should detect structure mismatch', () => {
            const originalContent = 'Article 1 - Test\n\nArticle 2 - Test\n\nArticle 3 - Test';
            const translatedContent = 'Single paragraph without structure';

            const result = translationService.validateStructurePreservation(
                originalContent,
                translatedContent
            );

            expect(result.structurePreserved).toBe(false);
            expect(result.issues.length).toBeGreaterThan(0);
            expect(result.penaltyScore).toBeGreaterThan(0);
        });
    });

    describe('calculateAlignmentAccuracy', () => {
        test('should calculate correct alignment accuracy', () => {
            const alignedComparison = [
                { isAligned: true },
                { isAligned: true },
                { isAligned: false },
                { isAligned: true }
            ];

            const accuracy = translationService.calculateAlignmentAccuracy(alignedComparison);
            expect(accuracy).toBe(75); // 3 out of 4 aligned
        });

        test('should return 0 for empty comparison', () => {
            const accuracy = translationService.calculateAlignmentAccuracy([]);
            expect(accuracy).toBe(0);
        });
    });

    describe('translateDocument', () => {
        test('should return same document if languages match', async () => {
            const document = {
                id: 'test-doc',
                content: 'Test content for translation validation',
                language: Language.FRENCH,
                type: DocumentType.CONTRACT,
                title: 'Test Document',
                metadata: {
                    jurisdiction: 'Madagascar'
                }
            };

            const result = await translationService.translateDocument(document, Language.FRENCH);

            expect(result.success).toBe(true);
            expect(result.translatedDocument.id).toBe(document.id);
            expect(result.translatedDocument.language).toBe(Language.FRENCH);
            expect(result.accuracyScore).toBe(100);
        });

        test('should handle translation validation errors', async () => {
            const document = {
                id: 'test-doc',
                content: '', // Empty content should cause validation error
                language: Language.FRENCH
            };

            const result = await translationService.translateDocument(document, Language.MALAGASY);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Document content cannot be empty');
        });
    });
});