#!/bin/bash

# SonarQube Analysis Script for JusticeAutomation
# This script runs code quality analysis using SonarQube

set -e

# Configuration
SONAR_HOST_URL=${SONAR_HOST_URL:-"http://localhost:9000"}
SONAR_TOKEN=${SONARQUBE_TOKEN:-""}
PROJECT_KEY="justice-automation"
PROJECT_NAME="JusticeAutomation"
PROJECT_VERSION="1.0.0"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Démarrage de l'analyse SonarQube pour JusticeAutomation${NC}"

# Check if SonarQube is running
echo -e "${YELLOW}Vérification de la disponibilité de SonarQube...${NC}"
if ! curl -s "$SONAR_HOST_URL/api/system/status" > /dev/null; then
    echo -e "${RED}❌ SonarQube n'est pas accessible à $SONAR_HOST_URL${NC}"
    echo -e "${YELLOW}Assurez-vous que SonarQube est démarré avec: docker-compose up sonarqube${NC}"
    exit 1
fi

echo -e "${GREEN}✅ SonarQube est accessible${NC}"

# Check if sonar-scanner is installed
if ! command -v sonar-scanner &> /dev/null; then
    echo -e "${YELLOW}⚠️  sonar-scanner n'est pas installé. Installation...${NC}"
    
    # Install sonar-scanner based on OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        wget -q https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-4.8.0.2856-linux.zip
        unzip -q sonar-scanner-cli-4.8.0.2856-linux.zip
        sudo mv sonar-scanner-4.8.0.2856-linux /opt/sonar-scanner
        sudo ln -sf /opt/sonar-scanner/bin/sonar-scanner /usr/local/bin/sonar-scanner
        rm sonar-scanner-cli-4.8.0.2856-linux.zip
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install sonar-scanner
        else
            echo -e "${RED}❌ Homebrew n'est pas installé. Veuillez installer sonar-scanner manuellement.${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ OS non supporté pour l'installation automatique de sonar-scanner${NC}"
        echo -e "${YELLOW}Veuillez installer sonar-scanner manuellement depuis: https://docs.sonarqube.org/latest/analysis/scan/sonarscanner/${NC}"
        exit 1
    fi
fi

# Run tests to generate coverage report
echo -e "${YELLOW}🧪 Exécution des tests pour générer le rapport de couverture...${NC}"
if [ -f "package.json" ]; then
    npm test -- --coverage --watchAll=false || echo -e "${YELLOW}⚠️  Certains tests ont échoué, mais l'analyse continue...${NC}"
else
    echo -e "${YELLOW}⚠️  package.json non trouvé, analyse sans rapport de couverture${NC}"
fi

# Prepare SonarQube analysis parameters
SONAR_PARAMS=(
    "-Dsonar.projectKey=$PROJECT_KEY"
    "-Dsonar.projectName=$PROJECT_NAME"
    "-Dsonar.projectVersion=$PROJECT_VERSION"
    "-Dsonar.host.url=$SONAR_HOST_URL"
    "-Dsonar.sources=src"
    "-Dsonar.tests=src/tests"
    "-Dsonar.exclusions=**/node_modules/**,**/dist/**,**/public/**,**/logs/**,**/*.min.js"
    "-Dsonar.javascript.lcov.reportPaths=coverage/lcov.info"
    "-Dsonar.typescript.lcov.reportPaths=coverage/lcov.info"
    "-Dsonar.coverage.exclusions=**/tests/**,**/node_modules/**,**/dist/**"
    "-Dsonar.sourceEncoding=UTF-8"
    "-Dsonar.scm.provider=git"
)

# Add token if provided
if [ -n "$SONAR_TOKEN" ]; then
    SONAR_PARAMS+=("-Dsonar.login=$SONAR_TOKEN")
fi

# Run SonarQube analysis
echo -e "${YELLOW}🔍 Lancement de l'analyse SonarQube...${NC}"
sonar-scanner "${SONAR_PARAMS[@]}"

# Check analysis result
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Analyse SonarQube terminée avec succès!${NC}"
    echo -e "${GREEN}📊 Consultez les résultats sur: $SONAR_HOST_URL/dashboard?id=$PROJECT_KEY${NC}"
    
    # Wait a moment for the analysis to be processed
    sleep 5
    
    # Get quality gate status
    echo -e "${YELLOW}🎯 Vérification du Quality Gate...${NC}"
    if [ -n "$SONAR_TOKEN" ]; then
        QUALITY_GATE_STATUS=$(curl -s -u "$SONAR_TOKEN:" "$SONAR_HOST_URL/api/qualitygates/project_status?projectKey=$PROJECT_KEY" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        
        if [ "$QUALITY_GATE_STATUS" = "OK" ]; then
            echo -e "${GREEN}✅ Quality Gate: PASSED${NC}"
        elif [ "$QUALITY_GATE_STATUS" = "ERROR" ]; then
            echo -e "${RED}❌ Quality Gate: FAILED${NC}"
            echo -e "${YELLOW}Consultez le dashboard pour plus de détails: $SONAR_HOST_URL/dashboard?id=$PROJECT_KEY${NC}"
            exit 1
        else
            echo -e "${YELLOW}⚠️  Quality Gate: $QUALITY_GATE_STATUS${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Token SonarQube non fourni, impossible de vérifier le Quality Gate automatiquement${NC}"
    fi
else
    echo -e "${RED}❌ L'analyse SonarQube a échoué${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Analyse de qualité du code terminée!${NC}"