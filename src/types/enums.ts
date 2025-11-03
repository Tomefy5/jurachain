/**
 * Enums for JusticeAutomation platform
 * Defines the core data types used throughout the application
 */

export enum DocumentType {
    CONTRACT = 'contract',
    LEASE = 'lease',
    SALE_AGREEMENT = 'sale_agreement',
    EMPLOYMENT_CONTRACT = 'employment_contract',
    SERVICE_AGREEMENT = 'service_agreement',
    PARTNERSHIP_AGREEMENT = 'partnership_agreement',
    NON_DISCLOSURE_AGREEMENT = 'non_disclosure_agreement',
    POWER_OF_ATTORNEY = 'power_of_attorney',
    OTHER = 'other'
}

export enum Language {
    FRENCH = 'fr',
    MALAGASY = 'mg',
    ENGLISH = 'en'
}

export enum DocumentStatus {
    DRAFT = 'draft',
    IN_REVIEW = 'in_review',
    PENDING_SIGNATURE = 'pending_signature',
    SIGNED = 'signed',
    ARCHIVED = 'archived',
    CANCELLED = 'cancelled'
}

export enum RiskLevel {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export enum RiskType {
    ABUSIVE_CLAUSE = 'abusive_clause',
    UNFAIR_TERMS = 'unfair_terms',
    MISSING_CLAUSE = 'missing_clause',
    LEGAL_COMPLIANCE = 'legal_compliance',
    FINANCIAL_RISK = 'financial_risk',
    TERMINATION_RISK = 'termination_risk',
    LIABILITY_RISK = 'liability_risk'
}

export enum SignatureStatus {
    PENDING = 'pending',
    SIGNED = 'signed',
    REJECTED = 'rejected',
    EXPIRED = 'expired'
}

export enum UserRole {
    USER = 'user',
    ADMIN = 'admin',
    LEGAL_EXPERT = 'legal_expert'
}