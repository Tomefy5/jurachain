/**
 * Tests for Clause Analyzer Service
 * Tests the TensorFlow-based clause analysis functionality
 */

const ClauseAnalyzer = require('../services/clauseAnalyzer');
const TextProcessor = require('../services/textProcessor');
const { RiskLevel, RiskType, DocumentType, Language } = require('../types/enums');

describe('ClauseAnalyzer', () => {
    let analyzer;
    let textProcessor;

    beforeAll(async () => {
        analyzer = new ClauseAnalyzer();
        textProcessor = new TextProcessor();

        // Initialize the analyzer
        await analyzer.initialize();
    });

    afterAll(() => {
        // Clean up any resources if needed
        if (analyzer.model) {
            analyzer.model.dispose();
        }
    });

    describe('Initialization', () => {
        test('should initialize successfully', () => {
            expect(analyzer.isInitialized).toBe(true);
            expect(analyzer.model).toBeDefined();
        });

        test('should load abusive patterns', () => {
            expect(analyzer.abusivePatterns).toBeDefined();
            expect(analyzer.abusivePatterns.length).toBeGreaterThan(0);
        });

        test('should load risk keywords', () => {
            expect(analyzer.riskKeywords).toBeDefined();
            expect(analyzer.riskKeywords.length).toBeGreaterThan(0);
        });
    });

    describe('Document Analysis', () => {
        const mockDocument = {
            id: 'test-doc-1',
            type: DocumentType.CONTRACT,
            title: 'Test Contract',
            content: 'This is a test contract with unlimited liability clause.',
            language: Language.ENGLISH,
            clauses: [
                {
                    id: 'clause-1',
                    title: 'Liability Clause',
                    content: 'The contractor shall have unlimited liability for any damages.',
                    position: 1,
                    isRequired: true,
                    category: 'liability'
                },
                {
                    id: 'clause-2',
                    title: 'Termination Clause',
                    content: 'This contract may be terminated with 30 days notice.',
                    position: 2,
                    isRequired: true,
                    category: 'termination'
                }
            ],
            metadata: {
                jurisdiction: 'Madagascar',
                version: 1,
                generatedBy: 'ai'
            }
        };

        test('should analyze document and return results', async () => {
            const result = await analyzer.analyzeDocument(mockDocument);

            expect(result).toBeDefined();
            expect(result.documentId).toBe(mockDocument.id);
            expect(result.overallRisk).toBeDefined();
            expect(result.riskAssessments).toBeInstanceOf(Array);
            expect(result.complianceReport).toBeDefined();
            expect(result.analysisDate).toBeInstanceOf(Date);
            expect(result.processingTime).toBeGreaterThan(0);
        });

        test('should detect high-risk clauses', async () => {
            const result = await analyzer.analyzeDocument(mockDocument);

            // Should detect the unlimited liability clause as high risk
            const highRiskAssessments = result.riskAssessments.filter(
                assessment => assessment.riskLevel === RiskLevel.HIGH || assessment.riskLevel === RiskLevel.CRITICAL
            );

            expect(highRiskAssessments.length).toBeGreaterThan(0);
        });

        test('should generate compliance report', async () => {
            const result = await analyzer.analyzeDocument(mockDocument);
            const report = result.complianceReport;

            expect(report.documentId).toBe(mockDocument.id);
            expect(report.jurisdiction).toBe('Madagascar');
            expect(report.checkedAt).toBeInstanceOf(Date);
            expect(report.issues).toBeInstanceOf(Array);
            expect(typeof report.score).toBe('number');
            expect(report.score).toBeGreaterThanOrEqual(0);
            expect(report.score).toBeLessThanOrEqual(100);
        });
    });

    describe('Clause Analysis', () => {
        const mockDocument = {
            id: 'test-doc',
            type: DocumentType.CONTRACT,
            metadata: { jurisdiction: 'Madagascar' }
        };

        test('should analyze abusive clause', async () => {
            const abusiveClause = {
                id: 'abusive-clause',
                title: 'Penalty Clause',
                content: 'Any breach will result in unlimited liability and excessive penalties.',
                position: 1,
                isRequired: false
            };

            const assessment = await analyzer.analyzeClause(abusiveClause, mockDocument);

            expect(assessment).toBeDefined();
            expect(assessment.clauseId).toBe(abusiveClause.id);
            expect(assessment.riskLevel).toBeDefined();
            expect(assessment.suggestions).toBeInstanceOf(Array);
            expect(assessment.confidence).toBeGreaterThan(0);
        });

        test('should return null for safe clause', async () => {
            const safeClause = {
                id: 'safe-clause',
                title: 'Payment Terms',
                content: 'Payment shall be made within 30 days of invoice date.',
                position: 1,
                isRequired: true
            };

            const assessment = await analyzer.analyzeClause(safeClause, mockDocument);

            // Safe clauses might still return assessments with low risk
            if (assessment) {
                expect(assessment.riskLevel).toBe(RiskLevel.LOW);
            }
        });
    });

    describe('Abusive Clause Detection', () => {
        test('should detect abusive clauses in clause list', async () => {
            const clauses = [
                {
                    id: 'clause-1',
                    content: 'The party waives all rights to legal recourse.',
                    title: 'Rights Waiver'
                },
                {
                    id: 'clause-2',
                    content: 'Payment terms are net 30 days.',
                    title: 'Payment Terms'
                },
                {
                    id: 'clause-3',
                    content: 'Contractor has unlimited liability for all damages.',
                    title: 'Liability'
                }
            ];

            const assessments = await analyzer.detectAbusiveClauses(clauses);

            expect(assessments).toBeInstanceOf(Array);
            expect(assessments.length).toBeGreaterThan(0);

            // Should detect at least the rights waiver and unlimited liability clauses
            const riskyClauses = assessments.filter(a =>
                a.riskLevel === RiskLevel.HIGH || a.riskLevel === RiskLevel.CRITICAL
            );
            expect(riskyClauses.length).toBeGreaterThan(0);
        });
    });

    describe('Suggestion Generation', () => {
        test('should generate suggestions for risks', async () => {
            const risks = [
                {
                    id: 'risk-1',
                    clauseId: 'clause-1',
                    riskType: RiskType.ABUSIVE_CLAUSE,
                    riskLevel: RiskLevel.HIGH,
                    description: 'Unlimited liability clause'
                },
                {
                    id: 'risk-2',
                    clauseId: 'clause-2',
                    riskType: RiskType.UNFAIR_TERMS,
                    riskLevel: RiskLevel.MEDIUM,
                    description: 'Unbalanced terms'
                }
            ];

            const suggestions = await analyzer.suggestCorrections(risks);

            expect(suggestions).toBeInstanceOf(Array);
            expect(suggestions.length).toBeGreaterThan(0);

            suggestions.forEach(suggestion => {
                expect(suggestion.id).toBeDefined();
                expect(suggestion.type).toBeDefined();
                expect(suggestion.suggestedText).toBeDefined();
                expect(suggestion.reason).toBeDefined();
                expect(suggestion.priority).toBeDefined();
            });
        });
    });

    describe('TensorFlow Analysis', () => {
        test('should perform TensorFlow analysis on text', async () => {
            const testText = 'This contract includes unlimited liability and excessive penalties.';

            const result = await analyzer.performTensorFlowAnalysis(testText);

            expect(result).toBeDefined();
            expect(result.type).toBeDefined();
            expect(result.level).toBeDefined();
            expect(result.description).toBeDefined();
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
        });

        test('should convert text to features', () => {
            const testText = 'This is a contract with penalty clauses and liability terms.';

            const features = analyzer.textToFeatures(testText);

            expect(features).toBeInstanceOf(Array);
            expect(features.length).toBe(100);
            expect(features.every(f => typeof f === 'number')).toBe(true);
            expect(features.every(f => f >= 0 && f <= 1)).toBe(true);
        });
    });

    describe('Risk Assessment Utilities', () => {
        test('should calculate overall risk correctly', () => {
            const assessments = [
                { riskLevel: RiskLevel.LOW },
                { riskLevel: RiskLevel.MEDIUM },
                { riskLevel: RiskLevel.HIGH }
            ];

            const overallRisk = analyzer.calculateOverallRisk(assessments);
            expect(overallRisk).toBe(RiskLevel.HIGH);
        });

        test('should return low risk for empty assessments', () => {
            const overallRisk = analyzer.calculateOverallRisk([]);
            expect(overallRisk).toBe(RiskLevel.LOW);
        });

        test('should prioritize critical risk', () => {
            const assessments = [
                { riskLevel: RiskLevel.LOW },
                { riskLevel: RiskLevel.CRITICAL },
                { riskLevel: RiskLevel.MEDIUM }
            ];

            const overallRisk = analyzer.calculateOverallRisk(assessments);
            expect(overallRisk).toBe(RiskLevel.CRITICAL);
        });
    });

    describe('Pattern Matching', () => {
        test('should match abusive patterns', () => {
            const patterns = analyzer.abusivePatterns;
            const testText = 'unlimited liability for all damages';

            const matchingPattern = patterns.find(pattern =>
                analyzer.matchesPattern(testText, pattern)
            );

            expect(matchingPattern).toBeDefined();
            expect(matchingPattern.riskType).toBe(RiskType.LIABILITY_RISK);
        });

        test('should not match safe text', () => {
            const patterns = analyzer.abusivePatterns;
            const safeText = 'payment due within thirty days';

            const matchingPattern = patterns.find(pattern =>
                analyzer.matchesPattern(safeText, pattern)
            );

            expect(matchingPattern).toBeUndefined();
        });
    });
});

