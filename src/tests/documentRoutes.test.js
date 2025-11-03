const request = require('supertest');
const app = require('../server');
const { DocumentType, Language } = require('../types/enums.js');

// Mock the document generator to avoid external API calls during tests
jest.mock('../services/documentGenerator');

describe('Document Routes', () => {
    // Mock user authentication middleware
    beforeEach(() => {
        // Mock the auth middleware to provide a test user
        jest.doMock('../middleware/auth', () => ({
            authMiddleware: (req, res, next) => {
                req.user = { id: 'test-user-id', email: 'test@example.com' };
                next();
            }
        }));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/documents/generate', () => {
        test('should generate document with valid request', async () => {
            const DocumentGeneratorService = require('../services/documentGenerator');
            const mockGenerator = {
                generateContract: jest.fn().mockResolvedValue({
                    id: 'test-doc-id',
                    title: 'Test Contract',
                    content: 'Generated contract content',
                    type: DocumentType.CONTRACT,
                    language: Language.FRENCH,
                    status: 'draft',
                    parties: [{ id: 'party-1', name: 'Test Party', email: 'party@example.com', role: 'buyer' }],
                    clauses: [],
                    signatures: [],
                    riskAssessments: [],
                    metadata: {
                        version: 1,
                        generatedBy: 'ai',
                        aiModel: 'test',
                        jurisdiction: 'Madagascar',
                        tags: ['contract', 'fr'],
                        processingTime: 1500
                    },
                    createdBy: 'test-user-id',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    complianceReport: {
                        documentId: 'test-doc-id',
                        isCompliant: true,
                        jurisdiction: 'Madagascar',
                        checkedAt: new Date(),
                        issues: [],
                        score: 85
                    }
                })
            };

            DocumentGeneratorService.mockImplementation(() => mockGenerator);

            const validRequest = {
                type: DocumentType.CONTRACT,
                language: Language.FRENCH,
                description: 'Contrat de vente pour un véhicule d\'occasion',
                parties: [
                    {
                        name: 'Jean Dupont',
                        email: 'jean.dupont@example.com',
                        role: 'buyer',
                        address: '123 Rue de la Paix, Antananarivo'
                    },
                    {
                        name: 'Marie Martin',
                        email: 'marie.martin@example.com',
                        role: 'seller'
                    }
                ],
                jurisdiction: 'Madagascar',
                specificClauses: ['Garantie de 6 mois', 'Paiement en 3 fois'],
                urgency: 'medium'
            };

            const response = await request(app)
                .post('/api/documents/generate')
                .send(validRequest)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('généré avec succès');
            expect(response.body.document).toBeDefined();
            expect(response.body.document.id).toBe('test-doc-id');
            expect(response.body.processingTime).toBe(1500);
            expect(response.body.complianceScore).toBe(85);
            expect(mockGenerator.generateContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: DocumentType.CONTRACT,
                    language: Language.FRENCH,
                    description: validRequest.description
                })
            );
        });

        test('should return 400 for invalid request data', async () => {
            const invalidRequest = {
                type: 'invalid_type',
                language: Language.FRENCH,
                description: 'Short', // Too short
                parties: [], // Empty parties
                jurisdiction: 'Madagascar'
            };

            const response = await request(app)
                .post('/api/documents/generate')
                .send(invalidRequest)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('invalides');
        });

        test('should return 500 when document generation fails', async () => {
            const DocumentGeneratorService = require('../services/documentGenerator');
            const mockGenerator = {
                generateContract: jest.fn().mockRejectedValue(new Error('AI service unavailable'))
            };

            DocumentGeneratorService.mockImplementation(() => mockGenerator);

            const validRequest = {
                type: DocumentType.CONTRACT,
                language: Language.FRENCH,
                description: 'Valid description for contract generation',
                parties: [
                    { name: 'Test User', email: 'test@example.com', role: 'buyer' }
                ],
                jurisdiction: 'Madagascar'
            };

            const response = await request(app)
                .post('/api/documents/generate')
                .send(validRequest)
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Erreur lors de la génération');
            expect(response.body.error).toContain('AI service unavailable');
        });
    });

    describe('POST /api/documents/:id/translate', () => {
        test('should translate document successfully', async () => {
            const DocumentGeneratorService = require('../services/documentGenerator');
            const mockGenerator = {
                translateDocument: jest.fn().mockResolvedValue({
                    id: 'translated-doc-id',
                    content: 'Contenu traduit en malgache',
                    language: Language.MALAGASY,
                    metadata: {
                        translatedFrom: Language.FRENCH,
                        translatedAt: new Date()
                    }
                })
            };

            DocumentGeneratorService.mockImplementation(() => mockGenerator);

            const response = await request(app)
                .post('/api/documents/test-doc-id/translate')
                .send({ targetLanguage: Language.MALAGASY })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('traduit avec succès');
            expect(response.body.translatedDocument).toBeDefined();
            expect(response.body.targetLanguage).toBe(Language.MALAGASY);
        });

        test('should return 400 for invalid target language', async () => {
            const response = await request(app)
                .post('/api/documents/test-doc-id/translate')
                .send({ targetLanguage: 'invalid_lang' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Langue cible invalide');
        });
    });

    describe('POST /api/documents/:id/validate', () => {
        test('should validate document compliance', async () => {
            const DocumentGeneratorService = require('../services/documentGenerator');
            const mockGenerator = {
                validateCompliance: jest.fn().mockResolvedValue({
                    documentId: 'test-doc-id',
                    isCompliant: true,
                    jurisdiction: 'Madagascar',
                    checkedAt: new Date(),
                    issues: [],
                    score: 90
                })
            };

            DocumentGeneratorService.mockImplementation(() => mockGenerator);

            const response = await request(app)
                .post('/api/documents/test-doc-id/validate')
                .send({
                    content: 'Document content to validate',
                    type: DocumentType.CONTRACT,
                    parties: [{ name: 'Test Party' }],
                    jurisdiction: 'Madagascar'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('Validation de conformité terminée');
            expect(response.body.complianceReport).toBeDefined();
            expect(response.body.complianceReport.score).toBe(90);
        });
    });
});