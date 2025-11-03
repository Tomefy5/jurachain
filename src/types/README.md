# JusticeAutomation - Types et Modèles de Données

Ce dossier contient toutes les définitions de types TypeScript, les énumérations et les schémas de validation pour la plateforme JusticeAutomation.

## Structure

```
src/types/
├── enums.ts          # Énumérations (DocumentType, Language, etc.)
├── interfaces.ts     # Interfaces TypeScript principales
├── index.ts          # Point d'entrée pour tous les types
└── README.md         # Cette documentation

src/validation/
└── schemas.ts        # Schémas de validation Zod

src/database/
├── schema.sql        # Schéma de base de données PostgreSQL
├── migrations/       # Migrations de base de données
├── types.ts          # Types générés pour Supabase
└── index.ts          # Configuration Supabase
```

## Énumérations Principales

### DocumentType
Types de documents légaux supportés :
- `CONTRACT` - Contrat général
- `LEASE` - Bail
- `SALE_AGREEMENT` - Acte de vente
- `EMPLOYMENT_CONTRACT` - Contrat de travail
- `SERVICE_AGREEMENT` - Contrat de service
- `PARTNERSHIP_AGREEMENT` - Accord de partenariat
- `NON_DISCLOSURE_AGREEMENT` - Accord de confidentialité
- `POWER_OF_ATTORNEY` - Procuration
- `OTHER` - Autre type

### Language
Langues supportées :
- `FRENCH` (fr) - Français
- `MALAGASY` (mg) - Malgache
- `ENGLISH` (en) - Anglais

### DocumentStatus
États des documents :
- `DRAFT` - Brouillon
- `IN_REVIEW` - En révision
- `PENDING_SIGNATURE` - En attente de signature
- `SIGNED` - Signé
- `ARCHIVED` - Archivé
- `CANCELLED` - Annulé

### RiskLevel
Niveaux de risque :
- `LOW` - Faible
- `MEDIUM` - Moyen
- `HIGH` - Élevé
- `CRITICAL` - Critique

## Interfaces Principales

### LegalDocument
Interface principale pour les documents légaux :
```typescript
interface LegalDocument {
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
  metadata: DocumentMetadata;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  signedAt?: Date;
  archivedAt?: Date;
}
```

### DigitalSignature
Interface pour les signatures numériques :
```typescript
interface DigitalSignature {
  id: string;
  documentId: string;
  signerId: string;
  signerName: string;
  signerEmail: string;
  signature: string;
  timestamp: Date;
  ipAddress: string;
  status: SignatureStatus;
  blockchainHash?: string;
  blockchainRecord?: BlockchainRecord;
}
```

### RiskAssessment
Interface pour l'évaluation des risques :
```typescript
interface RiskAssessment {
  id: string;
  clauseId: string;
  documentId: string;
  riskLevel: RiskLevel;
  riskType: RiskType;
  description: string;
  suggestions: Suggestion[];
  confidence: number; // 0-1
  detectedAt: Date;
  status: 'pending' | 'reviewed' | 'resolved' | 'ignored';
}
```

## Validation avec Zod

Tous les types ont des schémas de validation Zod correspondants :

```typescript
import { ContractRequestSchema, LegalDocumentSchema } from '../validation/schemas';

// Validation d'une demande de contrat
const validatedRequest = ContractRequestSchema.parse(userInput);

// Validation d'un document légal
const validatedDocument = LegalDocumentSchema.parse(documentData);
```

## Base de Données

### Schéma PostgreSQL
Le fichier `src/database/schema.sql` contient le schéma complet de la base de données avec :
- Tables pour tous les modèles de données
- Index pour les performances
- Contraintes de sécurité (RLS)
- Triggers pour les timestamps automatiques

### Migrations
Les migrations sont dans `src/database/migrations/` et suivent le format :
- `001_initial_schema.sql` - Schéma initial
- `002_feature_name.sql` - Migrations suivantes

### Types Supabase
Le fichier `src/database/types.ts` contient les types générés automatiquement pour Supabase, garantissant la cohérence entre le schéma de base de données et les types TypeScript.

## Utilisation

### Import des Types
```typescript
import {
  DocumentType,
  Language,
  LegalDocument,
  ContractRequest,
  RiskAssessment
} from '../types';
```

### Import des Schémas de Validation
```typescript
import {
  ContractRequestSchema,
  LegalDocumentSchema,
  RiskAssessmentSchema
} from '../validation/schemas';
```

### Import du Client Supabase
```typescript
import { supabase } from '../database';
```

## Exemples d'Usage

Voir le fichier `src/examples/usage-examples.ts` pour des exemples complets d'utilisation des types et de la validation.

## Conformité aux Exigences

Ces modèles de données répondent aux exigences suivantes du projet :

- **Exigence 1.1** : Support des types de documents légaux malgaches
- **Exigence 1.4** : Métadonnées complètes pour chaque document
- **Exigence 2.1** : Modèles pour l'analyse des clauses et risques
- **Exigence 3.2** : Structures pour les signatures numériques blockchain
- **Exigence 5.1** : Modèles pour le suivi des documents utilisateur
- **Exigence 5.2** : Support des statuts de documents et notifications

## Sécurité

- Validation stricte avec Zod pour tous les inputs utilisateur
- Types TypeScript stricts pour éviter les erreurs de runtime
- Schéma de base de données avec contraintes et RLS
- Chiffrement des données sensibles (signatures, données personnelles)