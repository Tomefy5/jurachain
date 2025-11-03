# Service Blockchain - JusticeAutomation

Le service blockchain de JusticeAutomation permet l'enregistrement immuable des signatures numériques sur Hedera Testnet avec fallback vers Polygon Testnet.

## Fonctionnalités

### 🔗 Enregistrement de Signatures
- **Hedera Testnet** : Service principal pour l'enregistrement des signatures
- **Polygon Testnet** : Service de fallback automatique
- **Hash Immuable** : Génération de preuves cryptographiques SHA-256
- **Vérification** : Validation de l'authenticité des signatures

### 📋 Types d'Opérations Supportées
- Enregistrement de signatures numériques
- Génération de preuves cryptographiques
- Vérification d'authenticité
- Historique des transactions

### ⚖️ Conformité et Sécurité
- Enregistrement immuable sur blockchain
- Preuves cryptographiques horodatées
- Traçabilité complète des signatures
- Résistance à la falsification

## Configuration

### Variables d'Environnement

```bash
# Hedera Testnet (Service Principal)
HEDERA_ACCOUNT_ID=0.0.12345
HEDERA_PRIVATE_KEY=your_hedera_private_key
HEDERA_NETWORK=testnet
HEDERA_TOPIC_ID=0.0.67890  # Optionnel, sera créé automatiquement

# Polygon Testnet (Fallback)
POLYGON_RPC_URL=https://rpc-mumbai.maticvigil.com
POLYGON_PRIVATE_KEY=0x1234567890123456789012345678901234567890123456789012345678901234
POLYGON_NETWORK=mumbai
```

### Configuration Hedera

