# AI Document Generator Service

Le service de génération de documents IA est le cœur de la plateforme JusticeAutomation. Il utilise une approche hybride combinant Ollama (traitement local) et Gemini API (enrichissement cloud) pour générer des documents légaux conformes au droit malgache.

## Fonctionnalités

### 🤖 Génération de Documents IA
- **Ollama Local**: Traitement local pour la confidentialité et la disponibilité offline
- **Gemini API**: Enrichissement cloud pour une meilleure qualité
- **Fallback Automatique**: Basculement transparent entre les services
- **Support Multilingue**: Français, Malgache, Anglais

### 📋 Types de Documents Supportés
- Contrats commerciaux
- Contrats de bail
- Contrats de vente
- Contrats de travail
- Accords de partenariat
- Accords de confidentialité
- Procurations

### ⚖️ Validation de Conformité
- Vérification automatique des clauses essentielles
- Détection des clauses manquantes
- Score de conformité (0-100)
- Suggestions d'amélioration

### 🌍 Traduction Multilingue
- Traduction précise des termes juridiques
- Préservation du sens légal
- Support des langues locales malgaches

## Configuration

### Variables d'Environnement

```bash
# Ollama (Local AI)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2
OLLAMA_TIMEOUT=30000
OLLAMA_TEMPERATURE=0.3

# Gemini (Cloud AI)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-pro
GEMINI_TIMEOUT=30000

# Fallback Configuration
AI_FALLBACK_ENABLED=true
AI_PRIMARY_SERVICE=ollama
AI_RETRY_DELAY=1000

# Document Settings
AI_COMPLIANCE_THRESHOLD=70
AI_MIN_DOCUMENT_LENGTH=500
```

### Installation d'Ollama

1. **Installation**:
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. **Démarrage du service**:
   ```bash
   ollama serve
   ```

3. **Installation du modèle**:
   ```bash
   ollama pull llama2
   ```

## Utilisation

### Génération de Document

```javascript
const DocumentGeneratorService = require('./services/documentGenerator');
const { DocumentType, Language } = require('./types/enums');

const generator = new DocumentGeneratorService();

const contractRequest = {
    type: DocumentType.SALE_AGREEMENT,
    language: Language.FRENCH,
    description: 'Contrat de vente d\'un véhicule',
    parties: [
        {
            name: 'Jean Dupont',
            email: 'jean@example.com',
            role: 'seller',
            address: 'Antananarivo, Madagascar'
        },
        {
            name: 'Marie Martin',
            email: 'marie@example.com',
            role: 'buyer'
        }
    ],
    jurisdiction: 'Madagascar',
    specificClauses: ['Garantie 6 mois', 'Paiement comptant']
};

try {
    const document = await generator.generateContract(contractRequest);
    console.log('Document généré:', document.title);
    console.log('Score de conformité:', document.complianceReport.score);
} catch (error) {
    console.error('Erreur:', error.message);
}
```

### Traduction de Document

```javascript
const originalDocument = {
    content: 'Contrat en français...',
    language: Language.FRENCH,
    // ... autres propriétés
};

const translatedDocument = await generator.translateDocument(
    originalDocument, 
    Language.MALAGASY
);
```

### Validation de Conformité

```javascript
const complianceReport = await generator.validateCompliance(document);

console.log('Conforme:', complianceReport.isCompliant);
console.log('Score:', complianceReport.score);
console.log('Problèmes:', complianceReport.issues.length);
```

## API Endpoints

### POST /api/documents/generate
Génère un nouveau document légal.

