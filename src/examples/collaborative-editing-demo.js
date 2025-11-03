/**
 * Démonstration du Système d'Édition Collaborative
 * 
 * Ce fichier montre comment utiliser le système d'édition collaborative
 * de JusticeAutomation avec Google Docs API et WebSocket.
 */

const CollaborativeService = require('../services/collaborativeService');
const WebSocketService = require('../services/websocketService');

// Configuration pour la démonstration
const DEMO_CONFIG = {
    users: [
        { id: 'user-1', email: 'avocat@example.com', name: 'Maître Dupont' },
        { id: 'user-2', email: 'client@example.com', name: 'Jean Rakoto' },
        { id: 'user-3', email: 'notaire@example.com', name: 'Notaire Martin' }
    ],
    document: {
        title: 'Contrat de Vente Immobilière - Antananarivo',
        content: `CONTRAT DE VENTE IMMOBILIÈRE

Article 1 - Parties contractantes
Vendeur: [À compléter]
Acheteur: [À compléter]

Article 2 - Objet de la vente
Bien immobilier situé à Antananarivo, Madagascar
Superficie: [À compléter]
Référence cadastrale: [À compléter]

Article 3 - Prix de vente
Prix convenu: [À compléter] Ariary
Modalités de paiement: [À compléter]

Article 4 - Conditions suspensives
- Obtention du financement bancaire
- Vérification des titres de propriété
- [Autres conditions à ajouter]

Article 5 - Date de signature définitive
Date prévue: [À compléter]

Fait à Antananarivo, le [Date]

Signatures:
Vendeur: ________________
Acheteur: ________________
Témoin: ________________`,
        type: 'contract'
    }
};

class CollaborativeEditingDemo {
    constructor() {
        this.collaborativeService = new CollaborativeService();
        this.activeUsers = new Map();
        this.documentId = null;
    }

    /**
     * Démonstration complète du système d'édition collaborative
     */
    async runDemo() {
        console.log('🚀 Démonstration du Système d\'Édition Collaborative JusticeAutomation\n');

        try {
            // Étape 1: Créer un document collaboratif
            await this.createCollaborativeDocument();

            // Étape 2: Simuler la connexion de plusieurs utilisateurs
            await this.simulateUserConnections();

            // Étape 3: Simuler l'édition collaborative
            await this.simulateCollaborativeEditing();

            // Étape 4: Démontrer la sauvegarde automatique
            await this.demonstrateAutoSave();

            // Étape 5: Démontrer les notifications
            await this.demonstrateNotifications();

            // Étape 6: Démontrer l'historique des révisions
            await this.demonstrateRevisionHistory();

            // Étape 7: Nettoyage
            await this.cleanup();

            console.log('✅ Démonstration terminée avec succès!');

        } catch (error) {
            console.error('❌ Erreur lors de la démonstration:', error.message);
        }
    }

    /**
     * Créer un document collaboratif
     */
    async createCollaborativeDocument() {
        console.log('📄 Création d\'un document collaboratif...');

        try {
            const result = await this.collaborativeService.createCollaborativeDocument(
                DEMO_CONFIG.document,
                DEMO_CONFIG.users[0].id
            );

            this.documentId = result.documentId;

            console.log(`✅ Document créé avec succès:`);
            console.log(`   - ID: ${result.documentId}`);
            console.log(`   - Google Doc ID: ${result.googleDocId}`);
            console.log(`   - URL d'édition: ${result.editUrl}`);
            console.log(`   - Session ID: ${result.sessionId}\n`);

        } catch (error) {
            console.log(`⚠️  Simulation de création (Google API non configurée): ${error.message}`);

            // Simulation pour la démonstration
            this.documentId = 'demo-doc-' + Date.now();
            const mockSession = {
                id: 'session-' + Date.now(),
                googleDocId: 'mock-google-doc-id',
                localDocumentId: this.documentId,
                title: DEMO_CONFIG.document.title,
                createdBy: DEMO_CONFIG.users[0].id,
                collaborators: new Set([DEMO_CONFIG.users[0].id]),
                createdAt: new Date(),
                lastActivity: new Date(),
                status: 'active'
            };

            this.collaborativeService.activeDocuments.set(this.documentId, mockSession);
            console.log(`✅ Document simulé créé avec ID: ${this.documentId}\n`);
        }
    }

