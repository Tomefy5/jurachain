/**
 * Offline Storage Service
 * Handles local storage of documents and data for offline functionality
 * Provides IndexedDB-based storage with fallback to localStorage
 */

const { v4: uuidv4 } = require('uuid');

class OfflineStorageService {
    constructor() {
        this.dbName = 'JusticeAutomationDB';
        this.dbVersion = 1;
        this.db = null;
        this.isIndexedDBSupported = typeof window !== 'undefined' && 'indexedDB' in window;
        this.storagePrefix = 'justice_automation_';

        // Initialize storage
        this.initializeStorage();
    }

    /**
     * Initialize IndexedDB or fallback to localStorage
     */
    async initializeStorage() {
        if (this.isIndexedDBSupported) {
            try {
                await this.initializeIndexedDB();
            } catch (error) {
                console.warn('IndexedDB initialization failed, falling back to localStorage:', error);
                this.isIndexedDBSupported = false;
            }
        }
    }

    /**
     * Initialize IndexedDB with required object stores
     */
    async initializeIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Documents store
                if (!db.objectStoreNames.contains('documents')) {
                    const documentsStore = db.createObjectStore('documents', { keyPath: 'id' });
                    documentsStore.createIndex('status', 'status', { unique: false });
                    documentsStore.createIndex('type', 'type', { unique: false });
                    documentsStore.createIndex('createdBy', 'createdBy', { unique: false });
                    documentsStore.createIndex('lastModified', 'lastModified', { unique: false });
                }

