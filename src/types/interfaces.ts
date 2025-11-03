/**
 * Core interfaces for JusticeAutomation platform
 * Based on the design document specifications
 */

import {
    DocumentType,
    Language,
    DocumentStatus,
    RiskLevel,
    RiskType,
    SignatureStatus,
    UserRole
} from './enums';

export interface Party {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    role: string; // e.g., 'buyer', 'seller', 'tenant', 'landlord'
    nationalId?: string;
}

export interface Clause {
    id: string;
    title: string;
    content: string;
    position: number;
    isRequired: boolean;
    category?: string;
}

export interface BlockchainRecord {
    id: string;
    transactionHash: string;
    blockNumber?: number;
    network: string; // 'hedera' or 'polygon'
    timestamp: Date;
    gasUsed?: number;
    status: 'pending' | 'confirmed' | 'failed';
}

export interface CryptographicProof {
    hash: string;
    algorithm: string;
    timestamp: Date;
    blockchainRecord?: BlockchainRecord;
}

export interface DigitalSignature {
    id: string;
    documentId: string;
    signerId: string;
    signerName: string;
    signerEmail: string;
    signature: string;
    timestamp: Date;
    ipAddress: string;
    userAgent?: string;
    status: SignatureStatus;
    blockchainHash?: string;
    blockchainRecord?: BlockchainRecord;
    verificationCode?: string;
}

export interface Suggestion {
    id: string;
    type: 'replacement' | 'addition' | 'removal' | 'modification';
    originalText?: string;
    suggestedText: string;
    reason: string;
    priority: RiskLevel;
}

export interface RiskAssessment {
    id: string;
    clauseId: string;
    documentId: string;
    riskLevel: RiskLevel;
    riskType: RiskType;
    description: string;
    suggestions: Suggestion[];
    confidence: number; // 0-1 confidence score
    detectedAt: Date;
    reviewedBy?: string;
    reviewedAt?: Date;
    status: 'pending' | 'reviewed' | 'resolved' | 'ignored';
}

export interface LegalDocument {
    id: string;
    type: DocumentType;
    title: string;
    content: string;
    language: Language;
    status: DocumentStatus;
    parties: Party[];
    clauses: Clause[];
    signatures: DigitalSignature[];
    riskAssessments: RiskAssessment[];
    blockchainRecord?: BlockchainRecord;
    metadata: {
        version: number;
        templateId?: string;
        generatedBy: 'ai' | 'template' | 'manual';
        aiModel?: string;
        jurisdiction: string;
        tags: string[];
    };
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    signedAt?: Date;
    archivedAt?: Date;
}

export interface ContractRequest {
    type: DocumentType;
    language: Language;
    description: string;
    parties: Omit<Party, 'id'>[];
    specificClauses?: string[];
    jurisdiction: string;
    urgency?: 'low' | 'medium' | 'high';
    templateId?: string;
}

export interface ComplianceReport {
    documentId: string;
    isCompliant: boolean;
    jurisdiction: string;
    checkedAt: Date;
    issues: {
        type: string;
        severity: RiskLevel;
        description: string;
        suggestion?: string;
    }[];
    score: number; // 0-100 compliance score
}

export interface AnalysisResult {
    documentId: string;
    overallRisk: RiskLevel;
    riskAssessments: RiskAssessment[];
    complianceReport: ComplianceReport;
    analysisDate: Date;
    processingTime: number; // in milliseconds
}

export interface VerificationResult {
    isValid: boolean;
    signature: DigitalSignature;
    blockchainRecord?: BlockchainRecord;
    verifiedAt: Date;
    verificationMethod: string;
    errors?: string[];
}

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    phone?: string;
    address?: string;
    preferences: {
        language: Language;
        notifications: boolean;
        twoFactorEnabled: boolean;
    };
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
}

export interface CollaborationSession {
    id: string;
    documentId: string;
    participants: string[]; // user IDs
    googleDocId?: string;
    isActive: boolean;
    createdAt: Date;
    endedAt?: Date;
}

export interface DocumentVersion {
    id: string;
    documentId: string;
    version: number;
    content: string;
    changes: string;
    createdBy: string;
    createdAt: Date;
}