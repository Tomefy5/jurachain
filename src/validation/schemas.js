/**
 * Simplified validation schemas for JusticeAutomation platform
 * JavaScript version for CommonJS compatibility
 */

const { z } = require('zod');
const { DocumentType, Language, DocumentStatus, RiskLevel, RiskType, SignatureStatus, UserRole } = require('../types/enums.js');

// Base schemas for reusable validation patterns
const emailSchema = z.string().email('Invalid email format');
const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional();
const uuidSchema = z.string().uuid('Invalid UUID format');

// Party validation schema
const PartySchema = z.object({
    id: uuidSchema,
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    email: emailSchema,
    phone: phoneSchema,
    address: z.string().max(500, 'Address too long').optional(),
    role: z.string().min(1, 'Role is required').max(50, 'Role too long'),
    nationalId: z.string().max(50, 'National ID too long').optional()
});

const PartyCreateSchema = PartySchema.omit({ id: true });

// Contract request validation schema
const ContractRequestSchema = z.object({
    type: z.enum(Object.values(DocumentType)),
    language: z.enum(Object.values(Language)),
    description: z.string().min(10, 'Description must be at least 10 characters').max(2000, 'Description too long'),
    parties: z.array(PartyCreateSchema).min(1, 'At least one party is required').max(10, 'Too many parties'),
    specificClauses: z.array(z.string().max(1000, 'Clause too long')).optional(),
    jurisdiction: z.string().min(1, 'Jurisdiction is required').max(100, 'Jurisdiction too long'),
    urgency: z.enum(['low', 'medium', 'high']).optional(),
    templateId: uuidSchema.optional()
});

// Compliance report validation schema
const ComplianceReportSchema = z.object({
    documentId: uuidSchema,
    isCompliant: z.boolean(),
    jurisdiction: z.string().min(1, 'Jurisdiction is required').max(100, 'Jurisdiction too long'),
    checkedAt: z.date(),
    issues: z.array(z.object({
        type: z.string().min(1, 'Issue type is required').max(100, 'Issue type too long'),
        severity: z.enum(Object.values(RiskLevel)),
        description: z.string().min(1, 'Description is required').max(1000, 'Description too long'),
        suggestion: z.string().max(1000, 'Suggestion too long').optional()
    })),
    score: z.number().int().min(0, 'Score must be between 0 and 100').max(100, 'Score must be between 0 and 100')
});

// Translation request validation schema
const TranslationRequestSchema = z.object({
    targetLanguage: z.enum(Object.values(Language)),
    content: z.string().min(1, 'Content is required').max(50000, 'Content too long').optional(),
    sourceLanguage: z.enum(Object.values(Language)).optional(),
    type: z.enum(Object.values(DocumentType)).optional(),
    title: z.string().max(200, 'Title too long').optional()
});

// Translation comparison request schema
const TranslationComparisonSchema = z.object({
    translatedDocumentId: uuidSchema.optional(),
    targetLanguage: z.enum(Object.values(Language)),
    originalContent: z.string().min(1, 'Original content is required').max(50000, 'Content too long'),
    translatedContent: z.string().min(1, 'Translated content is required').max(50000, 'Content too long'),
    sourceLanguage: z.enum(Object.values(Language)).optional()
});

// Multilingual generation request schema
const MultilingualRequestSchema = ContractRequestSchema.extend({
    targetLanguages: z.array(z.enum(Object.values(Language))).max(5, 'Too many target languages').optional()
});

// Translation validation report schema
const TranslationValidationSchema = z.object({
    isAccurate: z.boolean(),
    accuracyScore: z.number().int().min(0).max(100),
    issues: z.array(z.object({
        type: z.string(),
        severity: z.string(),
        description: z.string(),
        suggestion: z.string().optional()
    })),
    legalTermsPreserved: z.boolean(),
    structurePreserved: z.boolean(),
    validatedAt: z.date()
});

// Digital signature validation schema
const DigitalSignatureSchema = z.object({
    signature: z.string().min(1, 'Signature is required').max(10000, 'Signature too long'),
    signerName: z.string().min(1, 'Signer name is required').max(100, 'Name too long').optional(),
    verificationCode: z.string().max(100, 'Verification code too long').optional()
});

// Blockchain record validation schema
const BlockchainRecordSchema = z.object({
    transactionHash: z.string().min(1, 'Transaction hash is required').max(255, 'Hash too long'),
    network: z.enum(['hedera', 'polygon']),
    blockNumber: z.number().int().positive().optional(),
    gasUsed: z.number().int().positive().optional(),
    topicId: z.string().max(100, 'Topic ID too long').optional(),
    sequenceNumber: z.string().max(100, 'Sequence number too long').optional()
});

// Cryptographic proof validation schema
const CryptographicProofSchema = z.object({
    hash: z.string().min(1, 'Hash is required').max(255, 'Hash too long'),
    algorithm: z.string().min(1, 'Algorithm is required').max(50, 'Algorithm name too long'),
    timestamp: z.date()
});

module.exports = {
    PartySchema,
    PartyCreateSchema,
    ContractRequestSchema,
    ComplianceReportSchema,
    TranslationRequestSchema,
    TranslationComparisonSchema,
    MultilingualRequestSchema,
    TranslationValidationSchema,
    DigitalSignatureSchema,
    BlockchainRecordSchema,
    CryptographicProofSchema
};