                // Sync queue store
                if (!db.objectStoreNames.contains('syncQueue')) {
                    const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
                    syncStore.createIndex('action', 'action', { unique: false });
                    syncStore.createIndex('priority', 'priority', { unique: false });
                    syncStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // User preferences store
                if (!db.objectStoreNames.contains('userPreferences')) {
                    db.createObjectStore('userPreferences', { keyPath: 'userId' });
                }

                // Templates store for offline generation
                if (!db.objectStoreNames.contains('templates')) {
                    const templatesStore = db.createObjectStore('templates', { keyPath: 'id' });
                    templatesStore.createIndex('type', 'type', { unique: false });
                    templatesStore.createIndex('language', 'language', { unique: false });
                }

                // Offline actions store
                if (!db.objectStoreNames.contains('offlineActions')) {
                    const actionsStore = db.createObjectStore('offlineActions', { keyPath: 'id' });
                    actionsStore.createIndex('documentId', 'documentId', { unique: false });
                    actionsStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    /**
     * Store document locally
     * @param {Object} document - Document to store
     * @returns {Promise<boolean>} Success status
     */
    async storeDocument(document) {
        try {
            const documentWithMetadata = {
                ...document,
                lastModified: new Date().toISOString(),
                isOffline: true,
                syncStatus: 'pending'
            };

            if (this.isIndexedDBSupported && this.db) {
                return await this.storeInIndexedDB('documents', documentWithMetadata);
            } else {
                return this.storeInLocalStorage(`document_${document.id}`, documentWithMetadata);
            }
        } catch (error) {
            console.error('Error storing document locally:', error);
            return false;
        }
    }

    /**
     * Retrieve document from local storage
     * @param {string} documentId - Document ID to retrieve
     * @returns {Promise<Object|null>} Document or null if not found
     */
    async getDocument(documentId) {
        try {
            if (this.isIndexedDBSupported && this.db) {
                return await this.getFromIndexedDB('documents', documentId);
            } else {
                return this.getFromLocalStorage(`document_${documentId}`);
            }
        } catch (error) {
            console.error('Error retrieving document from local storage:', error);
            return null;
        }
    }

    /**
     * Get all documents from local storage
     * @param {Object} filters - Optional filters (status, type, etc.)
     * @returns {Promise<Array>} Array of documents
     */
    async getAllDocuments(filters = {}) {
        try {
            if (this.isIndexedDBSupported && this.db) {
                return await this.getAllFromIndexedDB('documents', filters);
            } else {
                return this.getAllFromLocalStorage('document_', filters);
            }
        } catch (error) {
            console.error('Error retrieving all documents:', error);
            return [];
        }
    }

    /**
     * Update document in local storage
     * @param {string} documentId - Document ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<boolean>} Success status
     */
    async updateDocument(documentId, updates) {
        try {
            const existingDocument = await this.getDocument(documentId);
            if (!existingDocument) {
                return false;
            }

            const updatedDocument = {
                ...existingDocument,
                ...updates,
                lastModified: new Date().toISOString(),
                syncStatus: 'pending'
            };

            return await this.storeDocument(updatedDocument);
        } catch (error) {
            console.error('Error updating document:', error);
            return false;
        }
    }

    /**
     * Delete document from local storage
     * @param {string} documentId - Document ID to delete
     * @returns {Promise<boolean>} Success status
     */
    async deleteDocument(documentId) {
        try {
            if (this.isIndexedDBSupported && this.db) {
                return await this.deleteFromIndexedDB('documents', documentId);
            } else {
                return this.deleteFromLocalStorage(`document_${documentId}`);
            }
        } catch (error) {
            console.error('Error deleting document:', error);
            return false;
        }
    }

    /**
     * Store user preferences locally
     * @param {string} userId - User ID
     * @param {Object} preferences - User preferences
     * @returns {Promise<boolean>} Success status
     */
    async storeUserPreferences(userId, preferences) {
        try {
            const preferencesData = {
                userId,
                ...preferences,
                lastUpdated: new Date().toISOString()
            };

            if (this.isIndexedDBSupported && this.db) {
                return await this.storeInIndexedDB('userPreferences', preferencesData);
            } else {
                return this.storeInLocalStorage(`preferences_${userId}`, preferencesData);
            }
        } catch (error) {
            console.error('Error storing user preferences:', error);
            return false;
        }
    }

    /**
     * Get user preferences from local storage
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>} User preferences or null
     */
    async getUserPreferences(userId) {
        try {
            if (this.isIndexedDBSupported && this.db) {
                return await this.getFromIndexedDB('userPreferences', userId);
            } else {
                return this.getFromLocalStorage(`preferences_${userId}`);
            }
        } catch (error) {
            console.error('Error retrieving user preferences:', error);
            return null;
        }
    }

    /**
     * Store document template for offline generation
     * @param {Object} template - Document template
     * @returns {Promise<boolean>} Success status
     */
    async storeTemplate(template) {
        try {
            const templateWithMetadata = {
                ...template,
                storedAt: new Date().toISOString()
            };

            if (this.isIndexedDBSupported && this.db) {
                return await this.storeInIndexedDB('templates', templateWithMetadata);
            } else {
                return this.storeInLocalStorage(`template_${template.id}`, templateWithMetadata);
            }
        } catch (error) {
            console.error('Error storing template:', error);
            return false;
        }
    }

    /**
     * Get templates for offline generation
     * @param {string} type - Document type
     * @param {string} language - Document language
     * @returns {Promise<Array>} Array of matching templates
     */
    async getTemplates(type = null, language = null) {
        try {
            const filters = {};
            if (type) filters.type = type;
            if (language) filters.language = language;

            if (this.isIndexedDBSupported && this.db) {
                return await this.getAllFromIndexedDB('templates', filters);
            } else {
                return this.getAllFromLocalStorage('template_', filters);
            }
        } catch (error) {
            console.error('Error retrieving templates:', error);
            return [];
        }
    }

    /**
     * Record offline action for later synchronization
     * @param {Object} action - Action to record
     * @returns {Promise<boolean>} Success status
     */
    async recordOfflineAction(action) {
        try {
            const actionRecord = {
                id: uuidv4(),
                ...action,
                timestamp: new Date().toISOString(),
                synced: false
            };

            if (this.isIndexedDBSupported && this.db) {
                return await this.storeInIndexedDB('offlineActions', actionRecord);
            } else {
                return this.storeInLocalStorage(`action_${actionRecord.id}`, actionRecord);
            }
        } catch (error) {
            console.error('Error recording offline action:', error);
            return false;
        }
    }

    /**
     * Get all unsynced offline actions
     * @returns {Promise<Array>} Array of unsynced actions
     */
    async getUnsyncedActions() {
        try {
            if (this.isIndexedDBSupported && this.db) {
                return await this.getAllFromIndexedDB('offlineActions', { synced: false });
            } else {
                const actions = this.getAllFromLocalStorage('action_');
                return actions.filter(action => !action.synced);
            }
        } catch (error) {
            console.error('Error retrieving unsynced actions:', error);
            return [];
        }
    }

    /**
     * Mark offline action as synced
     * @param {string} actionId - Action ID
     * @returns {Promise<boolean>} Success status
     */
    async markActionSynced(actionId) {
        try {
            if (this.isIndexedDBSupported && this.db) {
                const action = await this.getFromIndexedDB('offlineActions', actionId);
                if (action) {
                    action.synced = true;
                    action.syncedAt = new Date().toISOString();
                    return await this.storeInIndexedDB('offlineActions', action);
                }
                return false;
            } else {
                const action = this.getFromLocalStorage(`action_${actionId}`);
                if (action) {
                    action.synced = true;
                    action.syncedAt = new Date().toISOString();
                    return this.storeInLocalStorage(`action_${actionId}`, action);
                }
                return false;
            }
        } catch (error) {
            console.error('Error marking action as synced:', error);
            return false;
        }
    }

    /**
     * Get storage usage statistics
     * @returns {Promise<Object>} Storage statistics
     */
    async getStorageStats() {
        try {
            const stats = {
                documentsCount: 0,
                templatesCount: 0,
                actionsCount: 0,
                totalSize: 0,
                lastUpdated: new Date().toISOString()
            };

            if (this.isIndexedDBSupported && this.db) {
                const documents = await this.getAllFromIndexedDB('documents');
                const templates = await this.getAllFromIndexedDB('templates');
                const actions = await this.getAllFromIndexedDB('offlineActions');

                stats.documentsCount = documents.length;
                stats.templatesCount = templates.length;
                stats.actionsCount = actions.length;
                stats.totalSize = this.calculateDataSize([...documents, ...templates, ...actions]);
            } else {
                // Calculate localStorage usage
                let totalSize = 0;
                for (let key in localStorage) {
                    if (key.startsWith(this.storagePrefix)) {
                        const value = localStorage.getItem(key);
                        totalSize += key.length + (value ? value.length : 0);

                        if (key.includes('document_')) stats.documentsCount++;
                        else if (key.includes('template_')) stats.templatesCount++;
                        else if (key.includes('action_')) stats.actionsCount++;
                    }
                }
                stats.totalSize = totalSize;
            }

            return stats;
        } catch (error) {
            console.error('Error getting storage stats:', error);
            return { error: error.message };
        }
    }

    /**
     * Clear all offline data
     * @returns {Promise<boolean>} Success status
     */
    async clearAllData() {
        try {
            if (this.isIndexedDBSupported && this.db) {
                const stores = ['documents', 'syncQueue', 'userPreferences', 'templates', 'offlineActions'];
                for (const storeName of stores) {
                    await this.clearIndexedDBStore(storeName);
                }
                return true;
            } else {
                // Clear localStorage
                const keysToRemove = [];
                for (let key in localStorage) {
                    if (key.startsWith(this.storagePrefix)) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));
                return true;
            }
        } catch (error) {
            console.error('Error clearing all data:', error);
            return false;
        }
    }

    // IndexedDB helper methods
    async storeInIndexedDB(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async getFromIndexedDB(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllFromIndexedDB(storeName, filters = {}) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                let results = request.result || [];

                // Apply filters
                if (Object.keys(filters).length > 0) {
                    results = results.filter(item => {
                        return Object.entries(filters).every(([key, value]) => {
                            return item[key] === value;
                        });
                    });
                }

                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteFromIndexedDB(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async clearIndexedDBStore(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // localStorage helper methods
    storeInLocalStorage(key, data) {
        try {
            localStorage.setItem(this.storagePrefix + key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('localStorage store error:', error);
            return false;
        }
    }

    getFromLocalStorage(key) {
        try {
            const data = localStorage.getItem(this.storagePrefix + key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('localStorage get error:', error);
            return null;
        }
    }

    getAllFromLocalStorage(keyPrefix, filters = {}) {
        try {
            const results = [];
            for (let key in localStorage) {
                if (key.startsWith(this.storagePrefix + keyPrefix)) {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data) {
                        // Apply filters
                        const matchesFilters = Object.entries(filters).every(([filterKey, filterValue]) => {
                            return data[filterKey] === filterValue;
                        });

                        if (Object.keys(filters).length === 0 || matchesFilters) {
                            results.push(data);
                        }
                    }
                }
            }
            return results;
        } catch (error) {
            console.error('localStorage getAll error:', error);
            return [];
        }
    }

    deleteFromLocalStorage(key) {
        try {
            localStorage.removeItem(this.storagePrefix + key);
            return true;
        } catch (error) {
            console.error('localStorage delete error:', error);
            return false;
        }
    }

    // Utility methods
    calculateDataSize(data) {
        try {
            return JSON.stringify(data).length;
        } catch (error) {
            return 0;
        }
    }
}

module.exports = OfflineStorageService;