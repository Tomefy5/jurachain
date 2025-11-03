const request = require('supertest');
const express = require('express');
const documentsRouter = require('../routes/documents');
const { asyncHandler } = require('../middleware/errorHandler');

// Mock the document generator service
jest.mock('../services/documentGenerator');

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req, res, next) => {
    req.user = { id: 'test-user-id' };
    next();
});

app.use('/api/documents', documentsRouter);

// Mock error handler
app.use((error, req, res, next) => {
    res.status(error.status || 500).json({
        success: false,
        message: error.message
    });
});

describe('Translation Routes', () => {
    describe('POST /api/documents/:id/translate', () => {
        test('should translate document successfully', async () => {
            const response = await request(app)
                .post('/api/documents/test-doc-id/translate')
                .send({
                    targetLanguage: 'mg',
                    content: 'CONTRAT DE VENTE\n\nArticle 1 - Objet du contrat\nLe présent contrat a pour objet la vente d\'un bien immobilier.',
                    sourceLanguage: 'fr',
                    type: 'contract',
                    title: 'Contrat de Vente'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('traduit avec succès');
            expect(response.body.targetLanguage).toBe('mg');
            expect(response.body.originalLanguage).toBe('fr');
        });

        test('should return error for invalid target language', async () => {
            const response = await request(app)
                .post('/api/documents/test-doc-id/translate')
                .send({
                    targetLanguage: 'invalid',
                    content: 'Test content'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        test('should return error for missing target language', async () => {
            const response = await request(app)
                .post('/api/documents/test-doc-id/translate')
                .send({
                    content: 'Test content'
                });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/documents/:id/compare', () => {
        test('should create comparison successfully', async () => {
            const response = await request(app)
                .post('/api/documents/test-doc-id/compare')
                .send({
                    targetLanguage: 'mg',
                    originalContent: 'CONTRAT DE VENTE\n\nArticle 1 - Objet du contrat',
                    translatedContent: 'FIFANARAHANA FIVAROTANA\n\nAndininy 1 - Votoatin\'ny fifanarahana',
                    sourceLanguage: 'fr'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('Comparaison créée avec succès');
            expect(response.body.comparison).toBeDefined();
        });

        test('should return error for missing required fields', async () => {
            const response = await request(app)
                .post('/api/documents/test-doc-id/compare')
                .send({
                    targetLanguage: 'mg'
                    // Missing originalContent and translatedContent
                });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/documents/generate-multilingual', () => {
        test('should generate multilingual document successfully', async () => {
            const response = await request(app)
                .post('/api/documents/generate-multilingual')
                .send({
                    type: 'contract',
                    language: 'fr',
                    description: 'Contrat de vente pour démonstration',
                    parties: [
                        { name: 'Vendeur Test', email: 'vendeur@test.mg', role: 'vendeur' },
                        { name: 'Acheteur Test', email: 'acheteur@test.mg', role: 'acheteur' }
                    ],
                    jurisdiction: 'Madagascar',
                    targetLanguages: ['mg']
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('multilingue généré avec succès');
            expect(response.body.result).toBeDefined();
        });

        test('should return error for invalid target languages', async () => {
            const response = await request(app)
                .post('/api/documents/generate-multilingual')
                .send({
                    type: 'contract',
                    language: 'fr',
                    description: 'Test description',
                    parties: [
                        { name: 'Test Party', email: 'test@test.mg', role: 'test' }
                    ],
                    jurisdiction: 'Madagascar',
                    targetLanguages: ['invalid-lang']
                });

            expect(response.status).toBe(400);
        });

        test('should return error for missing required fields', async () => {
            const response = await request(app)
                .post('/api/documents/generate-multilingual')
                .send({
                    type: 'contract'
                    // Missing required fields
                });

            expect(response.status).toBe(400);
        });
    });
});