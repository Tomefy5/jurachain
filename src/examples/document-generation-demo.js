/**
 * Document Generation Demo
 * Demonstrates the AI document generator functionality
 */

const DocumentGeneratorService = require('../services/documentGenerator');
const { DocumentType, Language } = require('../types/enums.js');

async function demonstrateDocumentGeneration() {
    console.log('🚀 JusticeAutomation - Document Generation Demo\n');

    const documentGenerator = new DocumentGeneratorService();

    // Example 1: French Contract
    console.log('📄 Exemple 1: Génération d\'un contrat de vente en français');
    const frenchContractRequest = {
        type: DocumentType.SALE_AGREEMENT,
        language: Language.FRENCH,
        description: 'Contrat de vente d\'un véhicule Toyota Corolla 2018, couleur blanche, 50000 km au compteur, entre un particulier et un acheteur privé.',
        parties: [
            {
                name: 'Jean Rakoto',
                email: 'jean.rakoto@email.mg',
                role: 'seller',
                address: 'Lot 123 Antananarivo 101, Madagascar',
                phone: '+261341234567'
            },
            {
                name: 'Marie Rasoa',
                email: 'marie.rasoa@email.mg',
                role: 'buyer',
                address: 'Lot 456 Fianarantsoa, Madagascar',
                phone: '+261347654321'
            }
        ],
        jurisdiction: 'Madagascar',
        specificClauses: [
            'Garantie mécanique de 6 mois',
            'Paiement en 3 tranches égales',
            'Transfert de propriété immédiat'
        ],
        urgency: 'medium'
    };

    try {
        console.log('⏳ Génération en cours...');
        const frenchDocument = await documentGenerator.generateContract(frenchContractRequest);

        console.log('✅ Document généré avec succès!');
        console.log(`📋 Titre: ${frenchDocument.title}`);
        console.log(`🏷️  Type: ${frenchDocument.type}`);
        console.log(`🌍 Langue: ${frenchDocument.language}`);
        console.log(`👥 Parties: ${frenchDocument.parties.length}`);
        console.log(`📝 Clauses: ${frenchDocument.clauses.length}`);
        console.log(`⚖️  Score de conformité: ${frenchDocument.complianceReport.score}/100`);
        console.log(`⏱️  Temps de traitement: ${frenchDocument.metadata.processingTime}ms`);
        console.log(`🤖 Modèle IA: ${frenchDocument.metadata.aiModel}\n`);

        // Show first few lines of content
        const contentPreview = frenchDocument.content.split('\n').slice(0, 5).join('\n');
        console.log('📄 Aperçu du contenu:');
        console.log('─'.repeat(50));
        console.log(contentPreview);
        console.log('─'.repeat(50));
        console.log('[...contenu tronqué...]\n');

    } catch (error) {
        console.error('❌ Erreur lors de la génération:', error.message);
    }

    // Example 2: Malagasy Lease Contract
    console.log('📄 Exemple 2: Génération d\'un contrat de bail en malgache');
    const malagasyLeaseRequest = {
        type: DocumentType.LEASE,
        language: Language.MALAGASY,
        description: 'Contrat de location d\'un appartement 2 chambres à Antananarivo, loyer mensuel 500000 Ar, durée 12 mois.',
        parties: [
            {
                name: 'Andry Rasolofo',
                email: 'andry.rasolofo@email.mg',
                role: 'landlord',
                address: 'Lot 789 Antananarivo, Madagascar'
            },
            {
                name: 'Hery Randria',
                email: 'hery.randria@email.mg',
                role: 'tenant',
                address: 'Lot 321 Toamasina, Madagascar'
            }
        ],
        jurisdiction: 'Antananarivo, Madagascar',
        specificClauses: [
            'Dépôt de garantie équivalent à 2 mois de loyer',
            'Charges incluses dans le loyer',
            'Préavis de 1 mois pour résiliation'
        ]
    };

    try {
        console.log('⏳ Génération en cours...');
        const malagasyDocument = await documentGenerator.generateContract(malagasyLeaseRequest);

        console.log('✅ Document généré avec succès!');
        console.log(`📋 Titre: ${malagasyDocument.title}`);
        console.log(`🏷️  Type: ${malagasyDocument.type}`);
        console.log(`🌍 Langue: ${malagasyDocument.language}`);
        console.log(`⚖️  Score de conformité: ${malagasyDocument.complianceReport.score}/100\n`);

    } catch (error) {
        console.error('❌ Erreur lors de la génération:', error.message);
    }

    // Example 3: Translation Demo
    console.log('📄 Exemple 3: Démonstration de traduction');
    try {
        const mockDocument = {
            id: 'demo-doc',
            content: `CONTRAT DE VENTE

Article 1 - Objet du contrat
Le présent contrat a pour objet la vente d'un véhicule automobile.

Article 2 - Prix de vente
Le prix de vente est fixé à la somme de 15.000.000 Ariary.

Article 3 - Modalités de paiement
Le paiement s'effectue comptant à la signature du présent contrat.`,
            language: Language.FRENCH,
            type: DocumentType.SALE_AGREEMENT,
            metadata: {
                jurisdiction: 'Madagascar'
            }
        };

        console.log('⏳ Traduction du français vers le malgache...');
        const translatedDocument = await documentGenerator.translateDocument(mockDocument, Language.MALAGASY);

        console.log('✅ Traduction terminée!');
        console.log(`🌍 Langue source: ${mockDocument.language}`);
        console.log(`🌍 Langue cible: ${translatedDocument.language}`);
        console.log(`📅 Traduit le: ${translatedDocument.metadata.translatedAt}\n`);

    } catch (error) {
        console.error('❌ Erreur lors de la traduction:', error.message);
    }

    // Example 4: Compliance Validation
    console.log('📄 Exemple 4: Validation de conformité');
    const testDocument = {
        id: 'compliance-test',
        type: DocumentType.CONTRACT,
        content: 'Contrat simple avec objet défini, prix mentionné, obligations des parties et résiliation prévue.',
        parties: [
            { name: 'Partie A', email: 'a@example.com' },
            { name: 'Partie B', email: 'b@example.com' }
        ],
        metadata: {
            jurisdiction: 'Madagascar'
        }
    };

    try {
        console.log('⏳ Validation en cours...');
        const complianceReport = await documentGenerator.validateCompliance(testDocument);

        console.log('✅ Validation terminée!');
        console.log(`⚖️  Conforme: ${complianceReport.isCompliant ? 'Oui' : 'Non'}`);
        console.log(`📊 Score: ${complianceReport.score}/100`);
        console.log(`⚠️  Problèmes détectés: ${complianceReport.issues.length}`);

        if (complianceReport.issues.length > 0) {
            console.log('\n🔍 Détails des problèmes:');
            complianceReport.issues.forEach((issue, index) => {
                console.log(`  ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`);
                if (issue.suggestion) {
                    console.log(`     💡 Suggestion: ${issue.suggestion}`);
                }
            });
        }

    } catch (error) {
        console.error('❌ Erreur lors de la validation:', error.message);
    }

    console.log('\n🎉 Démonstration terminée!');
    console.log('💡 Pour utiliser le générateur dans votre application:');
    console.log('   1. Configurez les variables d\'environnement (OLLAMA_URL, GEMINI_API_KEY)');
    console.log('   2. Assurez-vous qu\'Ollama est en cours d\'exécution localement');
    console.log('   3. Utilisez l\'API POST /api/documents/generate');
}

// Run the demo if this file is executed directly
if (require.main === module) {
    demonstrateDocumentGeneration().catch(console.error);
}

module.exports = { demonstrateDocumentGeneration };