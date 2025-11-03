/**
 * Zod validation schemas for JusticeAutomation platform
 * Provides runtime validation for all data models
 */

import { z } from 'zod';
import {
    DocumentType,
    Language,
    DocumentStatus,
    RiskLevel,
    RiskType,
    SignatureStatus,
    UserRole
} from '../types/enums';

// Base schemas for reusable validation patterns
const emailSchema = z.string().email('Invalid email format');
const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional();
const uuidSchema = z.string().uuid('Invalid UUID format');

// Party validation schema
export const PartySchema = z.object({
    id: uuidSchema,
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    email: emailSchema,
    phone: phoneSchema,
    address: z.string().max(500, 'Address too long').optional(),
    role: z.string().min(1, 'Role is required').max(50, 'Role too long'),
    nationalId: z.string().max(50, 'National ID too long').optional()
});

export const PartyCreateSchema = PartySchema.omit({ id: true });

// Clause validation schema
export const ClauseSchema = z.object({
    id: uuidSchema,
    title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
    content: z.string().min(1, 'Content is required').max(10000, 'Content too long'),
    position: z.number().int().min(0, 'Position must be non-negative'),
    isRequired: z.boolean(),
    category: z.string().max(100, 'Category too long').optional()
});

// Blockchain record validation schema
export const BlockchainRecordSchema = z.object({
    id: uuidSchema,
    transactionHash: z.string().min(1, 'Transaction hash is required'),
    blockNumber: z.number().int().positive().optional(),
    network: z.enum(['hedera', 'polygon']),
    timestamp: z.date(),
    gasUsed: z.number().int().positive().optional(),
    status: z.enum(['pending', 'confirmed', 'failed'])
});

// Digital signature validation schema
export const DigitalSignatureSchema = z.object({
    id: uuidSchema,
    documentId: uuidSchema,
    signerId: uuidSchema,
    signerName: z.string().min(1, 'Signer name is required').max(100, 'Signer name too long'),
    signerEmail: emailSchema,
    signature: z.string().min(1, 'Signature is required'),
    timestamp: z.date(),
    ipAddress: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/, 'Invalid IP address'),
    userAgent: z.string().max(500, 'User agent too long').optional(),
    status: z.nativeEnum(SignatureStatus),
    blockchainHash: z.string().optional(),
    blockchainRecord: BlockchainRecordSchema.optional(),
    verificationCode: z.string().max(50, 'Verification code too long').optional()
});

// Suggestion validation schema
export const SuggestionSchema = z.object({
    id: uuidSchema,
    type: z.enum(['replacement', 'addition', 'removal', 'modification']),
    originalText: z.string().max(5000, 'Original text too long').optional(),
    suggestedText: z.string().min(1, 'Suggested text is required').max(5000, 'Suggested text too long'),
    reason: z.string().min(1, 'Reason is required').max(1000, 'Reason too long'),
    priority: z.nativeEnum(RiskLevel)
});

// Risk assessment validation schema
export const RiskAssessmentSchema = z.object({
    id: uuidSchema,
    clauseId: uuidSchema,
    documentId: uuidSchema,
    riskLevel: z.nativeEnum(RiskLevel),
    riskType: z.nativeEnum(RiskType),
    description: z.string().min(1, 'Description is required').max(1000, 'Description too long'),
    suggestions: z.array(SuggestionSchema),
    confidence: z.number().min(0, 'Confidence must be between 0 and 1').max(1, 'Confidence must be between 0 and 1'),
    detectedAt: z.date(),
    reviewedBy: uuidSchema.optional(),
    reviewedAt: z.date().optional(),
    status: z.enum(['pending', 'reviewed', 'resolved', 'ignored'])
});