1. **Créer un compte Hedera Testnet** :
   - Aller sur [Hedera Portal](https://portal.hedera.com)
   - Créer un compte testnet
   - Récupérer l'Account ID et la Private Key

2. **Financer le compte** :
   - Utiliser le [Hedera Faucet](https://portal.hedera.com/faucet)
   - Obtenir des HBAR pour les frais de transaction

### Configuration Polygon

1. **Créer un wallet** :
   - Générer une clé privée Ethereum
   - Récupérer l'adresse du wallet

2. **Financer le wallet** :
   - Utiliser le [Polygon Faucet](https://faucet.polygon.technology/)
   - Obtenir des MATIC pour les frais de transaction

## Utilisation

### Enregistrement de Signature

```javascript
const BlockchainService = require('./services/blockchainService');

const blockchainService = new BlockchainService();

const signature = {
    documentId: 'doc-uuid',
    signerId: 'user-uuid',
    signerEmail: 'user@example.com',
    signature: 'signature-data',
    timestamp: new Date()
};

try {
    const blockchainRecord = await blockchainService.recordSignature(signature);
    console.log('Signature enregistrée:', blockchainRecord.transactionHash);
} catch (error) {
    console.error('Erreur:', error.message);
}
```

### Vérification de Signature

```javascript
const verificationResult = await blockchainService.verifySignature(
    recordId, 
    originalSignature
);

if (verificationResult.isValid) {
    console.log('Signature valide');
} else {
    console.log('Signature invalide:', verificationResult.errors);
}
```

### Génération de Preuve

```javascript
const document = {
    id: 'doc-uuid',
    content: 'Contenu du document',
    parties: [{ name: 'Jean Dupont', email: 'jean@example.com' }]
};

const proof = await blockchainService.generateProof(document);
console.log('Hash du document:', proof.hash);
```

## API Endpoints

### POST /api/blockchain/sign/:id
Signe un document et l'enregistre sur blockchain.

**Request Body:**
```json
{
    "signature": "signature-data",
    "signerName": "Jean Dupont",
    "verificationCode": "123456"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Document signé avec succès",
    "signature": { ... },
    "blockchainRecord": {
        "transactionHash": "0x...",
        "network": "hedera",
        "status": "confirmed"
    }
}
```

### GET /api/blockchain/verify/:id
Vérifie l'authenticité d'une signature.

**Response:**
```json
{
    "success": true,
    "verification": {
        "isValid": true,
        "verifiedAt": "2024-01-01T00:00:00Z",
        "verificationMethod": "hedera_verification"
    }
}
```

### POST /api/blockchain/proof/:id
Génère une preuve cryptographique pour un document.

**Response:**
```json
{
    "success": true,
    "proof": {
        "hash": "abc123...",
        "algorithm": "SHA-256",
        "timestamp": "2024-01-01T00:00:00Z",
        "blockchainRecord": { ... }
    }
}
```

### GET /api/blockchain/transactions
Récupère l'historique des transactions blockchain.

**Response:**
```json
{
    "success": true,
    "transactions": [
        {
            "id": "uuid",
            "documentTitle": "Contrat de vente",
            "signatureDate": "2024-01-01T00:00:00Z",
            "blockchainHash": "0x...",
            "network": "hedera",
            "status": "signed"
        }
    ]
}
```

## Health Check

### GET /health/blockchain/status
Vérifie l'état des services blockchain.

### POST /health/blockchain/test-signature
Teste l'enregistrement d'une signature.

### POST /health/blockchain/test-proof
Teste la génération de preuve.

### GET /health/blockchain/config
Affiche la configuration (sans données sensibles).

### GET /health/blockchain/metrics
Affiche les métriques de performance.

## Architecture

```
BlockchainService
├── recordSignature()          # Enregistrement sur blockchain
├── verifySignature()          # Vérification d'authenticité
├── generateProof()            # Génération de preuve cryptographique
├── initializeHedera()         # Connexion Hedera Testnet
├── initializePolygon()        # Connexion Polygon Testnet
├── recordSignatureHedera()    # Enregistrement Hedera
├── recordSignaturePolygon()   # Enregistrement Polygon
├── verifyHederaSignature()    # Vérification Hedera
├── verifyPolygonSignature()   # Vérification Polygon
└── getStatus()               # Statut des services
```

## Stratégie de Fallback

1. **Tentative Hedera** (service primaire)
   - Enregistrement sur Hedera Topic
   - Frais réduits et rapidité
   - Consensus Hashgraph

2. **Fallback Polygon** (si Hedera échoue)
   - Transaction Ethereum-compatible
   - Réseau mature et stable
   - Frais variables selon congestion

3. **Gestion d'Erreurs**
   - Retry automatique avec backoff
   - Messages d'erreur explicites
   - Logging détaillé des échecs

## Base de Données

### Tables Créées

- `digital_signatures` : Signatures numériques avec références blockchain
- `blockchain_records` : Enregistrements des transactions blockchain
- `cryptographic_proofs` : Preuves cryptographiques des documents

### Migration

```sql
-- Exécuter la migration
psql -d your_database -f src/database/migrations/002_digital_signatures.sql
```

## Tests

```bash
# Tests unitaires blockchain
npm test -- --testPathPattern=blockchain.test.js

# Tests d'intégration (nécessite configuration)
npm test -- --testPathPattern=blockchainService.test.js
```

## Monitoring

### Métriques Surveillées
- Temps de traitement des signatures
- Taux de succès par réseau
- Disponibilité des services
- Coût des transactions

### Alertes Configurées
- Échec de connexion blockchain
- Timeout de transaction
- Solde insuffisant
- Erreurs de vérification

## Sécurité

- **Clés Privées** : Stockage sécurisé des clés blockchain
- **Validation** : Vérification des données avant enregistrement
- **Audit Trail** : Traçabilité complète des opérations
- **Rate Limiting** : Protection contre les abus

## Dépannage

### Erreurs Communes

**"Aucun service blockchain disponible"**
- Vérifier les variables d'environnement
- Contrôler la connectivité réseau
- Vérifier les soldes des comptes

**"Échec transaction Hedera"**
- Vérifier le solde HBAR
- Contrôler la validité de l'Account ID
- Vérifier la clé privée

**"Échec transaction Polygon"**
- Vérifier le solde MATIC
- Contrôler l'URL RPC
- Vérifier la clé privée (format 0x...)

### Logs Utiles

```bash
# Logs du service blockchain
tail -f logs/app.log | grep blockchain

# Status des services
curl http://localhost:3000/health/blockchain/status

# Test de signature
curl -X POST http://localhost:3000/health/blockchain/test-signature
```

## Roadmap

- [ ] Support Hedera Mainnet
- [ ] Support Polygon Mainnet
- [ ] Intégration avec d'autres blockchains
- [ ] Optimisation des coûts de transaction
- [ ] Interface de monitoring avancée
- [ ] Signature multi-parties
- [ ] Smart contracts personnalisés