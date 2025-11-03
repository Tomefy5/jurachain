/**
 * Synchronization Queue Service
 * Manages queued actions for deferred synchronization when offline
 * Handles priority-based processing and retry mechanisms
 */

const { v4: uuidv4 } = require('uuid');
const OfflineStorageService = require('./offlineStorageService');

class SyncQueueService {
    constructor() {
        this.offlineStorage = new OfflineStorageService();
        this.processingQueue = false;
        this.maxRetries = 3;
        this.retryDelays = [1000, 5000, 15000]; // Progressive delays in ms
        this.priorities = {
            CRITICAL: 1,
            HIGH: 2,
            MEDIUM: 3,
            LOW: 4,
            BACKGROUND: 5
        };
    }

    /**
     * Add action to sync queue
     * @param {Object} actionData - Action data
     * @returns {Promise<string>} Action ID
     */
    async enqueueAction(actionData) {
        try {
            const action = {
                id: uuidv4(),
                type: actionData.type,
                documentId: actionData.documentId,
                data: actionData.data,
                priority: actionData.priority || this.priorities.MEDIUM,
                status: 'pending',
                retries: 0,
                maxRetries: actionData.maxRetries || this.maxRetries,
                createdAt: new Date().toISOString(),
                scheduledFor: actionData.scheduledFor || new Date().toISOString(),
                metadata: actionData.metadata || {}
            };

            // Store in IndexedDB sync queue
            if (this.offlineStorage.isIndexedDBSupported && this.offlineStorage.db) {
                await this.storeInSyncQueue(action);
            } else {
                // Fallback to localStorage
                await this.offlineStorage.storeInLocalStorage(`sync_queue_${action.id}`, action);
            }

            console.log(`Action ${action.id} queued for sync (priority: ${action.priority})`);
            return action.id;

        } catch (error) {
            console.error('Error enqueueing action:', error);
            throw new Error(`Failed to enqueue action: ${error.message}`);
        }
    }

    /**
     * Get all pending actions from queue
     * @param {Object} filters - Optional filters
     * @returns {Promise<Array>} Pending actions
     */
    async getPendingActions(filters = {}) {
        try {
            let actions = [];

            if (this.offlineStorage.isIndexedDBSupported && this.offlineStorage.db) {
                actions = await this.getAllFromSyncQueue();
            } else {
                actions = this.offlineStorage.getAllFromLocalStorage('sync_queue_');
            }

            // Filter pending actions
            let pendingActions = actions.filter(action =>
                action.status === 'pending' || action.status === 'retrying'
            );

            // Apply additional filters
            if (filters.type) {
                pendingActions = pendingActions.filter(action => action.type === filters.type);
            }
            if (filters.documentId) {
                pendingActions = pendingActions.filter(action => action.documentId === filters.documentId);
            }
            if (filters.priority) {
                pendingActions = pendingActions.filter(action => action.priority === filters.priority);
            }

            // Sort by priority and creation time
            pendingActions.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority; // Lower number = higher priority
                }
                return new Date(a.createdAt) - new Date(b.createdAt);
            });

            return pendingActions;

        } catch (error) {
            console.error('Error getting pending actions:', error);
            return [];
        }
    }

    /**
     * Process next action in queue
     * @param {Function} processor - Function to process actions
     * @returns {Promise<Object>} Processing result
     */
    async processNextAction(processor) {
        if (this.processingQueue) {
            return { success: false, reason: 'Queue processing already in progress' };
        }

        this.processingQueue = true;

        try {
            const pendingActions = await this.getPendingActions();

            if (pendingActions.length === 0) {
                return { success: true, processed: 0, reason: 'No pending actions' };
            }

            const action = pendingActions[0]; // Highest priority action

            // Check if action is scheduled for future
            if (new Date(action.scheduledFor) > new Date()) {
                return { success: true, processed: 0, reason: 'Next action scheduled for future' };
            }

            console.log(`Processing action ${action.id} (type: ${action.type}, priority: ${action.priority})`);

            try {
                // Process the action
                const result = await processor(action);

                if (result.success) {
                    // Mark as completed
                    await this.markActionCompleted(action.id, result.data);
                    return { success: true, processed: 1, actionId: action.id };
                } else {
                    // Handle failure
                    await this.handleActionFailure(action, result.error);
                    return { success: false, processed: 0, actionId: action.id, error: result.error };
                }

            } catch (processingError) {
                console.error(`Error processing action ${action.id}:`, processingError);
                await this.handleActionFailure(action, processingError.message);
                return { success: false, processed: 0, actionId: action.id, error: processingError.message };
            }

        } catch (error) {
            console.error('Error in queue processing:', error);
            return { success: false, error: error.message };
        } finally {
            this.processingQueue = false;
        }
    }

    /**
     * Process all pending actions
     * @param {Function} processor - Function to process actions
     * @param {number} maxActions - Maximum actions to process (default: 10)
     * @returns {Promise<Object>} Processing results
     */
    async processAllPending(processor, maxActions = 10) {
        const results = {
            processed: 0,
            succeeded: 0,
            failed: 0,
            errors: [],
            startTime: new Date()
        };

        try {
            let processedCount = 0;

            while (processedCount < maxActions) {
                const result = await this.processNextAction(processor);

                if (!result.success && result.reason === 'No pending actions') {
                    break; // No more actions to process
                }

                if (result.processed > 0) {
                    processedCount += result.processed;
                    results.processed += result.processed;

                    if (result.success) {
                        results.succeeded++;
                    } else {
                        results.failed++;
                        results.errors.push({
                            actionId: result.actionId,
                            error: result.error
                        });
                    }
                } else {
                    break; // No action was processed (might be scheduled for future)
                }

                // Small delay between actions
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            results.duration = new Date() - results.startTime;
            return results;

        } catch (error) {
            console.error('Error processing all pending actions:', error);
            results.errors.push({ error: error.message });
            return results;
        }
    }

    /**
     * Mark action as completed
     * @param {string} actionId - Action ID
     * @param {Object} resultData - Result data
     */
    async markActionCompleted(actionId, resultData = {}) {
        try {
            const action = await this.getActionById(actionId);
            if (!action) {
                console.warn(`Action ${actionId} not found for completion`);
                return;
            }

            action.status = 'completed';
            action.completedAt = new Date().toISOString();
            action.result = resultData;

            await this.updateAction(action);
            console.log(`Action ${actionId} marked as completed`);

        } catch (error) {
            console.error(`Error marking action ${actionId} as completed:`, error);
        }
    }

    /**
     * Handle action failure with retry logic
     * @param {Object} action - Failed action
     * @param {string} errorMessage - Error message
     */
    async handleActionFailure(action, errorMessage) {
        try {
            action.retries++;
            action.lastError = errorMessage;
            action.lastAttempt = new Date().toISOString();

            if (action.retries >= action.maxRetries) {
                // Max retries reached, mark as failed
                action.status = 'failed';
                action.failedAt = new Date().toISOString();
                console.error(`Action ${action.id} failed permanently after ${action.retries} retries`);
            } else {
                // Schedule for retry with exponential backoff
                action.status = 'retrying';
                const delay = this.retryDelays[Math.min(action.retries - 1, this.retryDelays.length - 1)];
                action.scheduledFor = new Date(Date.now() + delay).toISOString();
                console.log(`Action ${action.id} scheduled for retry ${action.retries} in ${delay}ms`);
            }

            await this.updateAction(action);

        } catch (error) {
            console.error(`Error handling failure for action ${action.id}:`, error);
        }
    }

    /**
     * Get action by ID
     * @param {string} actionId - Action ID
     * @returns {Promise<Object|null>} Action or null
     */
    async getActionById(actionId) {
        try {
            if (this.offlineStorage.isIndexedDBSupported && this.offlineStorage.db) {
                return await this.getFromSyncQueue(actionId);
            } else {
                return this.offlineStorage.getFromLocalStorage(`sync_queue_${actionId}`);
            }
        } catch (error) {
            console.error(`Error getting action ${actionId}:`, error);
            return null;
        }
    }

    /**
     * Update action in queue
     * @param {Object} action - Action to update
     */
    async updateAction(action) {
        try {
            if (this.offlineStorage.isIndexedDBSupported && this.offlineStorage.db) {
                await this.storeInSyncQueue(action);
            } else {
                await this.offlineStorage.storeInLocalStorage(`sync_queue_${action.id}`, action);
            }
        } catch (error) {
            console.error(`Error updating action ${action.id}:`, error);
        }
    }

    /**
     * Remove action from queue
     * @param {string} actionId - Action ID
     */
    async removeAction(actionId) {
        try {
            if (this.offlineStorage.isIndexedDBSupported && this.offlineStorage.db) {
                await this.deleteFromSyncQueue(actionId);
            } else {
                await this.offlineStorage.deleteFromLocalStorage(`sync_queue_${actionId}`);
            }
            console.log(`Action ${actionId} removed from queue`);
        } catch (error) {
            console.error(`Error removing action ${actionId}:`, error);
        }
    }

    /**
     * Clear completed and failed actions older than specified days
     * @param {number} daysOld - Days old to clean up (default: 7)
     */
    async cleanupOldActions(daysOld = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            const cutoffTimestamp = cutoffDate.toISOString();

            const allActions = await this.getAllActions();
            const oldActions = allActions.filter(action => {
                const isOld = (action.completedAt && action.completedAt < cutoffTimestamp) ||
                    (action.failedAt && action.failedAt < cutoffTimestamp);
                const isFinished = action.status === 'completed' || action.status === 'failed';
                return isOld && isFinished;
            });

            for (const action of oldActions) {
                await this.removeAction(action.id);
            }

            console.log(`Cleaned up ${oldActions.length} old actions from sync queue`);
            return { success: true, cleanedCount: oldActions.length };

        } catch (error) {
            console.error('Error cleaning up old actions:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all actions (for admin/debugging purposes)
     * @returns {Promise<Array>} All actions
     */
    async getAllActions() {
        try {
            if (this.offlineStorage.isIndexedDBSupported && this.offlineStorage.db) {
                return await this.getAllFromSyncQueue();
            } else {
                return this.offlineStorage.getAllFromLocalStorage('sync_queue_');
            }
        } catch (error) {
            console.error('Error getting all actions:', error);
            return [];
        }
    }

    /**
     * Get queue statistics
     * @returns {Promise<Object>} Queue statistics
     */
    async getQueueStats() {
        try {
            const allActions = await this.getAllActions();

            const stats = {
                total: allActions.length,
                pending: 0,
                retrying: 0,
                completed: 0,
                failed: 0,
                byPriority: {},
                byType: {},
                oldestPending: null,
                newestCompleted: null
            };

            // Initialize priority counters
            Object.values(this.priorities).forEach(priority => {
                stats.byPriority[priority] = 0;
            });

            let oldestPendingDate = null;
            let newestCompletedDate = null;

            for (const action of allActions) {
                // Count by status
                stats[action.status] = (stats[action.status] || 0) + 1;

                // Count by priority
                stats.byPriority[action.priority] = (stats.byPriority[action.priority] || 0) + 1;

                // Count by type
                stats.byType[action.type] = (stats.byType[action.type] || 0) + 1;

                // Track oldest pending
                if (action.status === 'pending' || action.status === 'retrying') {
                    const actionDate = new Date(action.createdAt);
                    if (!oldestPendingDate || actionDate < oldestPendingDate) {
                        oldestPendingDate = actionDate;
                        stats.oldestPending = action.createdAt;
                    }
                }

                // Track newest completed
                if (action.status === 'completed' && action.completedAt) {
                    const completedDate = new Date(action.completedAt);
                    if (!newestCompletedDate || completedDate > newestCompletedDate) {
                        newestCompletedDate = completedDate;
                        stats.newestCompleted = action.completedAt;
                    }
                }
            }

            return stats;

        } catch (error) {
            console.error('Error getting queue stats:', error);
            return { error: error.message };
        }
    }

    /**
     * Pause queue processing
     */
    pauseQueue() {
        this.queuePaused = true;
        console.log('Sync queue processing paused');
    }

    /**
     * Resume queue processing
     */
    resumeQueue() {
        this.queuePaused = false;
        console.log('Sync queue processing resumed');
    }

    /**
     * Check if queue is paused
     * @returns {boolean} Pause status
     */
    isQueuePaused() {
        return this.queuePaused || false;
    }

    // IndexedDB helper methods for sync queue
    async storeInSyncQueue(action) {
        return new Promise((resolve, reject) => {
            const transaction = this.offlineStorage.db.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');
            const request = store.put(action);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async getFromSyncQueue(actionId) {
        return new Promise((resolve, reject) => {
            const transaction = this.offlineStorage.db.transaction(['syncQueue'], 'readonly');
            const store = transaction.objectStore('syncQueue');
            const request = store.get(actionId);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllFromSyncQueue() {
        return new Promise((resolve, reject) => {
            const transaction = this.offlineStorage.db.transaction(['syncQueue'], 'readonly');
            const store = transaction.objectStore('syncQueue');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteFromSyncQueue(actionId) {
        return new Promise((resolve, reject) => {
            const transaction = this.offlineStorage.db.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');
            const request = store.delete(actionId);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
}

module.exports = SyncQueueService;