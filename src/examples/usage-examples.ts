/**
 * Usage examples for JusticeAutomation types and validation
 * Demonstrates how to use the interfaces, enums, and validation schemas
 */

import {
    DocumentType,
    Language,
    DocumentStatus,
    RiskLevel,
    RiskType,
    SignatureStatus,
    LegalDocument,
    ContractRequest,
    RiskAssessment,
    DigitalSignature,
    ContractRequestSchema,
    LegalDocumentSchema,
    RiskAssessmentSchema
} from '../types';

// Example 1: Creating a contract request
const exampleContractRequest: ContractRequest = {
    type: DocumentType.CONTRACT,
    language: Language.FRENCH,
    description: "Contrat de vente d'un véhicule entre deux particuliers à Madagascar",
    parties: [
        {
            name: "Jean Rakoto",
            email: "jean.rakoto@example.mg",
            phone: "+261341234567",
            address: "Antananarivo, Madagascar",
            role: "vendeur"
        },
        {
            name: "Marie Ratsimba",
            email: "marie.ratsimba@example.mg",
            phone: "+261341234568",
            address: "Fianarantsoa, Madagascar",
            role: "acheteur"
        }
    ],
    jurisdiction: "Madagascar",
    urgency: "medium",
    specificClauses: [
        "Garantie du véhicule pendant 6 mois",
        "Paiement en 3 fois sans frais"
    ]
};

// Example 2: Validating the contract request
function validateContractRequest(request: unknown) {
    try {
        const validatedRequest = ContractRequestSchema.parse(request);
        console.log('✅ Contract request is valid:', validatedRequest);
        return validatedRequest;
    } catch (error) {
        console.error('❌ Contract request validation failed:', error);
        throw error;
    }
}

// Example 3: Creating a legal document
const exampleLegalDocument: LegalDocument = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    type: DocumentType.CONTRACT,
    title: "Contrat de Vente - Véhicule",
    content: `
    CONTRAT DE VENTE DE VÉHICULE
    
    Entre les soussignés :
    - M. Jean Rakoto, vendeur
    - Mme Marie Ratsimba, acheteur
    
    Il a été convenu ce qui suit :
    
    Article 1 : Objet de la vente
    Le vendeur cède à l'acheteur un véhicule de marque Toyota...
  `,
    language: Language.FRENCH,
    status: DocumentStatus.DRAFT,
    parties: [
        {
            id: "550e8400-e29b-41d4-a716-446655440001",
            name: "Jean Rakoto",
            email: "jean.rakoto@example.mg",
            phone: "+261341234567",
            address: "Antananarivo, Madagascar",
            role: "vendeur"
        },
        {
            id: "550e8400-e29b-41d4-a716-446655440002",
            name: "Marie Ratsimba",
            email: "marie.ratsimba@example.mg",
            phone: "+261341234568",
            address: "Fianarantsoa, Madagascar",
            role: "acheteur"
        }
    ],
    clauses: [
        {
            id: "550e8400-e29b-41d4-a716-446655440003",
            title: "Garantie",
            content: "Le vendeur garantit le véhicule pendant une période de 6 mois",
            position: 1,
            isRequired: true,
            category: "garantie"
        }
    ],
    signatures: [],
    riskAssessments: [],
    metadata: {
        version: 1,
        generatedBy: "ai",
        aiModel: "ollama-llama2",
        jurisdiction: "Madagascar",
        tags: ["véhicule", "vente", "particulier"]
    },
    createdBy: "550e8400-e29b-41d4-a716-446655440004",
    createdAt: new Date(),
    updatedAt: new Date()
};

// Example 4: Creating a risk assessment
const exampleRiskAssessment: RiskAssessment = {
    id: "550e8400-e29b-41d4-a716-446655440005",
    clauseId: "550e8400-e29b-41d4-a716-446655440003",
    documentId: "550e8400-e29b-41d4-a716-446655440000",
    riskLevel: RiskLevel.MEDIUM,
    riskType: RiskType.MISSING_CLAUSE,
    description: "La clause de garantie ne précise pas les conditions d'exclusion",
    suggestions: [
        {
            id: "550e8400-e29b-41d4-a716-446655440006",
            type: "addition",
            suggestedText: "Sont exclues de la garantie : l'usure normale, les dommages dus à un mauvais usage...",
            reason: "Préciser les exclusions de garantie pour éviter les litiges",
            priority: RiskLevel.MEDIUM
        }
    ],
    confidence: 0.85,
    detectedAt: new Date(),
    status: "pending"
};

// Example 5: Creating a digital signature
const exampleDigitalSignature: DigitalSignature = {
    id: "550e8400-e29b-41d4-a716-446655440007",
    documentId: "550e8400-e29b-41d4-a716-446655440000",
    signerId: "550e8400-e29b-41d4-a716-446655440001",
    signerName: "Jean Rakoto",
    signerEmail: "jean.rakoto@example.mg",
    signature: "digital_signature_hash_here",
    timestamp: new Date(),
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    status: SignatureStatus.PENDING,
    blockchainHash: "0x1234567890abcdef",
    verificationCode: "ABC123"
};

// Example 6: Validation functions
export function validateLegalDocument(document: unknown) {
    return LegalDocumentSchema.parse(document);
}

export function validateRiskAssessment(assessment: unknown) {
    return RiskAssessmentSchema.parse(assessment);
}

// Example 7: Type guards
export function isContractDocument(document: LegalDocument): boolean {
    return document.type === DocumentType.CONTRACT;
}

export function isHighRisk(assessment: RiskAssessment): boolean {
    return assessment.riskLevel === RiskLevel.HIGH || assessment.riskLevel === RiskLevel.CRITICAL;
}

// Example 8: Utility functions
export function getDocumentStatusLabel(status: DocumentStatus, language: Language): string {
    const labels = {
        [Language.FRENCH]: {
            [DocumentStatus.DRAFT]: "Brouillon",
            [DocumentStatus.IN_REVIEW]: "En révision",
            [DocumentStatus.PENDING_SIGNATURE]: "En attente de signature",
            [DocumentStatus.SIGNED]: "Signé",
            [DocumentStatus.ARCHIVED]: "Archivé",
            [DocumentStatus.CANCELLED]: "Annulé"
        },
        [Language.MALAGASY]: {
            [DocumentStatus.DRAFT]: "Drafitra",
            [DocumentStatus.IN_REVIEW]: "Jerena",
            [DocumentStatus.PENDING_SIGNATURE]: "Miandry sonia",
            [DocumentStatus.SIGNED]: "Voasonia",
            [DocumentStatus.ARCHIVED]: "Voatahiry",
            [DocumentStatus.CANCELLED]: "Nofoanana"
        },
        [Language.ENGLISH]: {
            [DocumentStatus.DRAFT]: "Draft",
            [DocumentStatus.IN_REVIEW]: "In Review",
            [DocumentStatus.PENDING_SIGNATURE]: "Pending Signature",
            [DocumentStatus.SIGNED]: "Signed",
            [DocumentStatus.ARCHIVED]: "Archived",
            [DocumentStatus.CANCELLED]: "Cancelled"
        }
    };

    return labels[language][status];
}

// Export examples for testing
export {
    exampleContractRequest,
    exampleLegalDocument,
    exampleRiskAssessment,
    exampleDigitalSignature,
    validateContractRequest
};