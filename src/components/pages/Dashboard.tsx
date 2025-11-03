import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Document {
    id: string;
    title: string;
    type: string;
    status: 'draft' | 'review' | 'signed' | 'archived';
    createdAt: string;
    updatedAt: string;
    parties: string[];
}

interface DashboardStats {
    total: number;
    byStatus: {
        draft: number;
        review: number;
        signed: number;
        archived: number;
    };
    recentActivity: number;
}

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [stats, setStats] = useState<DashboardStats>({
        total: 0,
        byStatus: { draft: 0, review: 0, signed: 0, archived: 0 },
        recentActivity: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/analytics/dashboard', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setStats(data.data.statistics);
                    setDocuments(data.data.documents || []);
                } else {
                    setError(data.message || 'Erreur lors du chargement');
                }
            } else {
                setError('Erreur de connexion au serveur');
            }
        } catch (error) {
            console.error('Dashboard load error:', error);
            setError('Erreur de connexion');
            // Load mock data for demo
            loadMockData();
        } finally {
            setLoading(false);
        }
    };

    const loadMockData = () => {
        const mockDocuments: Document[] = [
            {
                id: '1',
                title: 'Contrat de Vente - Terrain Antananarivo',
                type: 'contract',
                status: 'signed',
                createdAt: '2024-01-15T10:00:00Z',
                updatedAt: '2024-01-16T14:30:00Z',
                parties: ['Jean Rakoto', 'Marie Razafy']
            },
            {
                id: '2',
                title: 'Bail Commercial - Magasin Antsirabe',
                type: 'lease',
                status: 'review',
                createdAt: '2024-01-20T09:15:00Z',
                updatedAt: '2024-01-21T11:45:00Z',
                parties: ['Société ABC', 'Paul Randria']
            },
            {
                id: '3',
                title: 'Accord de Partenariat - Export Vanille',
                type: 'partnership',
                status: 'draft',
                createdAt: '2024-01-22T16:20:00Z',
                updatedAt: '2024-01-22T16:20:00Z',
                parties: ['Coopérative Vanille', 'Export International']
            }
        ];

        const mockStats: DashboardStats = {
            total: 3,
            byStatus: { draft: 1, review: 1, signed: 1, archived: 0 },
            recentActivity: 2
        };

        setDocuments(mockDocuments);
        setStats(mockStats);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return '#f39c12';
            case 'review': return '#3498db';
            case 'signed': return '#27ae60';
            case 'archived': return '#95a5a6';
            default: return '#7f8c8d';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'draft': return 'Brouillon';
            case 'review': return 'En révision';
            case 'signed': return 'Signé';
            case 'archived': return 'Archivé';
            default: return status;
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Chargement du tableau de bord...</p>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1>Tableau de Bord</h1>
                <p>Bienvenue, {user?.name}! Voici un aperçu de vos documents légaux.</p>
            </div>

            {error && (
                <div className="error-banner">
                    <span className="error-icon">⚠️</span>
                    {error}
                </div>
            )}

            {/* Quick Actions */}
            <div className="quick-actions">
                <Link to="/generate" className="action-card primary">
                    <div className="action-icon">✨</div>
                    <div className="action-content">
                        <h3>Nouveau Document</h3>
                        <p>Générer un contrat avec l'IA</p>
                    </div>
                </Link>

                <Link to="/collaborate" className="action-card secondary">
                    <div className="action-icon">👥</div>
                    <div className="action-content">
                        <h3>Collaboration</h3>
                        <p>Éditer en équipe</p>
                    </div>
                </Link>

                <Link to="/sign" className="action-card tertiary">
                    <div className="action-icon">✍️</div>
                    <div className="action-content">
                        <h3>Signature</h3>
                        <p>Signer numériquement</p>
                    </div>
                </Link>

                <Link to="/offline" className="action-card quaternary">
                    <div className="action-icon">📱</div>
                    <div className="action-content">
                        <h3>Mode Hors Ligne</h3>
                        <p>Travailler sans internet</p>
                    </div>
                </Link>
            </div>

            {/* Statistics */}
            <div className="stats-section">
                <h2>Statistiques</h2>
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-number">{stats.total}</div>
                        <div className="stat-label">Total Documents</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{stats.byStatus.signed}</div>
                        <div className="stat-label">Documents Signés</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{stats.byStatus.review}</div>
                        <div className="stat-label">En Révision</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{stats.recentActivity}</div>
                        <div className="stat-label">Activité Récente</div>
                    </div>
                </div>
            </div>

            {/* Recent Documents */}
            <div className="documents-section">
                <div className="section-header">
                    <h2>Documents Récents</h2>
                    <Link to="/documents" className="view-all-link">
                        Voir tout →
                    </Link>
                </div>

                {documents.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📄</div>
                        <h3>Aucun document</h3>
                        <p>Commencez par créer votre premier document légal</p>
                        <Link to="/generate" className="btn btn-primary">
                            Créer un document
                        </Link>
                    </div>
                ) : (
                    <div className="documents-grid">
                        {documents.map((doc) => (
                            <div key={doc.id} className="document-card">
                                <div className="document-header">
                                    <h3 className="document-title">{doc.title}</h3>
                                    <div
                                        className="document-status"
                                        style={{ backgroundColor: getStatusColor(doc.status) }}
                                    >
                                        {getStatusLabel(doc.status)}
                                    </div>
                                </div>

                                <div className="document-meta">
                                    <div className="document-type">
                                        Type: {doc.type}
                                    </div>
                                    <div className="document-date">
                                        Créé le {formatDate(doc.createdAt)}
                                    </div>
                                </div>

                                <div className="document-parties">
                                    <strong>Parties:</strong>
                                    <div className="parties-list">
                                        {doc.parties.map((party, index) => (
                                            <span key={index} className="party-tag">
                                                {party}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="document-actions">
                                    <Link
                                        to={`/collaborate/${doc.id}`}
                                        className="btn btn-outline"
                                    >
                                        Éditer
                                    </Link>
                                    {doc.status !== 'signed' && (
                                        <Link
                                            to={`/sign/${doc.id}`}
                                            className="btn btn-primary"
                                        >
                                            Signer
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style jsx>{`
        .dashboard {
          max-width: 1200px;
          margin: 0 auto;
        }

        .dashboard-header {
          margin-bottom: 2rem;
        }

        .dashboard-header h1 {
          font-size: 2rem;
          color: #2c3e50;
          margin-bottom: 0.5rem;
        }

        .dashboard-header p {
          color: #7f8c8d;
          font-size: 1.1rem;
        }

        .error-banner {
          background: #fff5f5;
          border: 1px solid #e74c3c;
          color: #c0392b;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 2rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          color: #7f8c8d;
        }

        .quick-actions {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 3rem;
        }

        .action-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.5rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          text-decoration: none;
          color: inherit;
          transition: all 0.3s ease;
          border-left: 4px solid transparent;
        }

        .action-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }

        .action-card.primary {
          border-left-color: #3498db;
        }

        .action-card.secondary {
          border-left-color: #27ae60;
        }

        .action-card.tertiary {
          border-left-color: #f39c12;
        }

        .action-card.quaternary {
          border-left-color: #9b59b6;
        }

        .action-icon {
          font-size: 2rem;
          width: 60px;
          text-align: center;
        }

        .action-content h3 {
          margin: 0 0 0.25rem 0;
          color: #2c3e50;
          font-size: 1.1rem;
        }

        .action-content p {
          margin: 0;
          color: #7f8c8d;
          font-size: 0.9rem;
        }

        .stats-section {
          margin-bottom: 3rem;
        }

        .stats-section h2 {
          color: #2c3e50;
          margin-bottom: 1.5rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
        }

        .stat-card {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          text-align: center;
        }

        .stat-number {
          font-size: 2.5rem;
          font-weight: bold;
          color: #3498db;
          margin-bottom: 0.5rem;
        }

        .stat-label {
          color: #7f8c8d;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .documents-section {
          margin-bottom: 2rem;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .section-header h2 {
          color: #2c3e50;
          margin: 0;
        }

        .view-all-link {
          color: #3498db;
          text-decoration: none;
          font-weight: 600;
        }

        .view-all-link:hover {
          text-decoration: underline;
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .empty-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .empty-state h3 {
          color: #2c3e50;
          margin-bottom: 0.5rem;
        }

        .empty-state p {
          color: #7f8c8d;
          margin-bottom: 2rem;
        }

        .documents-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 1.5rem;
        }

        .document-card {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
        }

        .document-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }

        .document-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .document-title {
          color: #2c3e50;
          font-size: 1.1rem;
          margin: 0;
          flex: 1;
          margin-right: 1rem;
        }

        .document-status {
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          color: white;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .document-meta {
          margin-bottom: 1rem;
          font-size: 0.9rem;
          color: #7f8c8d;
        }

        .document-type {
          margin-bottom: 0.25rem;
        }

        .document-parties {
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
        }

        .parties-list {
          margin-top: 0.5rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .party-tag {
          background: #ecf0f1;
          color: #2c3e50;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.8rem;
        }

        .document-actions {
          display: flex;
          gap: 0.75rem;
        }

        .document-actions .btn {
          flex: 1;
          text-align: center;
          padding: 0.5rem 1rem;
          font-size: 0.9rem;
        }

        @media (max-width: 768px) {
          .quick-actions {
            grid-template-columns: 1fr;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .documents-grid {
            grid-template-columns: 1fr;
          }

          .section-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .document-actions {
            flex-direction: column;
          }
        }
      `}</style>
        </div>
    );
};

export default Dashboard;