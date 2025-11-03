import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Collaborator {
    id: string;
    name: string;
    email: string;
    cursor: { line: number; column: number } | null;
    color: string;
    isActive: boolean;
}

interface DocumentVersion {
    id: string;
    content: string;
    timestamp: string;
    author: string;
    changes: string;
}

interface Comment {
    id: string;
    content: string;
    author: string;
    timestamp: string;
    line: number;
    resolved: boolean;
}

const CollaborativeEditor: React.FC = () => {
    const { documentId } = useParams<{ documentId?: string }>();
    const { user } = useAuth();
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const wsRef = useRef<WebSocket | null>(null);

    const [document, setDocument] = useState({
        id: documentId || 'new',
        title: 'Nouveau Document',
        content: '',
        type: 'contract',
        status: 'draft'
    });

    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [versions, setVersions] = useState<DocumentVersion[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [connected, setConnected] = useState(false);
    const [showVersions, setShowVersions] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [selectedLine, setSelectedLine] = useState<number | null>(null);

    const collaboratorColors = [
        '#3498db', '#e74c3c', '#2ecc71', '#f39c12',
        '#9b59b6', '#1abc9c', '#e67e22', '#34495e'
    ];

    useEffect(() => {
        if (documentId && documentId !== 'new') {
            loadDocument();
        }
        initializeWebSocket();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [documentId]);

    const loadDocument = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/documents/${documentId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setDocument(data.document);
                    setVersions(data.versions || []);
                    setComments(data.comments || []);
                }
            } else {
                // Load mock data for demo
                loadMockDocument();
            }
        } catch (error) {
            console.error('Failed to load document:', error);
            loadMockDocument();
        } finally {
            setLoading(false);
        }
    };

    const loadMockDocument = () => {
        const mockDocument = {
            id: documentId || 'demo-doc',
            title: 'Contrat de Vente - Terrain Antananarivo',
            content: `CONTRAT DE VENTE

Article 1 - Objet du contrat
Le présent contrat a pour objet la vente d'un bien immobilier situé à Antananarivo, Madagascar.

Article 2 - Prix de vente
Le prix de vente est fixé à cinquante millions (50 000 000) d'Ariary.

Article 3 - Modalités de paiement
Le paiement s'effectuera en trois versements égaux.

Article 4 - Obligations du vendeur
Le vendeur s'engage à livrer le bien en parfait état.`,
            type: 'contract',
            status: 'draft'
        };

        const mockVersions: DocumentVersion[] = [
            {
                id: '1',
                content: mockDocument.content,
                timestamp: new Date().toISOString(),
                author: user?.name || 'Utilisateur',
                changes: 'Version initiale'
            }
        ];

        const mockComments: Comment[] = [
            {
                id: '1',
                content: 'Vérifier le prix avec le client',
                author: 'Marie Razafy',
                timestamp: new Date().toISOString(),
                line: 5,
                resolved: false
            }
        ];

        setDocument(mockDocument);
        setVersions(mockVersions);
        setComments(mockComments);
    };

    const initializeWebSocket = () => {
        try {
            const wsUrl = `ws://localhost:3000/ws/collaborate/${documentId || 'new'}`;
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                setConnected(true);
                console.log('WebSocket connected');

                // Send join message
                ws.send(JSON.stringify({
                    type: 'join',
                    user: user,
                    documentId: documentId || 'new'
                }));
            };

            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                handleWebSocketMessage(message);
            };

            ws.onclose = () => {
                setConnected(false);
                console.log('WebSocket disconnected');

                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
                        initializeWebSocket();
                    }
                }, 3000);
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                setConnected(false);
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            // Mock collaborators for demo
            setCollaborators([
                {
                    id: '1',
                    name: 'Marie Razafy',
                    email: 'marie@example.mg',
                    cursor: { line: 3, column: 15 },
                    color: collaboratorColors[0],
                    isActive: true
                },
                {
                    id: '2',
                    name: 'Paul Randria',
                    email: 'paul@example.mg',
                    cursor: null,
                    color: collaboratorColors[1],
                    isActive: false
                }
            ]);
        }
    };

    const handleWebSocketMessage = (message: any) => {
        switch (message.type) {
            case 'collaborators_update':
                setCollaborators(message.collaborators);
                break;
            case 'content_change':
                if (message.userId !== user?.id) {
                    setDocument(prev => ({ ...prev, content: message.content }));
                }
                break;
            case 'cursor_update':
                setCollaborators(prev =>
                    prev.map(collab =>
                        collab.id === message.userId
                            ? { ...collab, cursor: message.cursor }
                            : collab
                    )
                );
                break;
            case 'comment_added':
                setComments(prev => [...prev, message.comment]);
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    };

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setDocument(prev => ({ ...prev, content: newContent }));

        // Send change to other collaborators
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'content_change',
                content: newContent,
                userId: user?.id,
                documentId: document.id
            }));
        }

        // Auto-save after 2 seconds of inactivity
        clearTimeout((window as any).autoSaveTimeout);
        (window as any).autoSaveTimeout = setTimeout(() => {
            saveDocument();
        }, 2000);
    };

    const handleCursorChange = () => {
        if (editorRef.current) {
            const textarea = editorRef.current;
            const cursorPosition = textarea.selectionStart;
            const textBeforeCursor = textarea.value.substring(0, cursorPosition);
            const lines = textBeforeCursor.split('\n');
            const line = lines.length;
            const column = lines[lines.length - 1].length;

            // Send cursor position to other collaborators
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'cursor_update',
                    cursor: { line, column },
                    userId: user?.id,
                    documentId: document.id
                }));
            }
        }
    };

    const saveDocument = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/documents/${document.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: document.title,
                    content: document.content,
                    type: document.type
                })
            });

            if (response.ok) {
                console.log('Document saved successfully');

                // Add to version history
                const newVersion: DocumentVersion = {
                    id: Date.now().toString(),
                    content: document.content,
                    timestamp: new Date().toISOString(),
                    author: user?.name || 'Utilisateur',
                    changes: 'Modification automatique'
                };
                setVersions(prev => [newVersion, ...prev]);
            }
        } catch (error) {
            console.error('Failed to save document:', error);
        } finally {
            setSaving(false);
        }
    };

    const addComment = () => {
        if (!newComment.trim() || selectedLine === null) return;

        const comment: Comment = {
            id: Date.now().toString(),
            content: newComment.trim(),
            author: user?.name || 'Utilisateur',
            timestamp: new Date().toISOString(),
            line: selectedLine,
            resolved: false
        };

        setComments(prev => [...prev, comment]);
        setNewComment('');
        setSelectedLine(null);

        // Send comment to other collaborators
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'comment_added',
                comment,
                documentId: document.id
            }));
        }
    };

    const resolveComment = (commentId: string) => {
        setComments(prev =>
            prev.map(comment =>
                comment.id === commentId
                    ? { ...comment, resolved: true }
                    : comment
            )
        );
    };

    const formatTimestamp = (timestamp: string) => {
        return new Date(timestamp).toLocaleString('fr-FR');
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Chargement du document...</p>
            </div>
        );
    }

    return (
        <div className="collaborative-editor">
            <div className="editor-header">
                <div className="document-info">
                    <input
                        type="text"
                        className="document-title-input"
                        value={document.title}
                        onChange={(e) => setDocument(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Titre du document"
                    />
                    <div className="document-meta">
                        <span className="document-status">{document.status}</span>
                        <span className="save-status">
                            {saving ? '💾 Sauvegarde...' : '✅ Sauvegardé'}
                        </span>
                    </div>
                </div>

                <div className="editor-actions">
                    <button
                        className={`btn btn-secondary ${showComments ? 'active' : ''}`}
                        onClick={() => setShowComments(!showComments)}
                    >
                        💬 Commentaires ({comments.filter(c => !c.resolved).length})
                    </button>
                    <button
                        className={`btn btn-secondary ${showVersions ? 'active' : ''}`}
                        onClick={() => setShowVersions(!showVersions)}
                    >
                        📚 Versions ({versions.length})
                    </button>
                    <button className="btn btn-primary" onClick={saveDocument}>
                        💾 Sauvegarder
                    </button>
                </div>
            </div>

            <div className="editor-body">
                <div className="editor-main">
                    <div className="collaborators-bar">
                        <div className="connection-status">
                            <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></span>
                            {connected ? 'Connecté' : 'Déconnecté'}
                        </div>

                        <div className="collaborators-list">
                            {collaborators.map((collaborator) => (
                                <div
                                    key={collaborator.id}
                                    className={`collaborator ${collaborator.isActive ? 'active' : ''}`}
                                    style={{ borderColor: collaborator.color }}
                                >
                                    <div
                                        className="collaborator-avatar"
                                        style={{ backgroundColor: collaborator.color }}
                                    >
                                        {collaborator.name.charAt(0)}
                                    </div>
                                    <span className="collaborator-name">{collaborator.name}</span>
                                    {collaborator.cursor && (
                                        <span className="cursor-info">
                                            L{collaborator.cursor.line}:C{collaborator.cursor.column}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="editor-container">
                        <div className="line-numbers">
                            {document.content.split('\n').map((_, index) => (
                                <div
                                    key={index}
                                    className={`line-number ${selectedLine === index + 1 ? 'selected' : ''}`}
                                    onClick={() => setSelectedLine(index + 1)}
                                >
                                    {index + 1}
                                    {comments.some(c => c.line === index + 1 && !c.resolved) && (
                                        <span className="comment-indicator">💬</span>
                                    )}
                                </div>
                            ))}
                        </div>

                        <textarea
                            ref={editorRef}
                            className="document-editor"
                            value={document.content}
                            onChange={handleContentChange}
                            onSelect={handleCursorChange}
                            onKeyUp={handleCursorChange}
                            placeholder="Commencez à taper votre document ici..."
                            spellCheck={false}
                        />
                    </div>
                </div>

                {/* Comments Panel */}
                {showComments && (
                    <div className="comments-panel">
                        <div className="panel-header">
                            <h3>Commentaires</h3>
                            <button
                                className="close-panel"
                                onClick={() => setShowComments(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="add-comment">
                            <div className="comment-line-selector">
                                <label>Ligne sélectionnée: {selectedLine || 'Aucune'}</label>
                            </div>
                            <textarea
                                className="comment-input"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Ajouter un commentaire..."
                                rows={3}
                            />
                            <button
                                className="btn btn-primary"
                                onClick={addComment}
                                disabled={!newComment.trim() || selectedLine === null}
                            >
                                Ajouter
                            </button>
                        </div>

                        <div className="comments-list">
                            {comments.map((comment) => (
                                <div
                                    key={comment.id}
                                    className={`comment ${comment.resolved ? 'resolved' : ''}`}
                                >
                                    <div className="comment-header">
                                        <span className="comment-author">{comment.author}</span>
                                        <span className="comment-line">Ligne {comment.line}</span>
                                        <span className="comment-time">
                                            {formatTimestamp(comment.timestamp)}
                                        </span>
                                    </div>
                                    <div className="comment-content">{comment.content}</div>
                                    {!comment.resolved && (
                                        <button
                                            className="resolve-comment"
                                            onClick={() => resolveComment(comment.id)}
                                        >
                                            ✅ Résoudre
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Versions Panel */}
                {showVersions && (
                    <div className="versions-panel">
                        <div className="panel-header">
                            <h3>Historique des Versions</h3>
                            <button
                                className="close-panel"
                                onClick={() => setShowVersions(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="versions-list">
                            {versions.map((version) => (
                                <div key={version.id} className="version-item">
                                    <div className="version-header">
                                        <span className="version-author">{version.author}</span>
                                        <span className="version-time">
                                            {formatTimestamp(version.timestamp)}
                                        </span>
                                    </div>
                                    <div className="version-changes">{version.changes}</div>
                                    <button className="btn btn-outline">
                                        Restaurer cette version
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
        .collaborative-editor {
          height: calc(100vh - 120px);
          display: flex;
          flex-direction: column;
        }

        .editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: white;
          border-bottom: 1px solid #ecf0f1;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .document-info {
          flex: 1;
        }

        .document-title-input {
          font-size: 1.2rem;
          font-weight: 600;
          border: none;
          background: transparent;
          color: #2c3e50;
          padding: 0.5rem;
          border-radius: 4px;
          margin-bottom: 0.5rem;
          width: 100%;
          max-width: 400px;
        }

        .document-title-input:focus {
          outline: none;
          background: #f8f9fa;
        }

        .document-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.9rem;
          color: #7f8c8d;
        }

        .document-status {
          background: #3498db;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          text-transform: uppercase;
        }

        .editor-actions {
          display: flex;
          gap: 0.75rem;
        }

        .editor-actions .btn.active {
          background: #2980b9;
          color: white;
        }

        .editor-body {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .editor-main {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .collaborators-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: #f8f9fa;
          border-bottom: 1px solid #ecf0f1;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.connected {
          background: #27ae60;
        }

        .status-dot.disconnected {
          background: #e74c3c;
        }

        .collaborators-list {
          display: flex;
          gap: 0.75rem;
        }

        .collaborator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          border-radius: 20px;
          border: 2px solid transparent;
          font-size: 0.8rem;
        }

        .collaborator.active {
          background: rgba(52, 152, 219, 0.1);
        }

        .collaborator-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 0.8rem;
        }

        .cursor-info {
          color: #7f8c8d;
          font-size: 0.7rem;
        }

        .editor-container {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .line-numbers {
          width: 60px;
          background: #f8f9fa;
          border-right: 1px solid #ecf0f1;
          padding: 1rem 0.5rem;
          font-family: 'Courier New', monospace;
          font-size: 0.9rem;
          color: #7f8c8d;
          overflow-y: auto;
          user-select: none;
        }

        .line-number {
          height: 1.5em;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          padding: 0 0.25rem;
          border-radius: 3px;
        }

        .line-number:hover {
          background: #ecf0f1;
        }

        .line-number.selected {
          background: #3498db;
          color: white;
        }

        .comment-indicator {
          font-size: 0.7rem;
        }

        .document-editor {
          flex: 1;
          border: none;
          outline: none;
          padding: 1rem;
          font-family: 'Georgia', serif;
          font-size: 1rem;
          line-height: 1.5;
          resize: none;
          background: white;
        }

        .comments-panel,
        .versions-panel {
          width: 350px;
          background: white;
          border-left: 1px solid #ecf0f1;
          display: flex;
          flex-direction: column;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border-bottom: 1px solid #ecf0f1;
          background: #f8f9fa;
        }

        .panel-header h3 {
          margin: 0;
          color: #2c3e50;
        }

        .close-panel {
          background: none;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
          color: #7f8c8d;
          padding: 0.25rem;
        }

        .add-comment {
          padding: 1rem;
          border-bottom: 1px solid #ecf0f1;
        }

        .comment-line-selector {
          margin-bottom: 0.75rem;
          font-size: 0.9rem;
          color: #7f8c8d;
        }

        .comment-input {
          width: 100%;
          border: 1px solid #ecf0f1;
          border-radius: 6px;
          padding: 0.75rem;
          margin-bottom: 0.75rem;
          resize: vertical;
          font-family: inherit;
        }

        .comments-list,
        .versions-list {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
        }

        .comment,
        .version-item {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
          border-left: 3px solid #3498db;
        }

        .comment.resolved {
          opacity: 0.6;
          border-left-color: #27ae60;
        }

        .comment-header,
        .version-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
          font-size: 0.8rem;
        }

        .comment-author,
        .version-author {
          font-weight: 600;
          color: #2c3e50;
        }

        .comment-line {
          background: #3498db;
          color: white;
          padding: 0.1rem 0.5rem;
          border-radius: 10px;
          font-size: 0.7rem;
        }

        .comment-time,
        .version-time {
          color: #7f8c8d;
        }

        .comment-content,
        .version-changes {
          margin-bottom: 0.75rem;
          font-size: 0.9rem;
          line-height: 1.4;
        }

        .resolve-comment {
          background: #27ae60;
          color: white;
          border: none;
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 400px;
          color: #7f8c8d;
        }

        @media (max-width: 768px) {
          .editor-header {
            flex-direction: column;
            gap: 1rem;
            align-items: stretch;
          }

          .editor-actions {
            justify-content: center;
          }

          .collaborators-bar {
            flex-direction: column;
            gap: 0.75rem;
          }

          .comments-panel,
          .versions-panel {
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            z-index: 100;
          }

          .line-numbers {
            width: 40px;
          }
        }
      `}</style>
        </div>
    );
};

export default CollaborativeEditor;