/**
 * Enums for JusticeAutomation platform
 * JavaScript version for CommonJS compatibility
 */

const DocumentType = {
    CONTRACT: 'contract',
    LEASE: 'lease',
    SALE_AGREEMENT: 'sale_agreement',
    EMPLOYMENT_CONTRACT: 'employment_contract',
    SERVICE_AGREEMENT: 'service_agreement',
    PARTNERSHIP_AGREEMENT: 'partnership_agreement',
    NON_DISCLOSURE_AGREEMENT: 'non_disclosure_agreement',
    POWER_OF_ATTORNEY: 'power_of_attorney',
    OTHER: 'other'
};

const Language = {
    FRENCH: 'fr',
    MALAGASY: 'mg',
    ENGLISH: 'en'
};

const DocumentStatus = {
    DRAFT: 'draft',
    IN_REVIEW: 'in_review',
    PENDING_SIGNATURE: 'pending_signature',
    SIGNED: 'signed',
    ARCHIVED: 'archived',
    CANCELLED: 'cancelled'
};

const RiskLevel = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

const RiskType = {
    ABUSIVE_CLAUSE: 'abusive_clause',
    UNFAIR_TERMS: 'unfair_terms',
    MISSING_CLAUSE: 'missing_clause',
    LEGAL_COMPLIANCE: 'legal_compliance',
    FINANCIAL_RISK: 'financial_risk',
    TERMINATION_RISK: 'termination_risk',
    LIABILITY_RISK: 'liability_risk'
};

const SignatureStatus = {
    PENDING: 'pending',
    SIGNED: 'signed',
    REJECTED: 'rejected',
    EXPIRED: 'expired'
};

const UserRole = {
    USER: 'user',
    ADMIN: 'admin',
    LEGAL_EXPERT: 'legal_expert'
};

module.exports = {
    DocumentType,
    Language,
    DocumentStatus,
    RiskLevel,
    RiskType,
    SignatureStatus,
    UserRole
};