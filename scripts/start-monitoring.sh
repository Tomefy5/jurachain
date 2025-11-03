#!/bin/bash

# Monitoring Services Startup Script for JusticeAutomation
# This script starts all monitoring and observability services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Démarrage des services de monitoring JusticeAutomation${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker n'est pas en cours d'exécution${NC}"
    echo -e "${YELLOW}Veuillez démarrer Docker et réessayer${NC}"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose n'est pas installé${NC}"
    exit 1
fi

# Load environment variables
if [ -f ".env" ]; then
    echo -e "${GREEN}📋 Chargement des variables d'environnement depuis .env${NC}"
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}⚠️  Fichier .env non trouvé, utilisation des valeurs par défaut${NC}"
fi

# Start monitoring services
echo -e "${YELLOW}🔧 Démarrage des services de monitoring...${NC}"

# Start Prometheus
echo -e "${BLUE}📊 Démarrage de Prometheus...${NC}"
docker-compose up -d prometheus
sleep 5

# Start Alertmanager
echo -e "${BLUE}🚨 Démarrage d'Alertmanager...${NC}"
docker-compose up -d alertmanager
sleep 3

# Start Node Exporter
echo -e "${BLUE}💻 Démarrage de Node Exporter...${NC}"
docker-compose up -d node-exporter
sleep 2

# Start Blackbox Exporter
echo -e "${BLUE}🔍 Démarrage de Blackbox Exporter...${NC}"
docker-compose up -d blackbox-exporter
sleep 2

# Start SonarQube and its database
echo -e "${BLUE}🔍 Démarrage de SonarQube...${NC}"
docker-compose up -d sonarqube-db
sleep 10  # Wait for database to be ready
docker-compose up -d sonarqube
sleep 15  # Wait for SonarQube to initialize

# Check service status
echo -e "${YELLOW}🔍 Vérification du statut des services...${NC}"

services=(
    "prometheus:${PROMETHEUS_PORT:-9090}"
    "alertmanager:${ALERTMANAGER_PORT:-9093}"
    "node-exporter:${NODE_EXPORTER_PORT:-9100}"
    "blackbox-exporter:${BLACKBOX_EXPORTER_PORT:-9115}"
    "sonarqube:${SONARQUBE_PORT:-9000}"
)

all_healthy=true

for service_port in "${services[@]}"; do
    service_name=$(echo $service_port | cut -d':' -f1)
    port=$(echo $service_port | cut -d':' -f2)
    
    echo -n "  Vérification de $service_name sur le port $port... "
    
    if curl -s "http://localhost:$port" > /dev/null 2>&1 || curl -s "http://localhost:$port/-/healthy" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${RED}❌ ÉCHEC${NC}"
        all_healthy=false
    fi
done

# Display service URLs
echo -e "\n${GREEN}🎉 Services de monitoring démarrés!${NC}"
echo -e "\n${BLUE}📊 URLs des services:${NC}"
echo -e "  • Prometheus:        http://localhost:${PROMETHEUS_PORT:-9090}"
echo -e "  • Alertmanager:      http://localhost:${ALERTMANAGER_PORT:-9093}"
echo -e "  • Node Exporter:     http://localhost:${NODE_EXPORTER_PORT:-9100}"
echo -e "  • Blackbox Exporter: http://localhost:${BLACKBOX_EXPORTER_PORT:-9115}"
echo -e "  • SonarQube:         http://localhost:${SONARQUBE_PORT:-9000}"

echo -e "\n${BLUE}🔗 Endpoints utiles:${NC}"
echo -e "  • Métriques API:     http://localhost:3000/metrics"
echo -e "  • Santé API:         http://localhost:3000/health"
echo -e "  • Dashboard:         http://localhost:3000/api/monitoring/dashboard"
echo -e "  • Alertes:           http://localhost:3000/api/alerts/history"

if [ "$all_healthy" = true ]; then
    echo -e "\n${GREEN}✅ Tous les services de monitoring sont opérationnels!${NC}"
    
    # Wait for SonarQube to be fully ready
    echo -e "\n${YELLOW}⏳ Attente de l'initialisation complète de SonarQube...${NC}"
    max_attempts=30
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "http://localhost:${SONARQUBE_PORT:-9000}/api/system/status" | grep -q '"status":"UP"'; then
            echo -e "${GREEN}✅ SonarQube est prêt!${NC}"
            break
        fi
        
        echo -n "."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        echo -e "\n${YELLOW}⚠️  SonarQube prend plus de temps que prévu à démarrer${NC}"
        echo -e "${YELLOW}Vérifiez les logs avec: docker-compose logs sonarqube${NC}"
    fi
    
    echo -e "\n${GREEN}🎯 Configuration recommandée:${NC}"
    echo -e "  1. Configurez SonarQube avec un token d'authentification"
    echo -e "  2. Exécutez l'analyse de code avec: ./scripts/sonar-analysis.sh"
    echo -e "  3. Configurez les notifications d'alertes dans Alertmanager"
    echo -e "  4. Personnalisez les seuils d'alerte dans monitoring/alert_rules.yml"
    
else
    echo -e "\n${RED}❌ Certains services ont échoué à démarrer${NC}"
    echo -e "${YELLOW}Vérifiez les logs avec: docker-compose logs [service-name]${NC}"
    exit 1
fi

echo -e "\n${BLUE}📚 Documentation:${NC}"
echo -e "  • Prometheus: https://prometheus.io/docs/"
echo -e "  • Alertmanager: https://prometheus.io/docs/alerting/latest/alertmanager/"
echo -e "  • SonarQube: https://docs.sonarqube.org/"

echo -e "\n${GREEN}🎉 Configuration du monitoring terminée!${NC}"