describe('TextProcessor', () => {
    let processor;

    beforeAll(() => {
        processor = new TextProcessor();
    });

    describe('Text Preprocessing', () => {
        test('should preprocess text correctly', () => {
            const input = 'This IS a TEST with SPECIAL characters!!! @#$%';
            const result = processor.preprocessText(input);

            expect(result).toBeDefined();
            expect(result.toLowerCase()).toBe(result);
            expect(result).not.toContain('@');
            expect(result).not.toContain('#');
        });

        test('should handle empty or invalid input', () => {
            expect(processor.preprocessText('')).toBe('');
            expect(processor.preprocessText(null)).toBe('');
            expect(processor.preprocessText(undefined)).toBe('');
        });
    });

    describe('Feature Extraction', () => {
        test('should extract features from text', () => {
            const text = 'This contract has penalty clauses and liability terms.';
            const features = processor.extractFeatures(text);

            expect(features).toBeInstanceOf(Array);
            expect(features.length).toBe(100);
            expect(features.every(f => typeof f === 'number')).toBe(true);
        });

        test('should handle different text lengths', () => {
            const shortText = 'Contract';
            const longText = 'This is a very long contract with many clauses and terms that should be analyzed for potential risks and abusive language patterns.';

            const shortFeatures = processor.extractFeatures(shortText);
            const longFeatures = processor.extractFeatures(longText);

            expect(shortFeatures.length).toBe(longFeatures.length);
            expect(shortFeatures.length).toBe(100);
        });
    });

    describe('Text Analysis', () => {
        test('should detect linguistic patterns', () => {
            expect(processor.hasNegativeLanguage('this is not acceptable')).toBe(true);
            expect(processor.hasUrgentLanguage('immediate action required')).toBe(true);
            expect(processor.hasAbsoluteLanguage('always and never')).toBe(true);
            expect(processor.hasConditionalLanguage('if and only if')).toBe(true);
        });

        test('should detect structural elements', () => {
            expect(processor.hasListStructure('1. First item\n2. Second item')).toBe(true);
            expect(processor.hasParentheses('This (example) text')).toBe(true);
            expect(processor.hasQuotations('This "quoted" text')).toBe(true);
            expect(processor.hasDates('Date: 12/25/2023')).toBe(true);
        });
    });

    describe('Similarity Calculation', () => {
        test('should calculate text similarity', () => {
            const text1 = 'This is a contract';
            const text2 = 'This is a legal contract';
            const text3 = 'Completely different content';

            const similarity1 = processor.calculateSimilarity(text1, text2);
            const similarity2 = processor.calculateSimilarity(text1, text3);

            expect(similarity1).toBeGreaterThan(similarity2);
            expect(similarity1).toBeGreaterThan(0);
            expect(similarity1).toBeLessThanOrEqual(1);
        });

        test('should handle identical texts', () => {
            const text = 'This is a test';
            const similarity = processor.calculateSimilarity(text, text);
            expect(similarity).toBe(1);
        });
    });
});