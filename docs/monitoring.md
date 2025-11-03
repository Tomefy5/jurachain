# Guide de Monitoring et Observabilité - JusticeAutomation

## Vue d'ensemble

Le système de monitoring de JusticeAutomation fournit une observabilité complète de la plateforme avec:

- **Prometheus** : Collecte et stockage des métriques
- **Alertmanager** : Gestion et routage des alertes
- **SonarQube** : Analyse de qualité du code
- **Node Exporter** : Métriques système
- **Blackbox Exporter** : Monitoring des services externes

## Architecture de Monitoring

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │───▶│   Prometheus    │───▶│  Alertmanager   │
│   (Métriques)   │    │   (Collecte)    │    │   (Alertes)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SonarQube     │    │ Node Exporter   │    │ Notifications   │
│ (Qualité Code)  │    │ (Système OS)    │    │ (Email/Webhook) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Démarrage Rapide

### 1. Démarrer les Services de Monitoring

```bash
# Démarrer tous les services de monitoring
npm run monitoring:start

# Ou manuellement avec Docker Compose
docker-compose up -d prometheus alertmanager node-exporter blackbox-exporter sonarqube
```

### 2. Vérifier le Statut

```bash
# Vérifier la santé de l'API
npm run health

# Consulter les métriques
npm run metrics

# Vérifier les services individuellement
curl http://localhost:9090/-/healthy  # Prometheus
curl http://localhost:9093/-/healthy  # Alertmanager
curl http://localhost:9000/api/system/status  # SonarQube
```

### 3. Analyser la Qualité du Code

```bash
# Lancer l'analyse SonarQube
npm run sonar:analyze
```

## Services et Ports

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| Prometheus | 9090 | http://localhost:9090 | Collecte et stockage des métriques |
| Alertmanager | 9093 | http://localhost:9093 | Gestion des alertes |
| Node Exporter | 9100 | http://localhost:9100 | Métriques système |
| Blackbox Exporter | 9115 | http://localhost:9115 | Tests de connectivité |
| SonarQube | 9000 | http://localhost:9000 | Analyse de qualité du code |

## Métriques Collectées

### Métriques HTTP
- `http_requests_total` : Nombre total de requêtes HTTP
- `http_request_duration_seconds` : Durée des requêtes HTTP
- `active_connections` : Nombre de connexions actives

### Métriques Métier
- `document_generation_total` : Documents générés
- `document_generation_duration_seconds` : Temps de génération
- `blockchain_transaction_total` : Transactions blockchain
- `blockchain_transaction_duration_seconds` : Temps de transaction
- `risk_detections_total` : Risques détectés dans les documents
- `active_users_total` : Utilisateurs actifs
- `collaborative_sessions_active` : Sessions collaboratives actives

### Métriques IA
- `ai_service_health` : Santé des services IA (Ollama/Gemini)
- `clause_analysis_duration_seconds` : Temps d'analyse des clauses
- `translation_duration_seconds` : Temps de traduction

### Métriques Système
- `process_resident_memory_bytes` : Utilisation mémoire
- `process_cpu_seconds_total` : Utilisation CPU
- `nodejs_heap_size_total_bytes` : Taille du heap Node.js

## Alertes Configurées

### Alertes de Performance
- **HighResponseTime** : Temps de réponse > 500ms (Warning)
- **VeryHighResponseTime** : Temps de réponse > 2s (Critical)
- **HighErrorRate** : Taux d'erreur > 10% (Critical)

### Alertes de Disponibilité
- **ServiceDown** : Service indisponible (Critical)
- **APIGatewayHealthCheckFailed** : Health check API échoué (Critical)
- **OllamaServiceUnavailable** : Service Ollama indisponible (Warning)

### Alertes de Ressources
- **HighMemoryUsage** : Utilisation mémoire > 500MB (Warning)
- **VeryHighMemoryUsage** : Utilisation mémoire > 1GB (Critical)
- **HighCPUUsage** : Utilisation CPU > 80% (Warning)

### Alertes Métier
- **DocumentGenerationFailures** : Taux d'échec génération > 20% (Warning)
- **BlockchainTransactionFailures** : Taux d'échec blockchain > 10% (Critical)
- **NoDocumentGenerationActivity** : Aucune génération en 10min (Warning)

### Alertes de Sécurité
- **HighAuthenticationFailures** : Échecs d'authentification > 5/s (Warning)
- **SuspiciousActivity** : Trop de requêtes d'une IP > 100/s (Warning)

## Configuration des Alertes

### Modifier les Seuils

Éditez `monitoring/alert_rules.yml` pour ajuster les seuils:

```yaml
- alert: HighResponseTime
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
  for: 2m
  labels:
    severity: warning
```

### Configuration des Notifications

Éditez `monitoring/alertmanager.yml` pour configurer les notifications:

```yaml
receivers:
- name: 'critical-alerts'
  email_configs:
  - to: 'admin@justice-automation.mg'
    subject: '[CRITICAL] JusticeAutomation Alert'
```

## API de Monitoring

### Endpoints Disponibles

```bash
# Dashboard de monitoring
GET /api/monitoring/dashboard

# Métriques en temps réel
GET /api/monitoring/metrics/realtime

# Santé des services
GET /api/monitoring/health/services

# Métriques de performance
GET /api/monitoring/performance?timeRange=1h

# Métriques métier
GET /api/monitoring/business

# Historique des alertes
GET /api/alerts/history?limit=50&severity=critical

# Statistiques des alertes
GET /api/alerts/stats

# Déclencher une alerte de test
POST /api/alerts/test
```

### Exemple d'utilisation

```javascript
// Récupérer le dashboard de monitoring
const response = await fetch('/api/monitoring/dashboard', {
  headers: { 'Authorization': 'Bearer ' + token }
});
const dashboard = await response.json();

console.log('Santé du système:', dashboard.health.status);
console.log('Métriques:', dashboard.metrics);
```

## SonarQube - Analyse de Qualité

### Configuration Initiale

1. Accédez à http://localhost:9000
2. Connectez-vous avec admin/admin
3. Changez le mot de passe par défaut
4. Créez un token d'authentification
5. Ajoutez le token à votre fichier `.env`:

```bash
SONARQUBE_TOKEN=your_generated_token
```

### Lancer une Analyse

```bash
# Analyse complète avec tests de couverture
npm run sonar:analyze

# Ou manuellement
./scripts/sonar-analysis.sh
```

### Quality Gates

Le projet est configuré avec les seuils suivants:
- Couverture de code : > 80%
- Duplication : < 3%
- Maintenabilité : A
- Fiabilité : A
- Sécurité : A

## Dashboards Prometheus

### Requêtes Utiles

```promql
# Taux de requêtes par seconde
rate(http_requests_total[5m])

# Temps de réponse 95e percentile
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Taux d'erreur
rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])

# Documents générés par heure
increase(document_generation_total[1h])

# Utilisation mémoire en MB
process_resident_memory_bytes / 1024 / 1024
```

## Dépannage

### Services ne Démarrent Pas

```bash
# Vérifier les logs
docker-compose logs prometheus
docker-compose logs alertmanager
docker-compose logs sonarqube

# Vérifier l'espace disque
df -h

# Vérifier les ports
netstat -tulpn | grep :9090
```

### Métriques Manquantes

```bash
# Vérifier l'endpoint des métriques
curl http://localhost:3000/metrics

# Vérifier la configuration Prometheus
curl http://localhost:9090/api/v1/targets
```

### Alertes ne Fonctionnent Pas

```bash
# Vérifier la configuration Alertmanager
curl http://localhost:9093/api/v1/status

# Tester une alerte
curl -X POST http://localhost:3000/api/alerts/test \
  -H "Content-Type: application/json" \
  -d '{"severity": "warning", "message": "Test alert"}'
```

## Bonnes Pratiques

### Monitoring
1. **Surveillez les 4 signaux d'or** : Latence, Trafic, Erreurs, Saturation
2. **Définissez des SLIs/SLOs** clairs pour chaque service
3. **Utilisez des alertes basées sur les symptômes**, pas sur les causes
4. **Évitez l'alerte fatigue** avec des seuils appropriés

### Métriques
1. **Nommage cohérent** : utilisez des préfixes par service
2. **Labels pertinents** : ajoutez des dimensions utiles
3. **Cardinalité contrôlée** : évitez trop de labels uniques
4. **Documentation** : documentez chaque métrique

### Alertes
1. **Actionnable** : chaque alerte doit avoir une action claire
2. **Contexte** : incluez des liens vers les runbooks
3. **Escalade** : définissez des niveaux de sévérité
4. **Test régulier** : vérifiez que les alertes fonctionnent

## Maintenance

### Nettoyage Régulier

```bash
# Nettoyer les données anciennes (configuré pour 200h)
# Prometheus se charge automatiquement du nettoyage

# Nettoyer les volumes Docker si nécessaire
docker volume prune

# Sauvegarder les données importantes
docker run --rm -v prometheus_data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus-backup.tar.gz /data
```

### Mise à Jour des Services

```bash
# Mettre à jour les images Docker
docker-compose pull prometheus alertmanager sonarqube

# Redémarrer avec les nouvelles images
docker-compose up -d --force-recreate prometheus alertmanager sonarqube
```

## Sécurité

### Authentification
- Configurez l'authentification pour SonarQube
- Utilisez des tokens pour les API
- Limitez l'accès réseau aux services de monitoring

### Données Sensibles
- Ne loggez jamais de données personnelles dans les métriques
- Utilisez des labels génériques pour les identifiants
- Chiffrez les communications entre services

## Support

Pour toute question ou problème:
1. Consultez les logs des services
2. Vérifiez la documentation officielle
3. Contactez l'équipe DevOps

---

*Documentation mise à jour le $(date)*