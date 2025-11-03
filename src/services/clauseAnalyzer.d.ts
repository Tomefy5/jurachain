/**
 * TypeScript definitions for ClauseAnalyzer service
 */

import { LegalDocument, Clause, RiskAssessment, AnalysisResult, Suggestion } from '../types/interfaces';

export interface ClauseAnalyzerInterface {
    initialize(): Promise<void>;
    analyzeDocument(document: LegalDocument): Promise<AnalysisResult>;
    detectAbusiveClauses(clauses: Clause[]): Promise<RiskAssessment[]>;
    suggestCorrections(risks: RiskAssessment[]): Promise<Suggestion[]>;
}

export interface AbusivePattern {
    pattern: RegExp;
    riskType: string;
    riskLevel: string;
    description: string;
    confidence: number;
}

export interface TensorFlowAnalysisResult {
    type: string;
    level: string;
    description: string;
    confidence: number;
}

export interface RequiredClause {
    type: string;
    description: string;
    riskLevel: string;
    template: string;
}

declare class ClauseAnalyzer implements ClauseAnalyzerInterface {
    constructor();
    initialize(): Promise<void>;
    analyzeDocument(document: LegalDocument): Promise<AnalysisResult>;
    detectAbusiveClauses(clauses: Clause[]): Promise<RiskAssessment[]>;
    suggestCorrections(risks: RiskAssessment[]): Promise<Suggestion[]>;
}

export default ClauseAnalyzer;