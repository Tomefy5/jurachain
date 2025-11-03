# Système d'Édition Collaborative - JusticeAutomation

Le système d'édition collaborative permet à plusieurs utilisateurs de travailler simultanément sur des documents légaux avec synchronisation en temps réel, sauvegarde automatique et notifications.

## 🚀 Fonctionnalités

### ✅ Édition Multi-Utilisateur
- **Google Docs API** : Intégration native avec Google Docs pour l'édition collaborative
- **Synchronisation Temps Réel** : WebSocket pour la synchronisation instantanée
- **Gestion des Sessions** : Suivi des utilisateurs actifs et de leurs sessions
- **Curseurs Collaboratifs** : Visualisation des positions des curseurs des autres utilisateurs

### ✅ Sauvegarde Automatique
- **Auto-Save Intelligent** : Sauvegarde automatique avec debouncing (2 secondes d'inactivité)
- **Horodatage** : Chaque modification est horodatée avec l'utilisateur
- **Sauvegarde Manuelle** : Possibilité de forcer la sauvegarde
- **Historique des Révisions** : Accès à l'historique complet via Google Drive

### ✅ Système de Notifications
- **Notifications Temps Réel** : Alertes instantanées via WebSocket
- **Types de Notifications** : Info, Warning, Success, Error
- **Notifications Ciblées** : Envoi à des utilisateurs spécifiques ou à tous les collaborateurs
- **Historique des Notifications** : Conservation des notifications importantes

### ✅ Gestion des Sessions
- **Sessions Sécurisées** : Authentification JWT pour chaque connexion WebSocket
- **Nettoyage Automatique** : Suppression des sessions inactives (30 minutes par défaut)
- **Statistiques** : Suivi des utilisateurs actifs et des documents ouverts
- **Déconnexion Gracieuse** : Gestion propre des déconnexions

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client Web    │◄──►│  WebSocket API   │◄──►│ Google Docs API │
│   (React PWA)   │    │  (Socket.IO)     │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   HTTP API      │    │ Collaborative    │    │   Session       │
│   (Express)     │    │    Service       │    │  Management     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📋 API Endpoints

### Documents Collaboratifs

#### POST `/api/collaborative/documents`
Créer un nouveau document collaboratif.

**Request Body:**
```json
{
  "title": "Contrat de Vente Immobilière",
  "content": "Contenu initial du document...",
  "type": "contract"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Document collaboratif créé avec succès",
  "document": {
    "documentId": "uuid",
    "googleDocId": "google-doc-id",
    "editUrl": "https://docs.google.com/document/d/.../edit",
    "sessionId": "session-uuid",
    "collaborators": ["user-id"]
  }
}
```

#### POST `/api/collaborative/documents/:documentId/join`
Rejoindre une session collaborative.

**Request Body:**
```json
{
  "socketId": "socket-connection-id"
}
```

#### GET `/api/collaborative/documents/:documentId/content`
Récupérer le contenu d'un document.

#### PUT `/api/collaborative/documents/:documentId/content`
Mettre à jour le contenu d'un document.

**Request Body:**
```json
{
  "content": "Nouveau contenu du document..."
}
```

#### GET `/api/collaborative/documents/:documentId/collaborators`
Obtenir la liste des collaborateurs actifs.

#### POST `/api/collaborative/documents/:documentId/notify`
Envoyer une notification aux collaborateurs.

**Request Body:**
```json
{
  "message": "Le document est prêt pour révision",
  "type": "info",
  "excludeSelf": true
}
```

#### GET `/api/collaborative/documents/:documentId/history`
Récupérer l'historique des révisions.

## 🔌 WebSocket Events

### Événements Client → Serveur

#### `join-document`
```javascript
socket.emit('join-document', {
  documentId: 'uuid'
});
```

#### `content-change`
```javascript
socket.emit('content-change', {
  content: 'Nouveau contenu...',
  changeType: 'insert',
  position: 150
});
```

#### `cursor-position`
```javascript
socket.emit('cursor-position', {
  position: 150,
  selection: { start: 150, end: 160 }
});
```

#### `save-document`
```javascript
socket.emit('save-document', {
  content: 'Contenu à sauvegarder...'
});
```

### Événements Serveur → Client

#### `document-joined`
```javascript
socket.on('document-joined', (data) => {
  console.log('Rejoint le document:', data.documentId);
  console.log('Collaborateurs:', data.collaborators);
});
```

#### `content-updated`
```javascript
socket.on('content-updated', (data) => {
  console.log('Contenu mis à jour par:', data.userEmail);
  console.log('Nouveau contenu:', data.content);
});
```

#### `collaborator-joined`
```javascript
socket.on('collaborator-joined', (data) => {
  console.log('Nouveau collaborateur:', data.userEmail);
});
```

#### `document-auto-saved`
```javascript
socket.on('document-auto-saved', (data) => {
  console.log('Document sauvegardé automatiquement:', data.timestamp);
});
```

#### `notification`
```javascript
socket.on('notification', (data) => {
  console.log('Notification:', data.message);
  console.log('Type:', data.type);
});
```

## ⚙️ Configuration

### Variables d'Environnement

```bash
# Google Services Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
GOOGLE_ACCESS_TOKEN=your_google_access_token
GOOGLE_REFRESH_TOKEN=your_google_refresh_token

# Collaborative Editing Configuration
COLLABORATIVE_AUTO_SAVE_DELAY=2000
COLLABORATIVE_SESSION_TIMEOUT=30
COLLABORATIVE_MAX_COLLABORATORS=10

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

### Configuration Google OAuth2

1. **Créer un projet Google Cloud**
2. **Activer les APIs** :
   - Google Docs API
   - Google Drive API
3. **Créer des identifiants OAuth2**
4. **Configurer les URLs de redirection**
5. **Obtenir les tokens d'accès**

## 🧪 Tests et Démonstration

### Exécuter les Tests
```bash
npm test -- --testPathPattern=collaborative.test.js
```

### Démonstration Interactive
```bash
node src/examples/collaborative-editing-demo.js
```

La démonstration montre :
- Création de documents collaboratifs
- Connexion de plusieurs utilisateurs
- Édition collaborative simulée
- Sauvegarde automatique
- Système de notifications
- Historique des révisions

## 🔧 Utilisation

### 1. Initialisation du Service

```javascript
const CollaborativeService = require('./services/collaborativeService');
const collaborativeService = new CollaborativeService();
```

### 2. Création d'un Document

```javascript
const documentData = {
  title: 'Mon Document Collaboratif',
  content: 'Contenu initial...',
  type: 'contract'
};

const result = await collaborativeService.createCollaborativeDocument(
  documentData,
  userId
);
```

### 3. Connexion WebSocket

```javascript
const WebSocketService = require('./services/websocketService');
const websocketService = new WebSocketService(server);
```

### 4. Intégration dans Express

```javascript
app.use('/api/collaborative', authMiddleware, collaborativeRoutes);
```

## 🚨 Gestion d'Erreurs

### Erreurs Communes

1. **Google API non configurée**
   - Vérifier les variables d'environnement
   - Valider les tokens OAuth2

2. **Session expirée**
   - Reconnexion automatique
   - Nettoyage des sessions inactives

3. **Conflit de modifications**
   - Résolution automatique via Google Docs
   - Notifications aux utilisateurs

4. **Perte de connexion WebSocket**
   - Reconnexion automatique
   - Synchronisation des modifications manquées

## 📊 Monitoring

### Métriques Disponibles

- Nombre de documents actifs
- Utilisateurs connectés par document
- Fréquence des sauvegardes
- Temps de réponse des API Google

### Logs

```javascript
// Activation des logs détaillés
process.env.COLLABORATIVE_DEBUG = 'true';
```

## 🔒 Sécurité

### Authentification
- JWT obligatoire pour toutes les connexions
- Validation des permissions par document
- Sessions sécurisées avec timeout

### Autorisation
- Contrôle d'accès par document
- Rôles collaborateurs (lecture/écriture)
- Audit trail complet

### Protection des Données
- Chiffrement des communications WebSocket
- Validation des entrées utilisateur
- Sanitisation du contenu

## 🚀 Déploiement

### Prérequis
- Node.js 18+
- Compte Google Cloud avec APIs activées
- Certificats SSL pour WebSocket sécurisé

### Production
```bash
# Variables d'environnement production
NODE_ENV=production
COLLABORATIVE_SESSION_TIMEOUT=60
COLLABORATIVE_MAX_COLLABORATORS=50

# Démarrage
npm start
```

## 📈 Performance

### Optimisations
- Debouncing des sauvegardes (2s par défaut)
- Nettoyage automatique des sessions (30min)
- Compression WebSocket
- Cache des métadonnées de documents

### Limites
- Maximum 10 collaborateurs par défaut
- Taille de document : 100KB max
- Timeout de session : 30 minutes

## 🤝 Contribution

Pour contribuer au système collaboratif :

1. Ajouter de nouveaux types de notifications
2. Améliorer la gestion des conflits
3. Étendre les métriques de monitoring
4. Optimiser les performances WebSocket

## 📚 Ressources

- [Google Docs API Documentation](https://developers.google.com/docs/api)
- [Socket.IO Documentation](https://socket.io/docs/)
- [OAuth2 Google Cloud](https://developers.google.com/identity/protocols/oauth2)
- [WebSocket Security Best Practices](https://websockets.readthedocs.io/en/stable/topics/security.html)