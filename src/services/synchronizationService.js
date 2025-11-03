/**
 * Synchronization Service
 * Handles automatic synchronization between local storage and remote database
 * Manages sync queue and conflict resolution
 */

const OfflineStorageService = require('./offlineStorageService');
const { v4: uuidv4 } = require('uuid');

// Mock supabase for now to avoid TypeScript import issues in tests
let supabase;
try {
    supabase = require('../database/index').default;
} catch (error) {
    // Fallback for testing environment
    supabase = {
        from: () => ({
            select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
            insert: () => Promise.resolve({ error: null }),
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
            delete: () => ({ eq: () => Promise.resolve({ error: null }) })
        })
    };
}

class SynchronizationService {
    constructor() {
        this.offlineStorage = new OfflineStorageService();
        this.syncInProgress = false;
        this.syncInterval = null;
        this.syncIntervalMs = 30000; // 30 seconds
        this.maxRetries = 3;
        this.retryDelay = 5000; // 5 seconds

        // Event listeners for online/offline status
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => this.handleOnlineStatus(true));
            window.addEventListener('offline', () => this.handleOnlineStatus(false));
        }

        this.isOnline = typeof navigator !== 'undefined' && navigator.onLine !== undefined ? navigator.onLine : true;

        // Start automatic sync if online and not in test environment
        if (this.isOnline && process.env.NODE_ENV !== 'test') {
            this.startAutoSync();
        }
    }

    /**
     * Handle online/offline status changes
     * @param {boolean} online - Online status
     */
    handleOnlineStatus(online) {
        this.isOnline = online;

        if (online) {
            console.log('Connection restored, starting synchronization...');
            this.startAutoSync();
            this.syncAll();
        } else {
            console.log('Connection lost, stopping automatic sync');
            this.stopAutoSync();
        }
    }

    /**
     * Start automatic synchronization
     */
    startAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(() => {
            if (this.isOnline && !this.syncInProgress) {
                this.syncAll();
            }
        }, this.syncIntervalMs);
    }

    /**
     * Stop automatic synchronization
     */
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    /**
     * Perform complete synchronization
     * @returns {Promise<Object>} Sync results
     */
    async syncAll() {
        if (this.syncInProgress || !this.isOnline) {
            return { success: false, reason: 'Sync already in progress or offline' };
        }

        this.syncInProgress = true;
        const startTime = Date.now();

        try {
            console.log('Starting full synchronization...');

            const results = {
                documentsUploaded: 0,
                documentsDownloaded: 0,
                actionsProcessed: 0,
                conflicts: 0,
                errors: [],
                duration: 0
            };

            // Step 1: Process offline actions queue
            await this.processOfflineActions(results);

            // Step 2: Upload local documents that need syncing
            await this.uploadLocalDocuments(results);

            // Step 3: Download remote changes
            await this.downloadRemoteChanges(results);

            // Step 4: Resolve conflicts
            await this.resolveConflicts(results);

            results.duration = Date.now() - startTime;
            console.log('Synchronization completed:', results);

            return { success: true, results };

        } catch (error) {
            console.error('Synchronization failed:', error);
            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime
            };
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Process offline actions queue
     * @param {Object} results - Results object to update
     */
    async processOfflineActions(results) {
        try {
            const unsyncedActions = await this.offlineStorage.getUnsyncedActions();

            for (const action of unsyncedActions) {
                try {
                    await this.processAction(action);
                    await this.offlineStorage.markActionSynced(action.id);
                    results.actionsProcessed++;
                } catch (error) {
                    console.error(`Failed to process action ${action.id}:`, error);
                    results.errors.push({
                        type: 'action_processing',
                        actionId: action.id,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            console.error('Error processing offline actions:', error);
            results.errors.push({
                type: 'offline_actions',
                error: error.message
            });
        }
    }

    /**
     * Process individual offline action
     * @param {Object} action - Action to process
     */
    async processAction(action) {
        switch (action.type) {
            case 'create_document':
                await this.createRemoteDocument(action.data);
                break;
            case 'update_document':
                await this.updateRemoteDocument(action.documentId, action.data);
                break;
            case 'delete_document':
                await this.deleteRemoteDocument(action.documentId);
                break;
            case 'sign_document':
                await this.processRemoteSignature(action.documentId, action.data);
                break;
            default:
                console.warn(`Unknown action type: ${action.type}`);
        }
    }

    /**
     * Upload local documents that need syncing
     * @param {Object} results - Results object to update
     */
    async uploadLocalDocuments(results) {
        try {
            const localDocuments = await this.offlineStorage.getAllDocuments({
                syncStatus: 'pending'
            });

            for (const document of localDocuments) {
                try {
                    if (document.isOffline) {
                        // Check if document exists remotely
                        const { data: remoteDoc } = await supabase
                            .from('legal_documents')
                            .select('*')
                            .eq('id', document.id)
                            .single();

                        if (remoteDoc) {
                            // Document exists, check for conflicts
                            if (new Date(remoteDoc.updated_at) > new Date(document.updatedAt)) {
                                // Remote is newer, mark as conflict
                                await this.markConflict(document, remoteDoc);
                                results.conflicts++;
                                continue;
                            }
                            // Local is newer or same, update remote
                            await this.updateRemoteDocument(document.id, document);
                        } else {
                            // Document doesn't exist remotely, create it
                            await this.createRemoteDocument(document);
                        }

                        // Mark as synced
                        await this.offlineStorage.updateDocument(document.id, {
                            syncStatus: 'synced',
                            isOffline: false
                        });

                        results.documentsUploaded++;
                    }
                } catch (error) {
                    console.error(`Failed to upload document ${document.id}:`, error);
                    results.errors.push({
                        type: 'document_upload',
                        documentId: document.id,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            console.error('Error uploading local documents:', error);
            results.errors.push({
                type: 'upload_documents',
                error: error.message
            });
        }
    }

    /**
     * Download remote changes
     * @param {Object} results - Results object to update
     */
    async downloadRemoteChanges(results) {
        try {
            // Get last sync timestamp
            const lastSync = await this.getLastSyncTimestamp();

            // Fetch documents updated since last sync
            const { data: remoteDocuments, error } = await supabase
                .from('legal_documents')
                .select(`
                    *,
                    parties(*),
                    clauses(*),
                    digital_signatures(*),
                    risk_assessments(*)
                `)
                .gt('updated_at', lastSync)
                .order('updated_at', { ascending: true });

            if (error) throw error;

            for (const remoteDoc of remoteDocuments || []) {
                try {
                    const localDoc = await this.offlineStorage.getDocument(remoteDoc.id);

                    if (localDoc) {
                        // Check for conflicts
                        if (localDoc.syncStatus === 'pending' &&
                            new Date(localDoc.lastModified) > new Date(remoteDoc.updated_at)) {
                            // Local changes are newer, mark as conflict
                            await this.markConflict(localDoc, remoteDoc);
                            results.conflicts++;
                            continue;
                        }
                    }

                    // Store/update local copy
                    const formattedDoc = this.formatRemoteDocument(remoteDoc);
                    await this.offlineStorage.storeDocument(formattedDoc);
                    results.documentsDownloaded++;

                } catch (error) {
                    console.error(`Failed to download document ${remoteDoc.id}:`, error);
                    results.errors.push({
                        type: 'document_download',
                        documentId: remoteDoc.id,
                        error: error.message
                    });
                }
            }

            // Update last sync timestamp
            await this.updateLastSyncTimestamp();

        } catch (error) {
            console.error('Error downloading remote changes:', error);
            results.errors.push({
                type: 'download_changes',
                error: error.message
            });
        }
    }

    /**
     * Resolve synchronization conflicts
     * @param {Object} results - Results object to update
     */
    async resolveConflicts(results) {
        try {
            const conflicts = await this.offlineStorage.getAllDocuments({
                syncStatus: 'conflict'
            });

            for (const conflict of conflicts) {
                // For now, implement a simple "remote wins" strategy
                // In a production system, you'd want user intervention
                try {
                    const { data: remoteDoc } = await supabase
                        .from('legal_documents')
                        .select('*')
                        .eq('id', conflict.id)
                        .single();

                    if (remoteDoc) {
                        const formattedDoc = this.formatRemoteDocument(remoteDoc);
                        formattedDoc.syncStatus = 'synced';
                        formattedDoc.isOffline = false;

                        await this.offlineStorage.storeDocument(formattedDoc);
                        console.log(`Conflict resolved for document ${conflict.id} (remote version kept)`);
                    }
                } catch (error) {
                    console.error(`Failed to resolve conflict for document ${conflict.id}:`, error);
                    results.errors.push({
                        type: 'conflict_resolution',
                        documentId: conflict.id,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            console.error('Error resolving conflicts:', error);
            results.errors.push({
                type: 'resolve_conflicts',
                error: error.message
            });
        }
    }

    /**
     * Create document in remote database
     * @param {Object} document - Document to create
     */
    async createRemoteDocument(document) {
        // Prepare document for remote storage
        const remoteDoc = {
            id: document.id,
            type: document.type,
            title: document.title,
            content: document.content,
            language: document.language,
            status: document.status,
            metadata: document.metadata,
            created_by: document.createdBy,
            created_at: document.createdAt,
            updated_at: document.updatedAt
        };

        const { error: docError } = await supabase
            .from('legal_documents')
            .insert(remoteDoc);

        if (docError) throw docError;

        // Insert related data
        if (document.parties && document.parties.length > 0) {
            const parties = document.parties.map(party => ({
                ...party,
                document_id: document.id
            }));

            const { error: partiesError } = await supabase
                .from('parties')
                .insert(parties);

            if (partiesError) console.error('Error inserting parties:', partiesError);
        }

        if (document.clauses && document.clauses.length > 0) {
            const clauses = document.clauses.map(clause => ({
                id: clause.id,
                document_id: document.id,
                title: clause.title,
                content: clause.content,
                position: clause.position,
                is_required: clause.isRequired,
                category: clause.category
            }));

            const { error: clausesError } = await supabase
                .from('clauses')
                .insert(clauses);

            if (clausesError) console.error('Error inserting clauses:', clausesError);
        }
    }

    /**
     * Update document in remote database
     * @param {string} documentId - Document ID
     * @param {Object} document - Document data
     */
    async updateRemoteDocument(documentId, document) {
        const remoteDoc = {
            type: document.type,
            title: document.title,
            content: document.content,
            language: document.language,
            status: document.status,
            metadata: document.metadata,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('legal_documents')
            .update(remoteDoc)
            .eq('id', documentId);

        if (error) throw error;
    }

    /**
     * Delete document from remote database
     * @param {string} documentId - Document ID
     */
    async deleteRemoteDocument(documentId) {
        const { error } = await supabase
            .from('legal_documents')
            .delete()
            .eq('id', documentId);

        if (error) throw error;
    }

    /**
     * Process remote signature
     * @param {string} documentId - Document ID
     * @param {Object} signatureData - Signature data
     */
    async processRemoteSignature(documentId, signatureData) {
        const { error } = await supabase
            .from('digital_signatures')
            .insert({
                ...signatureData,
                document_id: documentId
            });

        if (error) throw error;
    }

    /**
     * Mark document as having a conflict
     * @param {Object} localDoc - Local document
     * @param {Object} remoteDoc - Remote document
     */
    async markConflict(localDoc, remoteDoc) {
        const conflictData = {
            ...localDoc,
            syncStatus: 'conflict',
            conflictInfo: {
                localVersion: {
                    lastModified: localDoc.lastModified,
                    content: localDoc.content
                },
                remoteVersion: {
                    updated_at: remoteDoc.updated_at,
                    content: remoteDoc.content
                },
                detectedAt: new Date().toISOString()
            }
        };

        await this.offlineStorage.storeDocument(conflictData);
    }

    /**
     * Format remote document for local storage
     * @param {Object} remoteDoc - Remote document
     * @returns {Object} Formatted document
     */
    formatRemoteDocument(remoteDoc) {
        return {
            id: remoteDoc.id,
            type: remoteDoc.type,
            title: remoteDoc.title,
            content: remoteDoc.content,
            language: remoteDoc.language,
            status: remoteDoc.status,
            parties: remoteDoc.parties || [],
            clauses: remoteDoc.clauses || [],
            signatures: remoteDoc.digital_signatures || [],
            riskAssessments: remoteDoc.risk_assessments || [],
            metadata: remoteDoc.metadata || {},
            createdBy: remoteDoc.created_by,
            createdAt: remoteDoc.created_at,
            updatedAt: remoteDoc.updated_at,
            signedAt: remoteDoc.signed_at,
            archivedAt: remoteDoc.archived_at,
            syncStatus: 'synced',
            isOffline: false,
            lastModified: remoteDoc.updated_at
        };
    }

    /**
     * Get last synchronization timestamp
     * @returns {Promise<string>} Last sync timestamp
     */
    async getLastSyncTimestamp() {
        try {
            const syncData = await this.offlineStorage.getUserPreferences('sync_metadata');
            return syncData?.lastSyncTimestamp || '1970-01-01T00:00:00.000Z';
        } catch (error) {
            console.error('Error getting last sync timestamp:', error);
            return '1970-01-01T00:00:00.000Z';
        }
    }

    /**
     * Update last synchronization timestamp
     */
    async updateLastSyncTimestamp() {
        try {
            await this.offlineStorage.storeUserPreferences('sync_metadata', {
                lastSyncTimestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating last sync timestamp:', error);
        }
    }

    /**
     * Add action to sync queue
     * @param {string} type - Action type
     * @param {string} documentId - Document ID
     * @param {Object} data - Action data
     * @param {number} priority - Priority (1-5, 1 being highest)
     */
    async queueAction(type, documentId, data, priority = 3) {
        const action = {
            id: uuidv4(),
            type,
            documentId,
            data,
            priority,
            createdAt: new Date().toISOString(),
            retries: 0,
            synced: false
        };

        await this.offlineStorage.recordOfflineAction(action);

        // If online, try to sync immediately for high priority actions
        if (this.isOnline && priority <= 2 && !this.syncInProgress) {
            setTimeout(() => this.syncAll(), 1000);
        }
    }

    /**
     * Get synchronization status
     * @returns {Promise<Object>} Sync status
     */
    async getSyncStatus() {
        try {
            const unsyncedActions = await this.offlineStorage.getUnsyncedActions();
            const pendingDocuments = await this.offlineStorage.getAllDocuments({
                syncStatus: 'pending'
            });
            const conflictDocuments = await this.offlineStorage.getAllDocuments({
                syncStatus: 'conflict'
            });
            const lastSync = await this.getLastSyncTimestamp();

            return {
                isOnline: this.isOnline,
                syncInProgress: this.syncInProgress,
                lastSyncTimestamp: lastSync,
                pendingActions: unsyncedActions.length,
                pendingDocuments: pendingDocuments.length,
                conflicts: conflictDocuments.length,
                autoSyncEnabled: this.syncInterval !== null
            };
        } catch (error) {
            console.error('Error getting sync status:', error);
            return {
                error: error.message,
                isOnline: this.isOnline,
                syncInProgress: this.syncInProgress
            };
        }
    }

    /**
     * Force immediate synchronization
     * @returns {Promise<Object>} Sync results
     */
    async forcSync() {
        if (!this.isOnline) {
            return { success: false, reason: 'Device is offline' };
        }

        return await this.syncAll();
    }

    /**
     * Clean up old synced actions and resolved conflicts
     * @param {number} daysOld - Days old to clean up (default: 7)
     */
    async cleanup(daysOld = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            const cutoffTimestamp = cutoffDate.toISOString();

            // Clean up old synced actions
            const allActions = await this.offlineStorage.getUnsyncedActions();
            const oldSyncedActions = allActions.filter(action =>
                action.synced &&
                action.syncedAt &&
                action.syncedAt < cutoffTimestamp
            );

            for (const action of oldSyncedActions) {
                await this.offlineStorage.deleteFromIndexedDB('offlineActions', action.id);
            }

            console.log(`Cleaned up ${oldSyncedActions.length} old synced actions`);
            return { success: true, cleanedActions: oldSyncedActions.length };

        } catch (error) {
            console.error('Error during cleanup:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = SynchronizationService;