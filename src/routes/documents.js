const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { validationSchemas, validateRequest } = require('../middleware/validation');
const DocumentGeneratorService = require('../services/documentGenerator');
const { ContractRequestSchema } = require('../validation/schemas.js');

const router = express.Router();
const documentGenerator = new DocumentGeneratorService();

// Get all documents for authenticated user
router.get('/',
    asyncHandler(async (req, res) => {
        // Placeholder for document retrieval logic
        res.json({
            message: 'Documents endpoint - à implémenter dans les tâches suivantes',
            documents: [],
            user: req.user.id
        });
    })
);

// Generate new document
router.post('/generate',
    validationSchemas.generateDocument,
    validateRequest,
    asyncHandler(async (req, res) => {
        try {
            // Validate request using Zod schema
            const contractRequest = ContractRequestSchema.parse(req.body);

            // Add user context to the request
            contractRequest.createdBy = req.user.id;

            // Generate document using AI service
            const generatedDocument = await documentGenerator.generateContract(contractRequest);

            // Update document with user information
            generatedDocument.createdBy = req.user.id;

            res.status(201).json({
                success: true,
                message: 'Document généré avec succès',
                document: generatedDocument,
                processingTime: generatedDocument.metadata.processingTime,
                complianceScore: generatedDocument.complianceReport.score
            });

        } catch (error) {
            console.error('Document generation error:', error);

            if (error.name === 'ZodError') {
                return res.status(400).json({
                    success: false,
                    message: 'Données de requête invalides',
                    errors: error.errors
                });
            }

            res.status(500).json({
                success: false,
                message: 'Erreur lors de la génération du document',
                error: error.message
            });
        }
    })
);

// Get specific document
router.get('/:id',
    validationSchemas.updateDocument.slice(0, 1), // documentId validation
    validateRequest,
    asyncHandler(async (req, res) => {
        // Placeholder for document retrieval logic
        res.json({
            message: 'Récupération de document - à implémenter dans les tâches suivantes',
            documentId: req.params.id,
            user: req.user.id
        });
    })
);

// Update document
router.put('/:id',
    validationSchemas.updateDocument,
    validateRequest,
    asyncHandler(async (req, res) => {
        // Placeholder for document update logic
        res.json({
            message: 'Mise à jour de document - à implémenter dans les tâches suivantes',
            documentId: req.params.id,
            updates: req.body,
            user: req.user.id
        });
    })
);

// Translate document with accuracy validation
router.post('/:id/translate',
    validationSchemas.translateDocument,
    validateRequest,
    asyncHandler(async (req, res) => {
        try {
            const { targetLanguage } = req.body;

            if (!targetLanguage || !['fr', 'mg', 'en'].includes(targetLanguage)) {
                return res.status(400).json({
                    success: false,
                    message: 'Langue cible invalide. Langues supportées: fr, mg, en'
                });
            }

            // For now, we'll create a mock document to translate
            // In a real implementation, this would fetch from database
            const mockDocument = {
                id: req.params.id,
                content: req.body.content || 'CONTRAT DE VENTE\n\nArticle 1 - Objet du contrat\nLe présent contrat a pour objet la vente d\'un bien immobilier situé à Antananarivo.\n\nArticle 2 - Prix de vente\nLe prix de vente est fixé à 50 000 000 Ariary.\n\nArticle 3 - Modalités de paiement\nLe paiement s\'effectuera en trois versements égaux.',
                language: req.body.sourceLanguage || 'fr',
                type: req.body.type || 'contract',
                title: req.body.title || 'Contrat de Vente',
                metadata: {
                    jurisdiction: 'Madagascar'
                }
            };

            const translationResult = await documentGenerator.translateDocument(mockDocument, targetLanguage);

            if (!translationResult.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Échec de la traduction',
                    error: translationResult.error
                });
            }

            res.json({
                success: true,
                message: 'Document traduit avec succès',
                originalLanguage: mockDocument.language,
                targetLanguage: targetLanguage,
                translatedDocument: translationResult.translatedDocument,
                accuracyScore: translationResult.accuracyScore,
                validationReport: translationResult.validationReport,
                processingTime: translationResult.processingTime
            });

        } catch (error) {
            console.error('Translation error:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la traduction',
                error: error.message
            });
        }
    })
);