    /**
     * Simuler la connexion de plusieurs utilisateurs
     */
    async simulateUserConnections() {
        console.log('👥 Simulation de connexions utilisateurs...');

        for (const user of DEMO_CONFIG.users) {
            try {
                const sessionInfo = await this.collaborativeService.joinCollaborativeSession(
                    this.documentId,
                    user.id,
                    `socket-${user.id}`
                );

                this.activeUsers.set(user.id, {
                    ...user,
                    sessionId: sessionInfo.sessionId,
                    joinedAt: new Date()
                });

                console.log(`✅ ${user.name} (${user.email}) a rejoint la session`);

            } catch (error) {
                // Simulation pour la démonstration
                const mockSessionId = `session-${user.id}-${Date.now()}`;
                this.collaborativeService.documentSessions.set(mockSessionId, {
                    documentId: this.documentId,
                    userId: user.id,
                    socketId: `socket-${user.id}`,
                    joinedAt: new Date()
                });

                this.activeUsers.set(user.id, {
                    ...user,
                    sessionId: mockSessionId,
                    joinedAt: new Date()
                });

                console.log(`✅ ${user.name} (${user.email}) a rejoint la session (simulé)`);
            }
        }

        const collaborators = this.collaborativeService.getActiveCollaborators(this.documentId);
        console.log(`📊 Collaborateurs actifs: ${collaborators.length}\n`);
    }

    /**
     * Simuler l'édition collaborative
     */
    async simulateCollaborativeEditing() {
        console.log('✏️  Simulation d\'édition collaborative...');

        const edits = [
            {
                user: DEMO_CONFIG.users[0],
                action: 'Remplir les informations du vendeur',
                content: 'Vendeur: Rakoto Jean, 123 Rue de la Paix, Antananarivo'
            },
            {
                user: DEMO_CONFIG.users[1],
                action: 'Ajouter les informations de l\'acheteur',
                content: 'Acheteur: Martin Pierre, 456 Avenue de l\'Indépendance, Antananarivo'
            },
            {
                user: DEMO_CONFIG.users[2],
                action: 'Préciser le prix de vente',
                content: 'Prix convenu: 150 000 000 Ariary (Cent cinquante millions d\'Ariary)'
            }
        ];

        for (const edit of edits) {
            console.log(`📝 ${edit.user.name}: ${edit.action}`);

            // Simuler la notification aux autres collaborateurs
            const notification = {
                message: `${edit.user.name} a modifié le document: ${edit.action}`,
                type: 'info',
                timestamp: new Date()
            };

            const notifiedUsers = this.collaborativeService.notifyCollaborators(
                this.documentId,
                notification,
                edit.user.id
            );

            console.log(`   📢 ${notifiedUsers.length} collaborateurs notifiés`);

            // Simuler un délai entre les modifications
            await this.sleep(1000);
        }

        console.log('');
    }

    /**
     * Démontrer la sauvegarde automatique
     */
    async demonstrateAutoSave() {
        console.log('💾 Démonstration de la sauvegarde automatique...');

        const updatedContent = DEMO_CONFIG.document.content.replace(
            'Vendeur: [À compléter]',
            'Vendeur: Rakoto Jean, 123 Rue de la Paix, Antananarivo'
        );

        try {
            const result = await this.collaborativeService.updateDocumentContent(
                this.documentId,
                updatedContent,
                DEMO_CONFIG.users[0].id
            );

            console.log(`✅ Sauvegarde automatique effectuée à ${result.timestamp}`);
            console.log(`   📄 Document mis à jour par ${DEMO_CONFIG.users[0].name}`);

        } catch (error) {
            console.log(`⚠️  Simulation de sauvegarde (Google API non configurée)`);
            console.log(`✅ Sauvegarde automatique simulée à ${new Date()}`);
        }

        console.log('');
    }