**Request Body:**
```json
{
    "type": "sale_agreement",
    "language": "fr",
    "description": "Contrat de vente d'un véhicule Toyota Corolla",
    "parties": [
        {
            "name": "Jean Rakoto",
            "email": "jean@example.com",
            "role": "seller",
            "address": "Antananarivo, Madagascar"
        }
    ],
    "jurisdiction": "Madagascar",
    "specificClauses": ["Garantie 6 mois"],
    "urgency": "medium"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Document généré avec succès",
    "document": {
        "id": "uuid",
        "title": "CONTRAT DE VENTE",
        "content": "...",
        "type": "sale_agreement",
        "language": "fr",
        "parties": [...],
        "clauses": [...],
        "metadata": {
            "processingTime": 1500,
            "aiModel": "ollama"
        }
    },
    "complianceScore": 85
}
```

### POST /api/documents/:id/translate
Traduit un document existant.

**Request Body:**
```json
{
    "targetLanguage": "mg"
}
```

### POST /api/documents/:id/validate
Valide la conformité d'un document.

**Request Body:**
```json
{
    "content": "Contenu du document...",
    "type": "contract",
    "parties": [...],
    "jurisdiction": "Madagascar"
}
```

## Monitoring et Santé

### GET /health/ai/status
Vérifie l'état des services IA.

### POST /health/ai/test-generation
Teste la génération avec les deux services.

### GET /health/ai/config
Affiche la configuration des services (sans données sensibles).

## Architecture

```
DocumentGeneratorService
├── generateContract()          # Point d'entrée principal
├── generateWithOllama()        # Génération locale
├── generateWithGemini()        # Génération cloud
├── translateDocument()         # Traduction multilingue
├── validateCompliance()        # Validation juridique
├── buildPrompt()              # Construction des prompts
├── parseGeneratedDocument()    # Analyse du contenu généré
└── extractClauses()           # Extraction des clauses
```

## Stratégie de Fallback

1. **Tentative Ollama** (service primaire)
   - Traitement local rapide
   - Confidentialité maximale
   - Disponible offline

2. **Fallback Gemini** (si Ollama échoue)
   - Qualité supérieure
   - Meilleur support multilingue
   - Nécessite connexion internet

3. **Gestion d'Erreurs**
   - Retry automatique avec backoff
   - Messages d'erreur explicites
   - Logging détaillé

## Tests

```bash
# Tests unitaires
npm test -- --testPathPattern=documentGenerator.test.js

# Démonstration
node src/examples/document-generation-demo.js

# Tests d'intégration
npm test -- --testPathPattern=documentRoutes.test.js
```

## Sécurité

- **Validation d'Entrée**: Tous les inputs sont validés avec Zod
- **Sanitisation**: Nettoyage des données utilisateur
- **Rate Limiting**: Protection contre les abus
- **Logging**: Traçabilité des opérations
- **Confidentialité**: Traitement local par défaut

## Performance

- **Timeout**: 30 secondes maximum par génération
- **Cache**: Mise en cache des modèles Ollama
- **Optimisation**: Prompts optimisés pour la vitesse
- **Monitoring**: Métriques de performance avec Prometheus

## Dépannage

### Ollama ne répond pas
```bash
# Vérifier le service
curl http://localhost:11434/api/tags

# Redémarrer Ollama
ollama serve
```

### Erreurs Gemini API
- Vérifier la clé API dans les variables d'environnement
- Contrôler les quotas et limites de l'API
- Vérifier la connectivité internet

### Documents de mauvaise qualité
- Ajuster la température (plus bas = plus déterministe)
- Améliorer la description dans la requête
- Ajouter des clauses spécifiques
- Utiliser Gemini pour une meilleure qualité

## Contribution

Pour contribuer au développement du générateur de documents:

1. Ajouter de nouveaux types de documents dans `getRequiredClauses()`
2. Améliorer les prompts dans `buildPrompt()`
3. Étendre la validation dans `validateCompliance()`
4. Ajouter des tests pour les nouveaux cas d'usage

## Roadmap

- [ ] Support de nouveaux modèles IA (Claude, GPT-4)
- [ ] Génération de documents complexes multi-pages
- [ ] Intégration avec des bases de données juridiques
- [ ] Templates personnalisables par utilisateur
- [ ] Analyse sémantique avancée des clauses