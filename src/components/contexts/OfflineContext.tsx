import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface OfflineContextType {
    isOnline: boolean;
    offlineCapabilities: string[];
    syncQueue: any[];
    syncOfflineData: () => Promise<void>;
    addToSyncQueue: (action: any) => void;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const useOffline = () => {
    const context = useContext(OfflineContext);
    if (context === undefined) {
        throw new Error('useOffline must be used within an OfflineProvider');
    }
    return context;
};

interface OfflineProviderProps {
    children: ReactNode;
}

export const OfflineProvider: React.FC<OfflineProviderProps> = ({ children }) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [offlineCapabilities, setOfflineCapabilities] = useState<string[]>([]);
    const [syncQueue, setSyncQueue] = useState<any[]>([]);

    useEffect(() => {
        // Listen for online/offline events
        const handleOnline = () => {
            setIsOnline(true);
            syncOfflineData();
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Load offline capabilities
        loadOfflineCapabilities();

        // Load sync queue from localStorage
        loadSyncQueue();

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const loadOfflineCapabilities = async () => {
        try {
            const response = await fetch('/api/offline/capabilities');
            if (response.ok) {
                const data = await response.json();
                setOfflineCapabilities(data.capabilities || []);
            }
        } catch (error) {
            console.error('Failed to load offline capabilities:', error);
            // Set default offline capabilities
            setOfflineCapabilities([
                'document_generation_basic',
                'local_storage',
                'offline_editing'
            ]);
        }
    };

    const loadSyncQueue = () => {
        try {
            const stored = localStorage.getItem('syncQueue');
            if (stored) {
                setSyncQueue(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Failed to load sync queue:', error);
        }
    };

    const saveSyncQueue = (queue: any[]) => {
        try {
            localStorage.setItem('syncQueue', JSON.stringify(queue));
        } catch (error) {
            console.error('Failed to save sync queue:', error);
        }
    };

    const addToSyncQueue = (action: any) => {
        const newQueue = [...syncQueue, {
            ...action,
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            synced: false
        }];
        setSyncQueue(newQueue);
        saveSyncQueue(newQueue);
    };

    const syncOfflineData = async () => {
        if (!isOnline || syncQueue.length === 0) {
            return;
        }

        console.log('Syncing offline data...');

        const unsyncedActions = syncQueue.filter(action => !action.synced);

        for (const action of unsyncedActions) {
            try {
                const response = await fetch('/api/offline/sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    },
                    body: JSON.stringify(action)
                });

                if (response.ok) {
                    // Mark action as synced
                    const updatedQueue = syncQueue.map(item =>
                        item.id === action.id ? { ...item, synced: true } : item
                    );
                    setSyncQueue(updatedQueue);
                    saveSyncQueue(updatedQueue);
                }
            } catch (error) {
                console.error('Failed to sync action:', action.id, error);
            }
        }

        // Clean up synced actions older than 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const cleanedQueue = syncQueue.filter(action =>
            !action.synced || new Date(action.timestamp) > oneDayAgo
        );

        if (cleanedQueue.length !== syncQueue.length) {
            setSyncQueue(cleanedQueue);
            saveSyncQueue(cleanedQueue);
        }
    };

    const value: OfflineContextType = {
        isOnline,
        offlineCapabilities,
        syncQueue,
        syncOfflineData,
        addToSyncQueue
    };

    return (
        <OfflineContext.Provider value={value}>
            {children}
        </OfflineContext.Provider>
    );
};