    /**
     * Démontrer le système de notifications
     */
    async demonstrateNotifications() {
        console.log('🔔 Démonstration du système de notifications...');

        const notifications = [
            {
                message: 'Le document est prêt pour révision finale',
                type: 'success',
                from: DEMO_CONFIG.users[0].email
            },
            {
                message: 'Attention: vérifier les références cadastrales',
                type: 'warning',
                from: DEMO_CONFIG.users[2].email
            },
            {
                message: 'Rendez-vous prévu demain pour signature',
                type: 'info',
                from: DEMO_CONFIG.users[1].email
            }
        ];

        for (const notification of notifications) {
            const notifiedUsers = this.collaborativeService.notifyCollaborators(
                this.documentId,
                notification
            );

            console.log(`📢 Notification envoyée: "${notification.message}"`);
            console.log(`   👥 ${notifiedUsers.length} collaborateurs notifiés`);
            console.log(`   📧 De: ${notification.from}`);
            console.log(`   🏷️  Type: ${notification.type}\n`);

            await this.sleep(500);
        }
    }

    /**
     * Démontrer l'historique des révisions
     */
    async demonstrateRevisionHistory() {
        console.log('📚 Démonstration de l\'historique des révisions...');

        try {
            const history = await this.collaborativeService.getDocumentHistory(this.documentId);

            console.log(`✅ Historique récupéré: ${history.length} révisions`);
            history.forEach((revision, index) => {
                console.log(`   ${index + 1}. ${revision.modifiedTime} - ${revision.lastModifyingUser?.displayName || 'Utilisateur'}`);
            });

        } catch (error) {
            console.log(`⚠️  Simulation d'historique (Google API non configurée)`);

            // Simuler un historique
            const mockHistory = [
                { id: '1', modifiedTime: new Date(Date.now() - 3600000).toISOString(), lastModifyingUser: { displayName: 'Maître Dupont' } },
                { id: '2', modifiedTime: new Date(Date.now() - 1800000).toISOString(), lastModifyingUser: { displayName: 'Jean Rakoto' } },
                { id: '3', modifiedTime: new Date().toISOString(), lastModifyingUser: { displayName: 'Notaire Martin' } }
            ];

            console.log(`✅ Historique simulé: ${mockHistory.length} révisions`);
            mockHistory.forEach((revision, index) => {
                console.log(`   ${index + 1}. ${revision.modifiedTime} - ${revision.lastModifyingUser.displayName}`);
            });
        }

        console.log('');
    }

    /**
     * Nettoyage des sessions
     */
    async cleanup() {
        console.log('🧹 Nettoyage des sessions...');

        // Déconnecter tous les utilisateurs
        for (const [userId, userInfo] of this.activeUsers.entries()) {
            try {
                await this.collaborativeService.leaveCollaborativeSession(
                    userInfo.sessionId,
                    userId
                );
                console.log(`👋 ${userInfo.name} a quitté la session`);
            } catch (error) {
                console.log(`👋 ${userInfo.name} a quitté la session (simulé)`);
            }
        }

        // Nettoyer les sessions inactives
        this.collaborativeService.cleanupInactiveSessions(0);
        console.log('✅ Sessions inactives nettoyées\n');
    }

    /**
     * Utilitaire pour simuler des délais
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Afficher les statistiques du système
     */
    displayStats() {
        console.log('📊 Statistiques du système:');
        console.log(`   - Documents actifs: ${this.collaborativeService.activeDocuments.size}`);
        console.log(`   - Sessions utilisateur: ${this.collaborativeService.documentSessions.size}`);
        console.log(`   - Utilisateurs connectés: ${this.activeUsers.size}`);
    }
}

// Exécuter la démonstration si le fichier est appelé directement
if (require.main === module) {
    const demo = new CollaborativeEditingDemo();

    console.log('🎯 Démarrage de la démonstration...\n');

    demo.runDemo()
        .then(() => {
            demo.displayStats();
            console.log('\n🎉 Démonstration terminée!');
            console.log('\n📖 Fonctionnalités démontrées:');
            console.log('   ✅ Création de documents collaboratifs');
            console.log('   ✅ Gestion des sessions multi-utilisateur');
            console.log('   ✅ Édition collaborative en temps réel');
            console.log('   ✅ Sauvegarde automatique avec horodatage');
            console.log('   ✅ Système de notifications');
            console.log('   ✅ Historique des révisions');
            console.log('   ✅ Nettoyage automatique des sessions');

            console.log('\n🔧 Pour utiliser avec Google Docs:');
            console.log('   1. Configurer GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET');
            console.log('   2. Obtenir les tokens d\'accès OAuth2');
            console.log('   3. Redémarrer le service');

            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Erreur lors de la démonstration:', error);
            process.exit(1);
        });
}

module.exports = CollaborativeEditingDemo;