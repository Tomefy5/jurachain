import React, { useState, useEffect } from 'react';
import { useOffline } from '../contexts/OfflineContext';

interface OfflineDocument {
    id: string;
    title: string;
    content: string;
    type: string;
    status: 'draft' | 'pending_sync' | 'synced';
    createdAt: string;
    lastModified: string;
}

interface StorageStats {
    used: number;
    available: number;
    documents: number;
    syncQueue: number;
}

const OfflineMode: React.FC = () => {
    const { isOnline, syncQueue, syncOfflineData, addToSyncQueue } = useOffline();
    const [offlineDocuments, setOfflineDocuments] = useState<OfflineDocument[]>([]);
    const [storageStats, setStorageStats] = useState<StorageStats>({
        used: 0,
        available: 0,
        documents: 0,
        syncQueue: 0
    });
    const [selectedDocument, setSelectedDocument] = useState<OfflineDocument | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [newDocumentTitle, setNewDocumentTitle] = useState('');
    const [showNewDocument, setShowNewDocument] = useState(false);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        loadOfflineDocuments();
        loadStorageStats();
    }, []);

    const loadOfflineDocuments = () => {
        try {
            const stored = localStorage.getItem('offlineDocuments');
            if (stored) {
                const documents = JSON.parse(stored);
                setOfflineDocuments(documents);
            } else {
                // Load mock offline documents
                const mockDocuments: OfflineDocument[] = [
                    {
                        id: 'offline-1',
                        title: 'Contrat de Service - Brouillon',
                        content: `CONTRAT DE SERVICE

Article 1 - Objet
Le présent contrat a pour objet la prestation de services de consultation.

Article 2 - Durée
La durée du contrat est fixée à 6 mois.

Article 3 - Rémunération
La rémunération est fixée à 2 000 000 Ariary par mois.`,
                        type: 'service',
                        status: 'draft',
                        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                        lastModified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
                    },
                    {
                        id: 'offline-2',
                        title: 'Bail Résidentiel - En attente de sync',
                        content: `CONTRAT DE BAIL RÉSIDENTIEL

Entre les soussignés :
- Propriétaire : [À compléter]
- Locataire : [À compléter]

Article 1 - Objet
Location d'un appartement de 3 pièces situé à Antananarivo.

Article 2 - Loyer
Le loyer mensuel est fixé à 800 000 Ariary.`,
                        type: 'lease',
                        status: 'pending_sync',
                        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                        lastModified: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
                    }
                ];
                setOfflineDocuments(mockDocuments);
                localStorage.setItem('offlineDocuments', JSON.stringify(mockDocuments));
            }
        } catch (error) {
            console.error('Failed to load offline documents:', error);
        }
    };

    const loadStorageStats = () => {
        try {
            // Calculate storage usage
            let totalSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length;
                }
            }

            const stats: StorageStats = {
                used: Math.round(totalSize / 1024), // KB
                available: 5000, // Approximate localStorage limit in KB
                documents: offlineDocuments.length,
                syncQueue: syncQueue.length
            };

            setStorageStats(stats);
        } catch (error) {
            console.error('Failed to load storage stats:', error);
        }
    };

    const saveOfflineDocuments = (documents: OfflineDocument[]) => {
        try {
            localStorage.setItem('offlineDocuments', JSON.stringify(documents));
            setOfflineDocuments(documents);
            loadStorageStats();
        } catch (error) {
            console.error('Failed to save offline documents:', error);
            alert('Erreur lors de la sauvegarde locale');
        }
    };

    const createNewDocument = () => {
        if (!newDocumentTitle.trim()) {
            alert('Veuillez saisir un titre pour le document');
            return;
        }

        const newDocument: OfflineDocument = {
            id: `offline-${Date.now()}`,
            title: newDocumentTitle.trim(),
            content: `NOUVEAU DOCUMENT

Titre: ${newDocumentTitle.trim()}

[Contenu à rédiger...]`,
            type: 'contract',
            status: 'draft',
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };

        const updatedDocuments = [newDocument, ...offlineDocuments];
        saveOfflineDocuments(updatedDocuments);

        setSelectedDocument(newDocument);
        setNewDocumentTitle('');
        setShowNewDocument(false);
        setIsEditing(true);
        setEditContent(newDocument.content);
    };

    const selectDocument = (document: OfflineDocument) => {
        setSelectedDocument(document);
        setEditContent(document.content);
        setIsEditing(false);
    };

    const startEditing = () => {
        setIsEditing(true);
        setEditContent(selectedDocument?.content || '');
    };

    const saveDocument = () => {
        if (!selectedDocument) return;

        const updatedDocument: OfflineDocument = {
            ...selectedDocument,
            content: editContent,
            lastModified: new Date().toISOString(),
            status: selectedDocument.status === 'synced' ? 'pending_sync' : selectedDocument.status
        };

        const updatedDocuments = offlineDocuments.map(doc =>
            doc.id === selectedDocument.id ? updatedDocument : doc
        );

        saveOfflineDocuments(updatedDocuments);
        setSelectedDocument(updatedDocument);
        setIsEditing(false);

        // Add to sync queue if online
        if (isOnline) {
            addToSyncQueue({
                type: 'update_document',
                documentId: updatedDocument.id,
                data: updatedDocument,
                url: `/api/documents/${updatedDocument.id}`,
                method: 'PUT'
            });
        }
    };

    const deleteDocument = (documentId: string) => {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
            const updatedDocuments = offlineDocuments.filter(doc => doc.id !== documentId);
            saveOfflineDocuments(updatedDocuments);

            if (selectedDocument?.id === documentId) {
                setSelectedDocument(null);
                setIsEditing(false);
            }
        }
    };

    const syncAllDocuments = async () => {
        setSyncing(true);
        try {
            await syncOfflineData();

            // Mark documents as synced (mock behavior)
            const updatedDocuments = offlineDocuments.map(doc => ({
                ...doc,
                status: 'synced' as const
            }));
            saveOfflineDocuments(updatedDocuments);

            if (selectedDocument) {
                setSelectedDocument({
                    ...selectedDocument,
                    status: 'synced'
                });
            }

            alert('Synchronisation terminée avec succès!');
        } catch (error) {
            console.error('Sync failed:', error);
            alert('Erreur lors de la synchronisation');
        } finally {
            setSyncing(false);
        }
    };

    const clearOfflineData = () => {
        if (confirm('Êtes-vous sûr de vouloir effacer toutes les données hors ligne ?')) {
            localStorage.removeItem('offlineDocuments');
            localStorage.removeItem('syncQueue');
            setOfflineDocuments([]);
            setSelectedDocument(null);
            setIsEditing(false);
            loadStorageStats();
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return '#f39c12';
            case 'pending_sync': return '#e74c3c';
            case 'synced': return '#27ae60';
            default: return '#7f8c8d';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'draft': return 'Brouillon';
            case 'pending_sync': return 'En attente de sync';
            case 'synced': return 'Synchronisé';
            default: return status;
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('fr-FR');
    };

    const formatFileSize = (sizeInKB: number) => {
        if (sizeInKB < 1024) {
            return `${sizeInKB} KB`;
        }
        return `${(sizeInKB / 1024).toFixed(1)} MB`;
    };

    return (
        <div className="offline-mode">
            <div className="offline-header">
                <h1>Mode Hors Ligne</h1>
                <p>Travaillez sur vos documents même sans connexion internet</p>

                <div className="connection-status">
                    <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
                        <span className="status-dot"></span>
                        {isOnline ? 'En ligne' : 'Hors ligne'}
                    </div>

                    {isOnline && syncQueue.length > 0 && (
                        <button
                            className="btn btn-primary"
                            onClick={syncAllDocuments}
                            disabled={syncing}
                        >
                            {syncing ? (
                                <>
                                    <span className="spinner"></span>
                                    Synchronisation...
                                </>
                            ) : (
                                <>
                                    🔄 Synchroniser ({syncQueue.length})
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            <div className="offline-content">
                {/* Sidebar */}
                <div className="offline-sidebar">
                    {/* Storage Stats */}
                    <div className="card">
                        <div className="card-header">
                            <h3>Stockage Local</h3>
                        </div>
                        <div className="card-content">
                            <div className="storage-stats">
                                <div className="storage-bar">
                                    <div
                                        className="storage-used"
                                        style={{ width: `${(storageStats.used / storageStats.available) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="storage-info">
                                    <span>{formatFileSize(storageStats.used)} utilisés</span>
                                    <span>{formatFileSize(storageStats.available)} disponibles</span>
                                </div>
                                <div className="storage-details">
                                    <div className="detail-item">
                                        <span>Documents:</span>
                                        <span>{storageStats.documents}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span>File d'attente:</span>
                                        <span>{storageStats.syncQueue}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Documents List */}
                    <div className="card">
                        <div className="card-header">
                            <h3>Documents Hors Ligne</h3>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowNewDocument(true)}
                            >
                                + Nouveau
                            </button>
                        </div>
                        <div className="card-content">
                            {showNewDocument && (
                                <div className="new-document-form">
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={newDocumentTitle}
                                        onChange={(e) => setNewDocumentTitle(e.target.value)}
                                        placeholder="Titre du document"
                                        onKeyPress={(e) => e.key === 'Enter' && createNewDocument()}
                                    />
                                    <div className="form-actions">
                                        <button className="btn btn-primary" onClick={createNewDocument}>
                                            Créer
                                        </button>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setShowNewDocument(false)}
                                        >
                                            Annuler
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="documents-list">
                                {offlineDocuments.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-icon">📄</div>
                                        <p>Aucun document hors ligne</p>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => setShowNewDocument(true)}
                                        >
                                            Créer le premier document
                                        </button>
                                    </div>
                                ) : (
                                    offlineDocuments.map((doc) => (
                                        <div
                                            key={doc.id}
                                            className={`document-item ${selectedDocument?.id === doc.id ? 'selected' : ''}`}
                                            onClick={() => selectDocument(doc)}
                                        >
                                            <div className="document-info">
                                                <div className="document-title">{doc.title}</div>
                                                <div className="document-meta">
                                                    <span className="document-type">{doc.type}</span>
                                                    <span
                                                        className="document-status"
                                                        style={{ color: getStatusColor(doc.status) }}
                                                    >
                                                        {getStatusLabel(doc.status)}
                                                    </span>
                                                </div>
                                                <div className="document-date">
                                                    Modifié: {formatDate(doc.lastModified)}
                                                </div>
                                            </div>
                                            <button
                                                className="delete-button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteDocument(doc.id);
                                                }}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Offline Actions */}
                    <div className="card">
                        <div className="card-header">
                            <h3>Actions</h3>
                        </div>
                        <div className="card-content">
                            <div className="offline-actions">
                                <button
                                    className="btn btn-secondary"
                                    onClick={loadStorageStats}
                                >
                                    🔄 Actualiser les stats
                                </button>
                                <button
                                    className="btn btn-danger"
                                    onClick={clearOfflineData}
                                >
                                    🗑️ Effacer les données
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="offline-main">
                    {selectedDocument ? (
                        <div className="document-editor">
                            <div className="editor-header">
                                <div className="document-info">
                                    <h2>{selectedDocument.title}</h2>
                                    <div className="document-meta">
                                        <span
                                            className="status-badge"
                                            style={{ backgroundColor: getStatusColor(selectedDocument.status) }}
                                        >
                                            {getStatusLabel(selectedDocument.status)}
                                        </span>
                                        <span className="document-type">{selectedDocument.type}</span>
                                        <span className="last-modified">
                                            Modifié: {formatDate(selectedDocument.lastModified)}
                                        </span>
                                    </div>
                                </div>
                                <div className="editor-actions">
                                    {isEditing ? (
                                        <>
                                            <button className="btn btn-primary" onClick={saveDocument}>
                                                💾 Sauvegarder
                                            </button>
                                            <button
                                                className="btn btn-secondary"
                                                onClick={() => setIsEditing(false)}
                                            >
                                                ❌ Annuler
                                            </button>
                                        </>
                                    ) : (
                                        <button className="btn btn-primary" onClick={startEditing}>
                                            ✏️ Éditer
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="editor-content">
                                {isEditing ? (
                                    <textarea
                                        className="document-textarea"
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        placeholder="Contenu du document..."
                                    />
                                ) : (
                                    <div className="document-preview">
                                        <pre className="document-text">{selectedDocument.content}</pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="no-document-selected">
                            <div className="placeholder-icon">📄</div>
                            <h3>Aucun document sélectionné</h3>
                            <p>Sélectionnez un document dans la liste ou créez-en un nouveau</p>
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowNewDocument(true)}
                            >
                                ✨ Créer un nouveau document
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
        .offline-mode {
          height: calc(100vh - 120px);
          display: flex;
          flex-direction: column;
        }

        .offline-header {
          padding: 1.5rem;
          background: white;
          border-bottom: 1px solid #ecf0f1;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .offline-header h1 {
          font-size: 2rem;
          color: #2c3e50;
          margin-bottom: 0.5rem;
        }

        .offline-header p {
          color: #7f8c8d;
          font-size: 1.1rem;
          margin-bottom: 1rem;
        }

        .connection-status {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
        }

        .status-indicator.online {
          color: #27ae60;
        }

        .status-indicator.offline {
          color: #e74c3c;
        }

        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .status-indicator.online .status-dot {
          background: #27ae60;
        }

        .status-indicator.offline .status-dot {
          background: #e74c3c;
        }

        .offline-content {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .offline-sidebar {
          width: 350px;
          background: #f8f9fa;
          border-right: 1px solid #ecf0f1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .offline-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .storage-stats {
          font-size: 0.9rem;
        }

        .storage-bar {
          width: 100%;
          height: 8px;
          background: #ecf0f1;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .storage-used {
          height: 100%;
          background: #3498db;
          transition: width 0.3s ease;
        }

        .storage-info {
          display: flex;
          justify-content: space-between;
          color: #7f8c8d;
          margin-bottom: 1rem;
        }

        .storage-details {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .new-document-form {
          background: white;
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid #ecf0f1;
          margin-bottom: 1rem;
        }

        .form-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }

        .documents-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .document-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: white;
          border: 1px solid #ecf0f1;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .document-item:hover {
          border-color: #3498db;
          box-shadow: 0 2px 8px rgba(52, 152, 219, 0.1);
        }

        .document-item.selected {
          border-color: #3498db;
          background: #e3f2fd;
        }

        .document-info {
          flex: 1;
        }

        .document-title {
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 0.5rem;
        }

        .document-meta {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 0.25rem;
          font-size: 0.8rem;
        }

        .document-type {
          background: #ecf0f1;
          color: #2c3e50;
          padding: 0.1rem 0.5rem;
          border-radius: 10px;
          text-transform: uppercase;
        }

        .document-status {
          font-weight: 600;
        }

        .document-date {
          color: #7f8c8d;
          font-size: 0.8rem;
        }

        .delete-button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 4px;
          transition: background-color 0.3s ease;
        }

        .delete-button:hover {
          background: #fff5f5;
        }

        .offline-actions {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .document-editor {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: white;
        }

        .editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #ecf0f1;
        }

        .editor-header h2 {
          margin: 0 0 0.5rem 0;
          color: #2c3e50;
        }

        .editor-header .document-meta {
          display: flex;
          gap: 1rem;
          align-items: center;
          font-size: 0.9rem;
        }

        .status-badge {
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .last-modified {
          color: #7f8c8d;
        }

        .editor-actions {
          display: flex;
          gap: 0.75rem;
        }

        .editor-content {
          flex: 1;
          overflow: hidden;
        }

        .document-textarea {
          width: 100%;
          height: 100%;
          border: none;
          outline: none;
          padding: 2rem;
          font-family: 'Georgia', serif;
          font-size: 1rem;
          line-height: 1.6;
          resize: none;
        }

        .document-preview {
          height: 100%;
          overflow-y: auto;
          padding: 2rem;
        }

        .document-text {
          font-family: 'Georgia', serif;
          font-size: 1rem;
          line-height: 1.6;
          white-space: pre-wrap;
          margin: 0;
          color: #2c3e50;
        }

        .no-document-selected {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #7f8c8d;
          text-align: center;
          padding: 2rem;
        }

        .placeholder-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .no-document-selected h3 {
          color: #2c3e50;
          margin-bottom: 0.5rem;
        }

        .no-document-selected p {
          margin-bottom: 2rem;
        }

        .empty-state {
          text-align: center;
          padding: 2rem;
          color: #7f8c8d;
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        @media (max-width: 768px) {
          .offline-content {
            flex-direction: column;
          }

          .offline-sidebar {
            width: 100%;
            max-height: 300px;
          }

          .connection-status {
            flex-direction: column;
            gap: 1rem;
            align-items: stretch;
          }

          .editor-header {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
          }

          .editor-actions {
            justify-content: center;
          }
        }
      `}</style>
        </div>
    );
};

export default OfflineMode;