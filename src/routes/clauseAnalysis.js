/**
 * Clause Analysis Routes
 * API endpoints for document analysis and risk assessment
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const ClauseAnalyzer = require('../services/clauseAnalyzer');
const { authenticateToken } = require('../middleware/auth');
const { RiskLevel, RiskType } = require('../types/enums');

const router = express.Router();
const clauseAnalyzer = new ClauseAnalyzer();

// Initialize the analyzer
clauseAnalyzer.initialize().catch(console.error);

/**
 * Analyze a complete document for risks and abusive clauses
 * POST /api/clause-analysis/analyze-document
 */
router.post('/analyze-document',
    authenticateToken,
    [
        body('document').isObject().withMessage('Document object is required'),
        body('document.id').notEmpty().withMessage('Document ID is required'),
        body('document.content').notEmpty().withMessage('Document content is required'),
        body('document.clauses').isArray().withMessage('Document clauses must be an array')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { document } = req.body;

            console.log(`Analyzing document ${document.id} for user ${req.user.id}`);

            const analysisResult = await clauseAnalyzer.analyzeDocument(document);

            res.json({
                success: true,
                data: analysisResult,
                message: 'Document analysis completed successfully'
            });

        } catch (error) {
            console.error('Document analysis error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to analyze document',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
);

/**
 * Detect abusive clauses in a list of clauses
 * POST /api/clause-analysis/detect-abusive
 */
router.post('/detect-abusive',
    authenticateToken,
    [
        body('clauses').isArray().withMessage('Clauses array is required'),
        body('clauses.*.id').notEmpty().withMessage('Each clause must have an ID'),
        body('clauses.*.content').notEmpty().withMessage('Each clause must have content')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { clauses } = req.body;

            console.log(`Detecting abusive clauses for user ${req.user.id}`);

            const riskAssessments = await clauseAnalyzer.detectAbusiveClauses(clauses);

            res.json({
                success: true,
                data: {
                    riskAssessments,
                    summary: {
                        totalClauses: clauses.length,
                        riskyClausesCount: riskAssessments.length,
                        highRiskCount: riskAssessments.filter(r => r.riskLevel === RiskLevel.HIGH).length,
                        criticalRiskCount: riskAssessments.filter(r => r.riskLevel === RiskLevel.CRITICAL).length
                    }
                },
                message: 'Abusive clause detection completed'
            });

        } catch (error) {
            console.error('Abusive clause detection error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to detect abusive clauses',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
);

/**
 * Get suggestions for correcting identified risks
 * POST /api/clause-analysis/suggest-corrections
 */
router.post('/suggest-corrections',
    authenticateToken,
    [
        body('risks').isArray().withMessage('Risk assessments array is required'),
        body('risks.*.id').notEmpty().withMessage('Each risk must have an ID'),
        body('risks.*.riskType').isIn(Object.values(RiskType)).withMessage('Invalid risk type')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { risks } = req.body;

            console.log(`Generating suggestions for ${risks.length} risks for user ${req.user.id}`);

            const suggestions = await clauseAnalyzer.suggestCorrections(risks);

            res.json({
                success: true,
                data: {
                    suggestions,
                    summary: {
                        totalRisks: risks.length,
                        suggestionsGenerated: suggestions.length,
                        byType: suggestions.reduce((acc, suggestion) => {
                            acc[suggestion.type] = (acc[suggestion.type] || 0) + 1;
                            return acc;
                        }, {})
                    }
                },
                message: 'Correction suggestions generated successfully'
            });

        } catch (error) {
            console.error('Suggestion generation error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate suggestions',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
);

/**
 * Get analysis statistics and model information
 * GET /api/clause-analysis/stats
 */
router.get('/stats',
    authenticateToken,
    async (req, res) => {
        try {
            const stats = {
                modelStatus: clauseAnalyzer.isInitialized ? 'ready' : 'initializing',
                supportedRiskTypes: Object.values(RiskType),
                supportedRiskLevels: Object.values(RiskLevel),
                features: {
                    abusiveClauseDetection: true,
                    riskAssessment: true,
                    suggestionGeneration: true,
                    tensorflowAnalysis: true
                },
                version: '1.0.0'
            };

            res.json({
                success: true,
                data: stats,
                message: 'Analysis statistics retrieved successfully'
            });

        } catch (error) {
            console.error('Stats retrieval error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve statistics',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
);

/**
 * Analyze a single clause
 * POST /api/clause-analysis/analyze-clause
 */
router.post('/analyze-clause',
    authenticateToken,
    [
        body('clause').isObject().withMessage('Clause object is required'),
        body('clause.id').notEmpty().withMessage('Clause ID is required'),
        body('clause.content').notEmpty().withMessage('Clause content is required'),
        body('documentContext').optional().isObject().withMessage('Document context must be an object')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
            }

            const { clause, documentContext } = req.body;

            // Create a minimal document context for analysis
            const mockDocument = {
                id: documentContext?.id || 'temp-' + Date.now(),
                type: documentContext?.type || 'contract',
                clauses: [clause],
                metadata: documentContext?.metadata || { jurisdiction: 'Madagascar' }
            };

            console.log(`Analyzing single clause ${clause.id} for user ${req.user.id}`);

            const assessment = await clauseAnalyzer.analyzeClause(clause, mockDocument);

            res.json({
                success: true,
                data: {
                    assessment,
                    hasRisk: assessment !== null,
                    riskLevel: assessment?.riskLevel || RiskLevel.LOW
                },
                message: 'Clause analysis completed successfully'
            });

        } catch (error) {
            console.error('Single clause analysis error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to analyze clause',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
);

/**
 * Health check endpoint for the analyzer service
 * GET /api/clause-analysis/health
 */
router.get('/health', async (req, res) => {
    try {
        const health = {
            status: clauseAnalyzer.isInitialized ? 'healthy' : 'initializing',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            tensorflow: (() => {
                try {
                    const tf = require('@tensorflow/tfjs-node');
                    return {
                        backend: tf.getBackend(),
                        version: tf.version.tfjs,
                        available: true
                    };
                } catch (error) {
                    return {
                        available: false,
                        message: 'TensorFlow.js not installed'
                    };
                }
            })()
        };

        res.json({
            success: true,
            data: health,
            message: 'Clause analyzer service is operational'
        });

    } catch (error) {
        console.error('Health check error:', error);
        res.status(503).json({
            success: false,
            message: 'Service unavailable',
            error: 'Health check failed'
        });
    }
});

module.exports = router;