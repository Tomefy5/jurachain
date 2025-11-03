/**
 * Supabase database types for JusticeAutomation platform
 * Auto-generated types based on the database schema
 */

export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string;
                    email: string;
                    name: string;
                    role: 'user' | 'admin' | 'legal_expert';
                    phone: string | null;
                    address: string | null;
                    preferences: {
                        language: 'fr' | 'mg' | 'en';
                        notifications: boolean;
                        twoFactorEnabled: boolean;
                    };
                    created_at: string;
                    updated_at: string;
                    last_login_at: string | null;
                };
                Insert: {
                    id: string;
                    email: string;
                    name: string;
                    role?: 'user' | 'admin' | 'legal_expert';
                    phone?: string | null;
                    address?: string | null;
                    preferences?: {
                        language?: 'fr' | 'mg' | 'en';
                        notifications?: boolean;
                        twoFactorEnabled?: boolean;
                    };
                    created_at?: string;
                    updated_at?: string;
                    last_login_at?: string | null;
                };
                Update: {
                    id?: string;
                    email?: string;
                    name?: string;
                    role?: 'user' | 'admin' | 'legal_expert';
                    phone?: string | null;
                    address?: string | null;
                    preferences?: {
                        language?: 'fr' | 'mg' | 'en';
                        notifications?: boolean;
                        twoFactorEnabled?: boolean;
                    };
                    created_at?: string;
                    updated_at?: string;
                    last_login_at?: string | null;
                };
            };
            legal_documents: {
                Row: {
                    id: string;
                    type: 'contract' | 'lease' | 'sale_agreement' | 'employment_contract' | 'service_agreement' | 'partnership_agreement' | 'non_disclosure_agreement' | 'power_of_attorney' | 'other';
                    title: string;
                    content: string;
                    language: 'fr' | 'mg' | 'en';
                    status: 'draft' | 'in_review' | 'pending_signature' | 'signed' | 'archived' | 'cancelled';
                    metadata: {
                        version: number;
                        templateId?: string;
                        generatedBy: 'ai' | 'template' | 'manual';
                        aiModel?: string;
                        jurisdiction: string;
                        tags: string[];
                    };
                    created_by: string;
                    created_at: string;
                    updated_at: string;
                    signed_at: string | null;
                    archived_at: string | null;
                };
                Insert: {
                    id?: string;
                    type: 'contract' | 'lease' | 'sale_agreement' | 'employment_contract' | 'service_agreement' | 'partnership_agreement' | 'non_disclosure_agreement' | 'power_of_attorney' | 'other';
                    title: string;
                    content: string;
                    language: 'fr' | 'mg' | 'en';
                    status?: 'draft' | 'in_review' | 'pending_signature' | 'signed' | 'archived' | 'cancelled';
                    metadata?: {
                        version?: number;
                        templateId?: string;
                        generatedBy?: 'ai' | 'template' | 'manual';
                        aiModel?: string;
                        jurisdiction?: string;
                        tags?: string[];
                    };
                    created_by: string;
                    created_at?: string;
                    updated_at?: string;
                    signed_at?: string | null;
                    archived_at?: string | null;
                };
                Update: {
                    id?: string;
                    type?: 'contract' | 'lease' | 'sale_agreement' | 'employment_contract' | 'service_agreement' | 'partnership_agreement' | 'non_disclosure_agreement' | 'power_of_attorney' | 'other';
                    title?: string;
                    content?: string;
                    language?: 'fr' | 'mg' | 'en';
                    status?: 'draft' | 'in_review' | 'pending_signature' | 'signed' | 'archived' | 'cancelled';
                    metadata?: {
                        version?: number;
                        templateId?: string;
                        generatedBy?: 'ai' | 'template' | 'manual';
                        aiModel?: string;
                        jurisdiction?: string;
                        tags?: string[];
                    };
                    created_by?: string;
                    created_at?: string;
                    updated_at?: string;
                    signed_at?: string | null;
                    archived_at?: string | null;
                };
            };
            parties: {
                Row: {
                    id: string;
                    document_id: string;
                    name: string;
                    email: string;
                    phone: string | null;
                    address: string | null;
                    role: string;
                    national_id: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    document_id: string;
                    name: string;
                    email: string;
                    phone?: string | null;
                    address?: string | null;
                    role: string;
                    national_id?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    document_id?: string;
                    name?: string;
                    email?: string;
                    phone?: string | null;
                    address?: string | null;
                    role?: string;
                    national_id?: string | null;
                    created_at?: string;
                };
            };
            clauses: {
                Row: {
                    id: string;
                    document_id: string;
                    title: string;
                    content: string;
                    position: number;
                    is_required: boolean;
                    category: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    document_id: string;
                    title: string;
                    content: string;
                    position: number;
                    is_required?: boolean;
                    category?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    document_id?: string;
                    title?: string;
                    content?: string;
                    position?: number;
                    is_required?: boolean;
                    category?: string | null;
                    created_at?: string;
                };
            };
            blockchain_records: {
                Row: {
                    id: string;
                    transaction_hash: string;
                    block_number: number | null;
                    network: 'hedera' | 'polygon';
                    timestamp: string;
                    gas_used: number | null;
                    status: 'pending' | 'confirmed' | 'failed';
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    transaction_hash: string;
                    block_number?: number | null;
                    network: 'hedera' | 'polygon';
                    timestamp?: string;
                    gas_used?: number | null;
                    status?: 'pending' | 'confirmed' | 'failed';
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    transaction_hash?: string;
                    block_number?: number | null;
                    network?: 'hedera' | 'polygon';
                    timestamp?: string;
                    gas_used?: number | null;
                    status?: 'pending' | 'confirmed' | 'failed';
                    created_at?: string;
                };
            };
            digital_signatures: {
                Row: {
                    id: string;
                    document_id: string;
                    signer_id: string;
                    signer_name: string;
                    signer_email: string;
                    signature: string;
                    timestamp: string;
                    ip_address: string;
                    user_agent: string | null;
                    status: 'pending' | 'signed' | 'rejected' | 'expired';
                    blockchain_hash: string | null;
                    blockchain_record_id: string | null;
                    verification_code: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    document_id: string;
                    signer_id: string;
                    signer_name: string;
                    signer_email: string;
                    signature: string;
                    timestamp?: string;
                    ip_address: string;
                    user_agent?: string | null;
                    status?: 'pending' | 'signed' | 'rejected' | 'expired';
                    blockchain_hash?: string | null;
                    blockchain_record_id?: string | null;
                    verification_code?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    document_id?: string;
                    signer_id?: string;
                    signer_name?: string;
                    signer_email?: string;
                    signature?: string;
                    timestamp?: string;
                    ip_address?: string;
                    user_agent?: string | null;
                    status?: 'pending' | 'signed' | 'rejected' | 'expired';
                    blockchain_hash?: string | null;
                    blockchain_record_id?: string | null;
                    verification_code?: string | null;
                    created_at?: string;
                };
            };
            risk_assessments: {
                Row: {
                    id: string;
                    clause_id: string;
                    document_id: string;
                    risk_level: 'low' | 'medium' | 'high' | 'critical';
                    risk_type: 'abusive_clause' | 'unfair_terms' | 'missing_clause' | 'legal_compliance' | 'financial_risk' | 'termination_risk' | 'liability_risk';
                    description: string;
                    confidence: number;
                    detected_at: string;
                    reviewed_by: string | null;
                    reviewed_at: string | null;
                    status: 'pending' | 'reviewed' | 'resolved' | 'ignored';
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    clause_id: string;
                    document_id: string;
                    risk_level: 'low' | 'medium' | 'high' | 'critical';
                    risk_type: 'abusive_clause' | 'unfair_terms' | 'missing_clause' | 'legal_compliance' | 'financial_risk' | 'termination_risk' | 'liability_risk';
                    description: string;
                    confidence: number;
                    detected_at?: string;
                    reviewed_by?: string | null;
                    reviewed_at?: string | null;
                    status?: 'pending' | 'reviewed' | 'resolved' | 'ignored';
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    clause_id?: string;
                    document_id?: string;
                    risk_level?: 'low' | 'medium' | 'high' | 'critical';
                    risk_type?: 'abusive_clause' | 'unfair_terms' | 'missing_clause' | 'legal_compliance' | 'financial_risk' | 'termination_risk' | 'liability_risk';
                    description?: string;
                    confidence?: number;
                    detected_at?: string;
                    reviewed_by?: string | null;
                    reviewed_at?: string | null;
                    status?: 'pending' | 'reviewed' | 'resolved' | 'ignored';
                    created_at?: string;
                };
            };
            suggestions: {
                Row: {
                    id: string;
                    risk_assessment_id: string;
                    type: 'replacement' | 'addition' | 'removal' | 'modification';
                    original_text: string | null;
                    suggested_text: string;
                    reason: string;
                    priority: 'low' | 'medium' | 'high' | 'critical';
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    risk_assessment_id: string;
                    type: 'replacement' | 'addition' | 'removal' | 'modification';
                    original_text?: string | null;
                    suggested_text: string;
                    reason: string;
                    priority: 'low' | 'medium' | 'high' | 'critical';
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    risk_assessment_id?: string;
                    type?: 'replacement' | 'addition' | 'removal' | 'modification';
                    original_text?: string | null;
                    suggested_text?: string;
                    reason?: string;
                    priority?: 'low' | 'medium' | 'high' | 'critical';
                    created_at?: string;
                };
            };
            compliance_reports: {
                Row: {
                    id: string;
                    document_id: string;
                    is_compliant: boolean;
                    jurisdiction: string;
                    checked_at: string;
                    score: number | null;
                    issues: any[];
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    document_id: string;
                    is_compliant: boolean;
                    jurisdiction: string;
                    checked_at?: string;
                    score?: number | null;
                    issues?: any[];
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    document_id?: string;
                    is_compliant?: boolean;
                    jurisdiction?: string;
                    checked_at?: string;
                    score?: number | null;
                    issues?: any[];
                    created_at?: string;
                };
            };
            collaboration_sessions: {
                Row: {
                    id: string;
                    document_id: string;
                    participants: string[];
                    google_doc_id: string | null;
                    is_active: boolean;
                    created_at: string;
                    ended_at: string | null;
                };
                Insert: {
                    id?: string;
                    document_id: string;
                    participants: string[];
                    google_doc_id?: string | null;
                    is_active?: boolean;
                    created_at?: string;
                    ended_at?: string | null;
                };
                Update: {
                    id?: string;
                    document_id?: string;
                    participants?: string[];
                    google_doc_id?: string | null;
                    is_active?: boolean;
                    created_at?: string;
                    ended_at?: string | null;
                };
            };
            document_versions: {
                Row: {
                    id: string;
                    document_id: string;
                    version: number;
                    content: string;
                    changes: string | null;
                    created_by: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    document_id: string;
                    version: number;
                    content: string;
                    changes?: string | null;
                    created_by: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    document_id?: string;
                    version?: number;
                    content?: string;
                    changes?: string | null;
                    created_by?: string;
                    created_at?: string;
                };
            };
            notifications: {
                Row: {
                    id: string;
                    userId: string;
                    type: string;
                    title: string;
                    message: string;
                    data: any;
                    read: boolean;
                    readAt: string | null;
                    createdAt: string;
                    updatedAt: string;
                };
                Insert: {
                    id?: string;
                    userId: string;
                    type?: string;
                    title: string;
                    message: string;
                    data?: any;
                    read?: boolean;
                    readAt?: string | null;
                    createdAt?: string;
                    updatedAt?: string;
                };
                Update: {
                    id?: string;
                    userId?: string;
                    type?: string;
                    title?: string;
                    message?: string;
                    data?: any;
                    read?: boolean;
                    readAt?: string | null;
                    createdAt?: string;
                    updatedAt?: string;
                };
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            [_ in never]: never;
        };
        Enums: {
            document_type: 'contract' | 'lease' | 'sale_agreement' | 'employment_contract' | 'service_agreement' | 'partnership_agreement' | 'non_disclosure_agreement' | 'power_of_attorney' | 'other';
            language_type: 'fr' | 'mg' | 'en';
            document_status: 'draft' | 'in_review' | 'pending_signature' | 'signed' | 'archived' | 'cancelled';
            risk_level: 'low' | 'medium' | 'high' | 'critical';
            risk_type: 'abusive_clause' | 'unfair_terms' | 'missing_clause' | 'legal_compliance' | 'financial_risk' | 'termination_risk' | 'liability_risk';
            signature_status: 'pending' | 'signed' | 'rejected' | 'expired';
            user_role: 'user' | 'admin' | 'legal_expert';
            blockchain_status: 'pending' | 'confirmed' | 'failed';
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
}