// Create side-by-side comparison of translated documents
router.post('/:id/compare',
    validationSchemas.compareTranslation,
    validateRequest,
    asyncHandler(async (req, res) => {
        try {
            const { translatedDocumentId, targetLanguage } = req.body;

            if (!targetLanguage || !['fr', 'mg', 'en'].includes(targetLanguage)) {
                return res.status(400).json({
                    success: false,
                    message: 'Langue cible invalide pour la comparaison'
                });
            }

            // Mock documents for comparison
            const originalDocument = {
                id: req.params.id,
                content: req.body.originalContent || 'CONTRAT DE VENTE\n\nArticle 1 - Objet du contrat\nLe présent contrat a pour objet la vente d\'un bien immobilier situé à Antananarivo.\n\nArticle 2 - Prix de vente\nLe prix de vente est fixé à 50 000 000 Ariary.',
                language: req.body.sourceLanguage || 'fr',
                title: 'Contrat de Vente Original'
            };

            const translatedDocument = {
                id: translatedDocumentId || req.params.id + '_translated',
                content: req.body.translatedContent || 'FIFANARAHANA FIVAROTANA\n\nAndininy 1 - Votoatin\'ny fifanarahana\nIty fifanarahana ity dia mikasika ny fivarotana trano any Antananarivo.\n\nAndininy 2 - Vidin\'ny fivarotana\nNy vidiny dia 50 000 000 Ariary.',
                language: targetLanguage,
                title: 'Contrat de Vente Traduit'
            };

            const comparison = await documentGenerator.createTranslationComparison(
                originalDocument,
                translatedDocument
            );

            res.json({
                success: true,
                message: 'Comparaison créée avec succès',
                comparison: comparison
            });

        } catch (error) {
            console.error('Comparison error:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la création de la comparaison',
                error: error.message
            });
        }
    })
);

// Generate multilingual document (original + translations)
router.post('/generate-multilingual',
    validationSchemas.generateMultilingual,
    validateRequest,
    asyncHandler(async (req, res) => {
        try {
            const contractRequest = ContractRequestSchema.parse(req.body);
            const { targetLanguages = [] } = req.body;

            // Validate target languages
            const validLanguages = targetLanguages.filter(lang => ['fr', 'mg', 'en'].includes(lang));
            if (targetLanguages.length !== validLanguages.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Certaines langues cibles ne sont pas supportées. Langues supportées: fr, mg, en'
                });
            }

            contractRequest.createdBy = req.user.id;

            const multilingualResult = await documentGenerator.generateMultilingualDocument(
                contractRequest,
                validLanguages
            );

            res.status(201).json({
                success: true,
                message: 'Document multilingue généré avec succès',
                result: multilingualResult
            });

        } catch (error) {
            console.error('Multilingual generation error:', error);

            if (error.name === 'ZodError') {
                return res.status(400).json({
                    success: false,
                    message: 'Données de requête invalides',
                    errors: error.errors
                });
            }

            res.status(500).json({
                success: false,
                message: 'Erreur lors de la génération multilingue',
                error: error.message
            });
        }
    })
);

// Validate document compliance
router.post('/:id/validate',
    validationSchemas.updateDocument.slice(0, 1), // documentId validation
    validateRequest,
    asyncHandler(async (req, res) => {
        try {
            // For now, we'll create a mock document to validate
            // In a real implementation, this would fetch from database
            const mockDocument = {
                id: req.params.id,
                content: req.body.content || 'Document de test à valider',
                type: req.body.type || 'contract',
                parties: req.body.parties || [],
                metadata: {
                    jurisdiction: req.body.jurisdiction || 'Madagascar'
                }
            };

            const complianceReport = await documentGenerator.validateCompliance(mockDocument);

            res.json({
                success: true,
                message: 'Validation de conformité terminée',
                complianceReport: complianceReport
            });

        } catch (error) {
            console.error('Validation error:', error);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la validation',
                error: error.message
            });
        }
    })
);

// Delete document
router.delete('/:id',
    validationSchemas.updateDocument.slice(0, 1), // documentId validation
    validateRequest,
    asyncHandler(async (req, res) => {
        // Placeholder for document deletion logic
        res.json({
            message: 'Suppression de document - à implémenter dans les tâches suivantes',
            documentId: req.params.id,
            user: req.user.id
        });
    })
);

module.exports = router;