// Legal document validation schema
export const LegalDocumentSchema = z.object({
    id: uuidSchema,
    type: z.nativeEnum(DocumentType),
    title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
    content: z.string().min(1, 'Content is required').max(100000, 'Content too long'),
    language: z.nativeEnum(Language),
    status: z.nativeEnum(DocumentStatus),
    parties: z.array(PartySchema).min(1, 'At least one party is required'),
    clauses: z.array(ClauseSchema),
    signatures: z.array(DigitalSignatureSchema),
    riskAssessments: z.array(RiskAssessmentSchema),
    blockchainRecord: BlockchainRecordSchema.optional(),
    metadata: z.object({
        version: z.number().int().positive(),
        templateId: uuidSchema.optional(),
        generatedBy: z.enum(['ai', 'template', 'manual']),
        aiModel: z.string().max(100, 'AI model name too long').optional(),
        jurisdiction: z.string().min(1, 'Jurisdiction is required').max(100, 'Jurisdiction too long'),
        tags: z.array(z.string().max(50, 'Tag too long'))
    }),
    createdBy: uuidSchema,
    createdAt: z.date(),
    updatedAt: z.date(),
    signedAt: z.date().optional(),
    archivedAt: z.date().optional()
});

// Contract request validation schema
export const ContractRequestSchema = z.object({
    type: z.nativeEnum(DocumentType),
    language: z.nativeEnum(Language),
    description: z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Description too long'),
    parties: z.array(PartyCreateSchema).min(1, 'At least one party is required').max(10, 'Too many parties'),
    specificClauses: z.array(z.string().max(1000, 'Clause too long')).optional(),
    jurisdiction: z.string().min(1, 'Jurisdiction is required').max(100, 'Jurisdiction too long'),
    urgency: z.enum(['low', 'medium', 'high']).optional(),
    templateId: uuidSchema.optional()
});

// User validation schema
export const UserSchema = z.object({
    id: uuidSchema,
    email: emailSchema,
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    role: z.nativeEnum(UserRole),
    phone: phoneSchema,
    address: z.string().max(500, 'Address too long').optional(),
    preferences: z.object({
        language: z.nativeEnum(Language),
        notifications: z.boolean(),
        twoFactorEnabled: z.boolean()
    }),
    createdAt: z.date(),
    updatedAt: z.date(),
    lastLoginAt: z.date().optional()
});

// Compliance report validation schema
export const ComplianceReportSchema = z.object({
    documentId: uuidSchema,
    isCompliant: z.boolean(),
    jurisdiction: z.string().min(1, 'Jurisdiction is required').max(100, 'Jurisdiction too long'),
    checkedAt: z.date(),
    issues: z.array(z.object({
        type: z.string().min(1, 'Issue type is required').max(100, 'Issue type too long'),
        severity: z.nativeEnum(RiskLevel),
        description: z.string().min(1, 'Description is required').max(1000, 'Description too long'),
        suggestion: z.string().max(1000, 'Suggestion too long').optional()
    })),
    score: z.number().int().min(0, 'Score must be between 0 and 100').max(100, 'Score must be between 0 and 100')
});

// Analysis result validation schema
export const AnalysisResultSchema = z.object({
    documentId: uuidSchema,
    overallRisk: z.nativeEnum(RiskLevel),
    riskAssessments: z.array(RiskAssessmentSchema),
    complianceReport: ComplianceReportSchema,
    analysisDate: z.date(),
    processingTime: z.number().int().positive()
});

// Verification result validation schema
export const VerificationResultSchema = z.object({
    isValid: z.boolean(),
    signature: DigitalSignatureSchema,
    blockchainRecord: BlockchainRecordSchema.optional(),
    verifiedAt: z.date(),
    verificationMethod: z.string().min(1, 'Verification method is required').max(100, 'Verification method too long'),
    errors: z.array(z.string().max(500, 'Error message too long')).optional()
});

// Export type inference helpers
export type PartyInput = z.infer<typeof PartySchema>;
export type PartyCreateInput = z.infer<typeof PartyCreateSchema>;
export type ClauseInput = z.infer<typeof ClauseSchema>;
export type DigitalSignatureInput = z.infer<typeof DigitalSignatureSchema>;
export type RiskAssessmentInput = z.infer<typeof RiskAssessmentSchema>;
export type LegalDocumentInput = z.infer<typeof LegalDocumentSchema>;
export type ContractRequestInput = z.infer<typeof ContractRequestSchema>;
export type UserInput = z.infer<typeof UserSchema>;
export type ComplianceReportInput = z.infer<typeof ComplianceReportSchema>;
export type AnalysisResultInput = z.infer<typeof AnalysisResultSchema>;
export type VerificationResultInput = z.infer<typeof VerificationResultSchema>;