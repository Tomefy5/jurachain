# Système d'Authentification et de Sécurité - JusticeAutomation

## Vue d'ensemble

Le système d'authentification de JusticeAutomation implémente une sécurité robuste avec authentification multi-facteurs (MFA), contrôle d'accès basé sur les rôles (RBAC), et audit de sécurité complet.

## Fonctionnalités Principales

### 1. Authentification JWT avec Supabase
- Intégration complète avec Supabase Auth
- Tokens JWT sécurisés avec claims étendus
- Gestion des sessions avec expiration automatique
- Renouvellement automatique des tokens

### 2. Authentification Multi-Facteurs (MFA)
- Support Email et SMS
- Codes à 6 chiffres avec expiration (5 minutes)
- Protection contre les attaques par force brute
- Activation/désactivation par l'utilisateur

### 3. Contrôle d'Accès Basé sur les Rôles (RBAC)
- 4 rôles prédéfinis : `admin`, `lawyer`, `user`, `guest`
- Système de permissions granulaires
- Support des permissions wildcard (`admin:*`)
- Vérification d'ownership des ressources

### 4. Sécurité Avancée
- Rate limiting par endpoint et par utilisateur
- Détection d'activités suspectes
- Headers de sécurité (CSP, HSTS, etc.)
- Sanitisation des entrées utilisateur
- Audit logging complet

## Architecture

```
src/
├── services/
│   ├── authService.js      # Service principal d'authentification
│   └── auditService.js     # Service d'audit et logging
├── middleware/
│   ├── auth.js            # Middlewares d'authentification
│   └── security.js        # Middlewares de sécurité
├── config/
│   └── security.js        # Configuration de sécurité
└── routes/
    └── auth.js            # Routes d'authentification
```

## Utilisation

### Inscription d'un utilisateur

```javascript
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "StrongPass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+261340000000"
}
```

### Connexion avec MFA

```javascript
// 1. Connexion initiale
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "StrongPass123!"
}

// Réponse si MFA activé:
{
  "message": "Authentification multi-facteurs requise",
  "mfaRequired": true,
  "tempToken": "temp_jwt_token",
  "availableMethods": ["email", "sms"]
}

// 2. Demande de code MFA
POST /api/auth/mfa/request
{
  "method": "email",
  "tempToken": "temp_jwt_token"
}

// 3. Vérification du code MFA
POST /api/auth/mfa/verify
{
  "code": "123456",
  "tempToken": "temp_jwt_token"
}
```

### Protection des routes

```javascript
const { authMiddleware, requireRole, requirePermission } = require('./middleware/auth');

// Authentification requise
app.get('/api/protected', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Rôle spécifique requis
app.get('/api/admin', authMiddleware, requireRole(['admin']), (req, res) => {
  res.json({ message: 'Admin access' });
});

// Permission spécifique requise
app.post('/api/documents', authMiddleware, requirePermission('documents:create'), (req, res) => {
  // Créer document
});
```

## Rôles et Permissions

### Rôles Disponibles

| Rôle | Description | Permissions |
|------|-------------|-------------|
| `admin` | Administrateur système | `admin:*` (toutes permissions) |
| `lawyer` | Avocat/Juriste | `documents:*`, `blockchain:*`, `analytics:read`, `users:read` |
| `user` | Utilisateur standard | `documents:create`, `documents:read:own`, `documents:update:own`, `documents:delete:own`, `blockchain:sign:own`, `analytics:read:own` |
| `guest` | Invité | `documents:read:public` |

### Permissions Granulaires

- `documents:create` - Créer des documents
- `documents:read` - Lire tous les documents
- `documents:read:own` - Lire ses propres documents
- `documents:update:own` - Modifier ses propres documents
- `blockchain:sign:own` - Signer ses propres documents
- `analytics:read:own` - Consulter ses propres analytics

## Configuration de Sécurité

### Variables d'Environnement

```bash
# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Politique de Mot de Passe

- Minimum 8 caractères
- Au moins 1 majuscule
- Au moins 1 minuscule
- Au moins 1 chiffre
- Au moins 1 caractère spécial (@$!%*?&)

### Rate Limiting

| Endpoint | Limite | Fenêtre |
|----------|--------|---------|
| `/api/auth/login` | 5 tentatives | 15 minutes |
| `/api/auth/mfa/*` | 3 tentatives | 5 minutes |
| API générale | 60 requêtes | 1 minute |

## Audit et Monitoring

### Événements Audités

- `USER_LOGIN` - Connexion utilisateur
- `USER_REGISTER` - Inscription utilisateur
- `FAILED_LOGIN` - Tentative de connexion échouée
- `MFA_ENABLE` - Activation MFA
- `ROLE_CHANGE` - Changement de rôle
- `SUSPICIOUS_ACTIVITY` - Activité suspecte détectée

### Logs de Sécurité

```javascript
const auditService = require('./services/auditService');

// Log d'événement personnalisé
await auditService.logSecurityEvent('CUSTOM_EVENT', {
  userId: user.id,
  ipAddress: req.ip,
  action: 'custom_action',
  result: 'SUCCESS'
});
```

## Tests

```bash
# Exécuter les tests d'authentification
npm test src/tests/auth.test.js

# Exécuter tous les tests
npm test
```

## Sécurité en Production

### Recommandations

1. **HTTPS Obligatoire** - Toujours utiliser HTTPS en production
2. **Secrets Sécurisés** - Utiliser un gestionnaire de secrets (AWS Secrets Manager, etc.)
3. **Monitoring** - Surveiller les logs d'audit pour détecter les anomalies
4. **Backup** - Sauvegarder régulièrement les données d'authentification
5. **Mise à jour** - Maintenir les dépendances à jour

### Headers de Sécurité

- `Content-Security-Policy` - Protection XSS
- `Strict-Transport-Security` - Force HTTPS
- `X-Frame-Options` - Protection clickjacking
- `X-Content-Type-Options` - Protection MIME sniffing

## Dépannage

### Erreurs Communes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `MISSING_TOKEN` | Token d'authentification manquant | Inclure `Authorization: Bearer <token>` |
| `EXPIRED_TOKEN` | Token expiré | Renouveler le token |
| `MFA_REQUIRED` | MFA non vérifié | Compléter le processus MFA |
| `INSUFFICIENT_PERMISSIONS` | Permissions insuffisantes | Vérifier les rôles/permissions |

### Debug

```javascript
// Activer les logs détaillés
process.env.LOG_LEVEL = 'debug';

// Vérifier les permissions utilisateur
console.log('User permissions:', req.user.permissions);
```

## Contribution

Pour contribuer au système d'authentification :

1. Suivre les standards de sécurité OWASP
2. Ajouter des tests pour toute nouvelle fonctionnalité
3. Documenter les changements de sécurité
4. Effectuer un audit de sécurité avant merge

## Support

Pour toute question de sécurité, contacter l'équipe de sécurité JusticeAutomation.