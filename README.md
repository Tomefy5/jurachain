# JusticeAutomation

Plateforme décentralisée basée sur l'IA et la blockchain pour rendre l'accès aux documents légaux professionnel, simple et sécurisé à Madagascar.

## Architecture

- **API Gateway**: Express.js avec middlewares de sécurité
- **Base de données**: Supabase pour l'authentification et le stockage
- **IA**: Ollama (local) + Gemini API (cloud) pour la génération de documents
- **Blockchain**: Hedera Testnet pour les signatures numériques
- **Analytics**: DuckDB pour les statistiques et analyses
- **Monitoring**: Prometheus pour la surveillance des services

## Démarrage Rapide

### Prérequis

- Docker et Docker Compose
- Node.js 18+ (pour le développement local)
- Compte Supabase
- Clés API pour Gemini et Hedera

### Installation

1. Cloner le repository
```bash
git clone <repository-url>
cd justice-automation
```

2. Copier et configurer les variables d'environnement
```bash
cp .env.example .env
# Éditer .env avec vos configurations
```

3. Démarrer les services avec Docker Compose
```bash
docker-compose up -d
```

4. Vérifier que tous les services sont actifs
```bash
curl http://localhost:3000/health/detailed
```

### Développement Local

1. Installer les dépendances
```bash
npm install
```

2. Démarrer en mode développement
```bash
npm run dev
```

## Services

### API Gateway (Port 3000)
- **Health Check**: `GET /health`
- **Authentication**: `POST /api/auth/login`, `POST /api/auth/register`
- **Documents**: `GET /api/documents`, `POST /api/documents/generate`
- **Blockchain**: `POST /api/blockchain/sign/:id`
- **Analytics**: `GET /api/analytics/dashboard`

### Ollama AI Service (Port 11434)
Service local d'IA pour la génération de documents

### Prometheus Monitoring (Port 9090)
Interface de monitoring accessible à `http://localhost:9090`

### Analytics Service (Port 8000)
Service DuckDB pour les statistiques et analyses

## Configuration

### Variables d'Environnement

Voir `.env.example` pour la liste complète des variables requises.

### Supabase Setup

1. Créer un nouveau projet Supabase
2. Copier l'URL du projet et les clés API
3. Configurer les variables d'environnement correspondantes

### Hedera Testnet Setup

1. Créer un compte sur Hedera Testnet
2. Obtenir l'Account ID et la Private Key
3. Configurer les variables d'environnement blockchain

## Monitoring

### Métriques Disponibles

- Temps de réponse HTTP
- Taux d'erreur
- Durée de génération de documents
- Transactions blockchain
- Utilisation des ressources

### Alertes

Les alertes sont configurées dans `monitoring/alert_rules.yml` pour:
- Temps de réponse élevé
- Taux d'erreur élevé
- Services indisponibles
- Échecs de génération de documents

## Sécurité

- Authentification JWT avec Supabase
- Rate limiting sur toutes les routes
- Validation des données d'entrée
- Headers de sécurité avec Helmet
- CORS configuré

## Tests

```bash
# Exécuter les tests
npm test

# Tests avec couverture
npm run test:coverage
```

## Déploiement

Le projet est configuré pour le déploiement avec Docker sur Ubuntu/Linux.

```bash
# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## License

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.