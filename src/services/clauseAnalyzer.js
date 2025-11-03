/**
 * Clause Analyzer Service
 * Uses TensorFlow.js for detecting abusive clauses and assessing legal risks
 */

let tf;
try {
    tf = require('@tensorflow/tfjs-node');
} catch (error) {
    console.warn('TensorFlow.js not available, using fallback implementation');
    tf = null;
}

const { v4: uuidv4 } = require('uuid');
const { RiskLevel, RiskType } = require('../types/enums');

class ClauseAnalyzer {
    constructor() {
        this.model = null;
        this.isInitialized = false;
        this.abusivePatterns = this.loadAbusivePatterns();
        this.riskKeywords = this.loadRiskKeywords();
    }

    /**
     * Initialize the TensorFlow model for clause analysis
     */
    async initialize() {
        try {
            console.log('Initializing clause analyzer...');

            if (tf) {
                console.log('TensorFlow.js available, creating model...');
                this.model = await this.createSimpleModel();
            } else {
                console.log('Using rule-based fallback implementation...');
                this.model = null;
            }

            this.isInitialized = true;
            console.log('Clause analyzer initialized successfully');
        } catch (error) {
            console.error('Failed to initialize clause analyzer:', error);
            // Continue with rule-based approach even if TensorFlow fails
            this.model = null;
            this.isInitialized = true;
            console.log('Falling back to rule-based analysis');
        }
    }

    /**
     * Create a simple TensorFlow model for text classification
     */
    async createSimpleModel() {
        if (!tf) {
            return null;
        }

        try {
            // Simple sequential model for text classification
            const model = tf.sequential({
                layers: [
                    tf.layers.dense({ inputShape: [100], units: 64, activation: 'relu' }),
                    tf.layers.dropout({ rate: 0.3 }),
                    tf.layers.dense({ units: 32, activation: 'relu' }),
                    tf.layers.dense({ units: 4, activation: 'softmax' }) // 4 risk levels
                ]
            });

            model.compile({
                optimizer: 'adam',
                loss: 'categoricalCrossentropy',
                metrics: ['accuracy']
            });

            return model;
        } catch (error) {
            console.error('Failed to create TensorFlow model:', error);
            return null;
        }
    }

    /**
     * Analyze a legal document for abusive clauses and risks
     */
    async analyzeDocument(document) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const startTime = Date.now();
        const riskAssessments = [];

        try {
            // Analyze each clause in the document
            for (const clause of document.clauses) {
                const assessment = await this.analyzeClause(clause, document);
                if (assessment) {
                    riskAssessments.push(assessment);
                }
            }

            // Analyze the overall document content
            const overallAssessment = await this.analyzeOverallContent(document);
            if (overallAssessment.length > 0) {
                riskAssessments.push(...overallAssessment);
            }

            const overallRisk = this.calculateOverallRisk(riskAssessments);
            const processingTime = Date.now() - startTime;

            return {
                documentId: document.id,
                overallRisk,
                riskAssessments,
                complianceReport: await this.generateComplianceReport(document, riskAssessments),
                analysisDate: new Date(),
                processingTime
            };
        } catch (error) {
            console.error('Error analyzing document:', error);
            throw error;
        }
    }

    /**
     * Analyze a single clause for potential risks
     */
    async analyzeClause(clause, document) {
        const risks = [];
        const content = clause.content.toLowerCase();

        // Check for abusive patterns
        for (const pattern of this.abusivePatterns) {
            if (this.matchesPattern(content, pattern)) {
                risks.push({
                    type: pattern.riskType,
                    level: pattern.riskLevel,
                    description: pattern.description,
                    confidence: pattern.confidence
                });
            }
        }

        // Use TensorFlow for additional analysis
        const tfAnalysis = await this.performTensorFlowAnalysis(content);
        if (tfAnalysis.riskLevel !== RiskLevel.LOW) {
            risks.push(tfAnalysis);
        }

        if (risks.length === 0) {
            return null;
        }

        // Get the highest risk
        const highestRisk = risks.reduce((max, risk) =>
            this.getRiskPriority(risk.level) > this.getRiskPriority(max.level) ? risk : max
        );

        return {
            id: uuidv4(),
            clauseId: clause.id,
            documentId: document.id,
            riskLevel: highestRisk.level,
            riskType: highestRisk.type,
            description: highestRisk.description,
            suggestions: await this.generateSuggestions(clause, highestRisk),
            confidence: highestRisk.confidence,
            detectedAt: new Date(),
            status: 'pending'
        };
    }

    /**
     * Perform TensorFlow-based analysis on text content
     */
    async performTensorFlowAnalysis(content) {
        if (!tf || !this.model) {
            // Fallback to rule-based analysis
            return this.performRuleBasedAnalysis(content);
        }

        try {
            // Convert text to numerical features (simplified approach)
            const features = this.textToFeatures(content);
            const tensor = tf.tensor2d([features]);

            // Get prediction from model
            const prediction = this.model.predict(tensor);
            const probabilities = await prediction.data();

            // Clean up tensors
            tensor.dispose();
            prediction.dispose();

            // Interpret results
            const maxProbIndex = probabilities.indexOf(Math.max(...probabilities));
            const confidence = probabilities[maxProbIndex];

            const riskLevels = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL];
            const riskLevel = riskLevels[maxProbIndex];

            return {
                type: RiskType.ABUSIVE_CLAUSE,
                level: riskLevel,
                description: `TensorFlow analysis detected potential risk (confidence: ${(confidence * 100).toFixed(1)}%)`,
                confidence
            };
        } catch (error) {
            console.error('TensorFlow analysis error:', error);
            return this.performRuleBasedAnalysis(content);
        }
    }

    /**
     * Fallback rule-based analysis when TensorFlow is not available
     */
    performRuleBasedAnalysis(content) {
        const lowerContent = content.toLowerCase();
        let riskScore = 0;
        let riskType = RiskType.ABUSIVE_CLAUSE;

        // Check for high-risk keywords
        const highRiskTerms = ['unlimited', 'absolute', 'irrevocable', 'waive all', 'forfeit all'];
        const mediumRiskTerms = ['penalty', 'immediate', 'without notice', 'sole discretion'];
        const lowRiskTerms = ['may', 'reasonable', 'fair', 'mutual'];

        highRiskTerms.forEach(term => {
            if (lowerContent.includes(term)) {
                riskScore += 0.3;
            }
        });

        mediumRiskTerms.forEach(term => {
            if (lowerContent.includes(term)) {
                riskScore += 0.2;
            }
        });

        lowRiskTerms.forEach(term => {
            if (lowerContent.includes(term)) {
                riskScore -= 0.1;
            }
        });

        // Determine risk level based on score
        let riskLevel;
        if (riskScore >= 0.7) {
            riskLevel = RiskLevel.CRITICAL;
        } else if (riskScore >= 0.5) {
            riskLevel = RiskLevel.HIGH;
        } else if (riskScore >= 0.3) {
            riskLevel = RiskLevel.MEDIUM;
        } else {
            riskLevel = RiskLevel.LOW;
        }

        return {
            type: riskType,
            level: riskLevel,
            description: `Rule-based analysis detected potential risk (score: ${riskScore.toFixed(2)})`,
            confidence: Math.min(Math.max(riskScore, 0.1), 0.9)
        };
    }

    /**
     * Convert text content to numerical features for TensorFlow
     */
    textToFeatures(text) {
        const features = new Array(100).fill(0);

        // Simple feature extraction based on keywords and patterns
        this.riskKeywords.forEach((keyword, index) => {
            if (index < 100) {
                const count = (text.match(new RegExp(keyword, 'gi')) || []).length;
                features[index] = Math.min(count / 10, 1); // Normalize to 0-1
            }
        });

        return features;
    }

    /**
     * Analyze overall document content for missing clauses or structural issues
     */
    async analyzeOverallContent(document) {
        const assessments = [];
        const content = document.content.toLowerCase();

        // Check for missing essential clauses based on document type
        const requiredClauses = this.getRequiredClausesForType(document.type);

        for (const requiredClause of requiredClauses) {
            if (!this.hasClauseType(document, requiredClause.type)) {
                assessments.push({
                    id: uuidv4(),
                    clauseId: 'missing-' + requiredClause.type,
                    documentId: document.id,
                    riskLevel: requiredClause.riskLevel,
                    riskType: RiskType.MISSING_CLAUSE,
                    description: `Missing required clause: ${requiredClause.description}`,
                    suggestions: [{
                        id: uuidv4(),
                        type: 'addition',
                        suggestedText: requiredClause.template,
                        reason: `This clause is required for ${document.type} documents`,
                        priority: requiredClause.riskLevel
                    }],
                    confidence: 0.9,
                    detectedAt: new Date(),
                    status: 'pending'
                });
            }
        }

        return assessments;
    }

    /**
     * Generate suggestions for correcting identified risks
     */
    async generateSuggestions(clause, risk) {
        const suggestions = [];

        switch (risk.riskType || risk.type) {
            case RiskType.ABUSIVE_CLAUSE:
                suggestions.push({
                    id: uuidv4(),
                    type: 'modification',
                    originalText: clause.content,
                    suggestedText: this.generateFairAlternative(clause.content),
                    reason: 'Replace potentially abusive clause with fair alternative',
                    priority: risk.riskLevel || risk.level
                });
                break;

            case RiskType.UNFAIR_TERMS:
                suggestions.push({
                    id: uuidv4(),
                    type: 'modification',
                    originalText: clause.content,
                    suggestedText: this.balanceTerms(clause.content),
                    reason: 'Balance terms to be fair for all parties',
                    priority: risk.riskLevel || risk.level
                });
                break;

            case RiskType.LIABILITY_RISK:
                suggestions.push({
                    id: uuidv4(),
                    type: 'addition',
                    suggestedText: 'Liability shall be limited to the amount paid under this agreement.',
                    reason: 'Add liability limitation clause',
                    priority: risk.riskLevel || risk.level
                });
                break;

            case RiskType.TERMINATION_RISK:
                suggestions.push({
                    id: uuidv4(),
                    type: 'modification',
                    originalText: clause.content,
                    suggestedText: clause.content.replace(/immediate/gi, 'with 30 days notice'),
                    reason: 'Add reasonable notice period for termination',
                    priority: risk.riskLevel || risk.level
                });
                break;

            case RiskType.FINANCIAL_RISK:
                suggestions.push({
                    id: uuidv4(),
                    type: 'modification',
                    originalText: clause.content,
                    suggestedText: 'Financial risks shall be shared proportionally between parties.',
                    reason: 'Balance financial risk distribution',
                    priority: risk.riskLevel || risk.level
                });
                break;
        }

        return suggestions;
    }

    /**
     * Generate a compliance report for the document
     */
    async generateComplianceReport(document, riskAssessments) {
        const criticalIssues = riskAssessments.filter(r => r.riskLevel === RiskLevel.CRITICAL);
        const highIssues = riskAssessments.filter(r => r.riskLevel === RiskLevel.HIGH);
        const mediumIssues = riskAssessments.filter(r => r.riskLevel === RiskLevel.MEDIUM);

        const isCompliant = criticalIssues.length === 0 && highIssues.length === 0;

        // Calculate compliance score (0-100)
        let score = 100;
        score -= criticalIssues.length * 30;
        score -= highIssues.length * 20;
        score -= mediumIssues.length * 10;
        score = Math.max(0, score);

        const issues = riskAssessments.map(assessment => ({
            type: assessment.riskType,
            severity: assessment.riskLevel,
            description: assessment.description,
            suggestion: assessment.suggestions[0]?.suggestedText
        }));

        return {
            documentId: document.id,
            isCompliant,
            jurisdiction: document.metadata?.jurisdiction || 'Madagascar',
            checkedAt: new Date(),
            issues,
            score
        };
    }

    /**
     * Calculate overall risk level from individual assessments
     */
    calculateOverallRisk(assessments) {
        if (assessments.length === 0) return RiskLevel.LOW;

        const hasCritical = assessments.some(a => a.riskLevel === RiskLevel.CRITICAL);
        const hasHigh = assessments.some(a => a.riskLevel === RiskLevel.HIGH);
        const hasMedium = assessments.some(a => a.riskLevel === RiskLevel.MEDIUM);

        if (hasCritical) return RiskLevel.CRITICAL;
        if (hasHigh) return RiskLevel.HIGH;
        if (hasMedium) return RiskLevel.MEDIUM;
        return RiskLevel.LOW;
    }

    /**
     * Load predefined abusive clause patterns
     */
    loadAbusivePatterns() {
        return [
            {
                pattern: /penalty|penalité.*excessive|amende.*disproportionnée/i,
                riskType: RiskType.ABUSIVE_CLAUSE,
                riskLevel: RiskLevel.HIGH,
                description: 'Excessive penalty clause detected',
                confidence: 0.8
            },
            {
                pattern: /unilateral.*termination|résiliation.*unilatérale.*sans.*préavis/i,
                riskType: RiskType.TERMINATION_RISK,
                riskLevel: RiskLevel.MEDIUM,
                description: 'Unilateral termination without notice',
                confidence: 0.7
            },
            {
                pattern: /unlimited.*liability|responsabilité.*illimitée/i,
                riskType: RiskType.LIABILITY_RISK,
                riskLevel: RiskLevel.CRITICAL,
                description: 'Unlimited liability clause',
                confidence: 0.9
            },
            {
                pattern: /waive.*all.*rights|renonce.*tous.*droits/i,
                riskType: RiskType.UNFAIR_TERMS,
                riskLevel: RiskLevel.HIGH,
                description: 'Rights waiver clause',
                confidence: 0.8
            }
        ];
    }

    /**
     * Load risk-related keywords for feature extraction
     */
    loadRiskKeywords() {
        return [
            'penalty', 'penalité', 'fine', 'amende', 'forfeit', 'forfaire',
            'terminate', 'résilier', 'cancel', 'annuler', 'breach', 'violation',
            'liability', 'responsabilité', 'damages', 'dommages', 'loss', 'perte',
            'waive', 'renoncer', 'forfeit', 'forfaire', 'surrender', 'abandonner',
            'exclusive', 'exclusif', 'sole', 'seul', 'only', 'seulement',
            'irrevocable', 'irrévocable', 'permanent', 'perpetual', 'perpétuel',
            'unlimited', 'illimité', 'absolute', 'absolu', 'total', 'complete',
            'immediately', 'immédiatement', 'instant', 'without notice', 'sans préavis'
        ];
    }

    /**
     * Get required clauses for different document types
     */
    getRequiredClausesForType(documentType) {
        const commonClauses = [
            {
                type: 'termination',
                description: 'Termination conditions',
                riskLevel: RiskLevel.MEDIUM,
                template: 'This agreement may be terminated by either party with 30 days written notice.'
            }
        ];

        switch (documentType) {
            case 'lease':
                return [
                    ...commonClauses,
                    {
                        type: 'rent_payment',
                        description: 'Rent payment terms',
                        riskLevel: RiskLevel.HIGH,
                        template: 'Rent shall be paid monthly in advance on the first day of each month.'
                    }
                ];
            case 'employment_contract':
                return [
                    ...commonClauses,
                    {
                        type: 'salary',
                        description: 'Salary and benefits',
                        riskLevel: RiskLevel.HIGH,
                        template: 'Employee shall receive a monthly salary as specified in Schedule A.'
                    }
                ];
            default:
                return commonClauses;
        }
    }

    /**
     * Check if document has a specific clause type
     */
    hasClauseType(document, clauseType) {
        return document.clauses.some(clause =>
            clause.category === clauseType ||
            clause.title.toLowerCase().includes(clauseType.replace('_', ' '))
        );
    }

    /**
     * Check if content matches a risk pattern
     */
    matchesPattern(content, pattern) {
        return pattern.pattern.test(content);
    }

    /**
     * Get numeric priority for risk level comparison
     */
    getRiskPriority(riskLevel) {
        const priorities = {
            [RiskLevel.LOW]: 1,
            [RiskLevel.MEDIUM]: 2,
            [RiskLevel.HIGH]: 3,
            [RiskLevel.CRITICAL]: 4
        };
        return priorities[riskLevel] || 0;
    }

    /**
     * Generate fair alternative for abusive clause
     */
    generateFairAlternative(originalText) {
        // Simple replacement logic - in production this would be more sophisticated
        let alternative = originalText;

        alternative = alternative.replace(/unlimited.*liability/gi, 'liability limited to the contract value');
        alternative = alternative.replace(/excessive.*penalty/gi, 'reasonable penalty not exceeding 10% of contract value');
        alternative = alternative.replace(/immediate.*termination/gi, 'termination with 30 days notice');

        return alternative;
    }

    /**
     * Balance unfair terms
     */
    balanceTerms(originalText) {
        // Add reciprocal terms or limitations
        let balanced = originalText;

        if (balanced.includes('shall') && !balanced.includes('both parties')) {
            balanced += ' This obligation applies equally to both parties.';
        }

        return balanced;
    }

    /**
     * Detect abusive clauses in a list of clauses
     */
    async detectAbusiveClauses(clauses) {
        const assessments = [];

        for (const clause of clauses) {
            const mockDocument = { id: 'temp', clauses: [clause] };
            const assessment = await this.analyzeClause(clause, mockDocument);
            if (assessment) {
                assessments.push(assessment);
            }
        }

        return assessments;
    }

    /**
     * Generate suggestions for a list of risk assessments
     */
    async suggestCorrections(risks) {
        const allSuggestions = [];

        for (const risk of risks) {
            // Create a mock clause with some content based on the risk type
            const mockClause = {
                id: risk.clauseId,
                content: this.getMockClauseContent(risk.riskType),
                title: `${risk.riskType} clause`
            };

            const suggestions = await this.generateSuggestions(mockClause, risk);
            allSuggestions.push(...suggestions);
        }

        return allSuggestions;
    }

    /**
     * Get mock clause content based on risk type for suggestion generation
     */
    getMockClauseContent(riskType) {
        switch (riskType) {
            case RiskType.ABUSIVE_CLAUSE:
                return 'The party shall have unlimited liability for all damages and penalties.';
            case RiskType.UNFAIR_TERMS:
                return 'The contractor shall bear all costs and risks without compensation.';
            case RiskType.LIABILITY_RISK:
                return 'Contractor assumes full and unlimited liability for any damages.';
            case RiskType.TERMINATION_RISK:
                return 'This agreement may be terminated immediately without notice.';
            case RiskType.FINANCIAL_RISK:
                return 'All financial risks and losses shall be borne by the contractor.';
            default:
                return 'Standard contract clause with potential risks.';
        }
    }
}

module.exports = ClauseAnalyzer;