import React, { useState } from 'react';
import { useOffline } from '../contexts/OfflineContext';

interface GenerationRequest {
    type: string;
    language: string;
    description: string;
    parties: Array<{
        name: string;
        email: string;
        role: string;
    }>;
    jurisdiction: string;
    specificClauses: string[];
}

interface GeneratedDocument {
    id: string;
    title: string;
    content: string;
    type: string;
    language: string;
    status: string;
    createdAt: string;
}

const DocumentGenerator: React.FC = () => {
    const { isOnline, addToSyncQueue } = useOffline();
    const [formData, setFormData] = useState<GenerationRequest>({
        type: 'contract',
        language: 'fr',
        description: '',
        parties: [
            { name: '', email: '', role: 'partie1' },
            { name: '', email: '', role: 'partie2' }
        ],
        jurisdiction: 'Madagascar',
        specificClauses: []
    });

    const [generatedDocument, setGeneratedDocument] = useState<GeneratedDocument | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [newClause, setNewClause] = useState('');

    const documentTypes = [
        { value: 'contract', label: 'Contrat de Vente' },
        { value: 'lease', label: 'Bail Commercial' },
        { value: 'partnership', label: 'Accord de Partenariat' },
        { value: 'employment', label: 'Contrat de Travail' },
        { value: 'service', label: 'Contrat de Service' },
        { value: 'loan', label: 'Contrat de Prêt' }
    ];

    const languages = [
        { value: 'fr', label: 'Français' },
        { value: 'mg', label: 'Malgache' },
        { value: 'en', label: 'Anglais' }
    ];

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
        setError('');
    };

    const handlePartyChange = (index: number, field: string, value: string) => {
        const updatedParties = [...formData.parties];
        updatedParties[index] = { ...updatedParties[index], [field]: value };
        setFormData(prev => ({
            ...prev,
            parties: updatedParties
        }));
    };

    const addParty = () => {
        setFormData(prev => ({
            ...prev,
            parties: [...prev.parties, { name: '', email: '', role: `partie${prev.parties.length + 1}` }]
        }));
    };

    const removeParty = (index: number) => {
        if (formData.parties.length > 2) {
            const updatedParties = formData.parties.filter((_, i) => i !== index);
            setFormData(prev => ({
                ...prev,
                parties: updatedParties
            }));
        }
    };

    const addClause = () => {
        if (newClause.trim()) {
            setFormData(prev => ({
                ...prev,
                specificClauses: [...prev.specificClauses, newClause.trim()]
            }));
            setNewClause('');
        }
    };

    const removeClause = (index: number) => {
        setFormData(prev => ({
            ...prev,
            specificClauses: prev.specificClauses.filter((_, i) => i !== index)
        }));
    };

    const generateDocument = async () => {
        if (!formData.description.trim()) {
            setError('Veuillez décrire le document à générer');
            return;
        }

        if (formData.parties.some(party => !party.name.trim())) {
            setError('Veuillez remplir le nom de toutes les parties');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/documents/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                setGeneratedDocument(result.document);
            } else {
                if (!isOnline) {
                    // Add to sync queue for offline processing
                    addToSyncQueue({
                        type: 'generate_document',
                        data: formData,
                        url: '/api/documents/generate',
                        method: 'POST'
                    });
                    setError('Document mis en file d\'attente pour génération hors ligne');
                } else {
                    setError(result.message || 'Erreur lors de la génération');
                }
            }
        } catch (error) {
            console.error('Generation error:', error);
            if (!isOnline) {
                addToSyncQueue({
                    type: 'generate_document',
                    data: formData,
                    url: '/api/documents/generate',
                    method: 'POST'
                });
                setError('Mode hors ligne: Document mis en file d\'attente');
            } else {
                setError('Erreur de connexion au service de génération');
            }
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            type: 'contract',
            language: 'fr',
            description: '',
            parties: [
                { name: '', email: '', role: 'partie1' },
                { name: '', email: '', role: 'partie2' }
            ],
            jurisdiction: 'Madagascar',
            specificClauses: []
        });
        setGeneratedDocument(null);
        setError('');
    };

    return (
        <div className="document-generator">
            <div className="generator-header">
                <h1>Générateur de Documents IA</h1>
                <p>Créez des documents légaux personnalisés en langage naturel</p>
                {!isOnline && (
                    <div className="offline-notice">
                        <span className="offline-icon">📱</span>
                        Mode hors ligne - Les documents seront générés lors de la reconnexion
                    </div>
                )}
            </div>

            {error && (
                <div className="error-message">
                    <span className="error-icon">⚠️</span>
                    {error}
                </div>
            )}

            <div className="generator-content">
                <div className="form-section">
                    <div className="card">
                        <div className="card-header">
                            <h2>Configuration du Document</h2>
                        </div>
                        <div className="card-content">
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Type de Document</label>
                                    <select
                                        className="form-select"
                                        value={formData.type}
                                        onChange={(e) => handleInputChange('type', e.target.value)}
                                    >
                                        {documentTypes.map(type => (
                                            <option key={type.value} value={type.value}>
                                                {type.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Langue</label>
                                    <select
                                        className="form-select"
                                        value={formData.language}
                                        onChange={(e) => handleInputChange('language', e.target.value)}
                                    >
                                        {languages.map(lang => (
                                            <option key={lang.value} value={lang.value}>
                                                {lang.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    Description du Document
                                    <span className="required">*</span>
                                </label>
                                <textarea
                                    className="form-textarea"
                                    value={formData.description}
                                    onChange={(e) => handleInputChange('description', e.target.value)}
                                    placeholder="Décrivez en détail le document que vous souhaitez générer. Par exemple: 'Contrat de vente d'un terrain de 500m² situé à Antananarivo, prix 50 millions Ariary, paiement en 3 versements...'"
                                    rows={4}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Juridiction</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={formData.jurisdiction}
                                    onChange={(e) => handleInputChange('jurisdiction', e.target.value)}
                                    placeholder="Madagascar"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h2>Parties Contractantes</h2>
                            <button className="btn btn-secondary" onClick={addParty}>
                                + Ajouter une partie
                            </button>
                        </div>
                        <div className="card-content">
                            {formData.parties.map((party, index) => (
                                <div key={index} className="party-form">
                                    <div className="party-header">
                                        <h4>Partie {index + 1}</h4>
                                        {formData.parties.length > 2 && (
                                            <button
                                                className="remove-button"
                                                onClick={() => removeParty(index)}
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Nom complet</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={party.name}
                                                onChange={(e) => handlePartyChange(index, 'name', e.target.value)}
                                                placeholder="Nom de la partie"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Email</label>
                                            <input
                                                type="email"
                                                className="form-input"
                                                value={party.email}
                                                onChange={(e) => handlePartyChange(index, 'email', e.target.value)}
                                                placeholder="email@exemple.com"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Rôle</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={party.role}
                                                onChange={(e) => handlePartyChange(index, 'role', e.target.value)}
                                                placeholder="Vendeur, Acheteur, etc."
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h2>Clauses Spécifiques</h2>
                        </div>
                        <div className="card-content">
                            <div className="clause-input">
                                <input
                                    type="text"
                                    className="form-input"
                                    value={newClause}
                                    onChange={(e) => setNewClause(e.target.value)}
                                    placeholder="Ajouter une clause spécifique..."
                                    onKeyPress={(e) => e.key === 'Enter' && addClause()}
                                />
                                <button className="btn btn-secondary" onClick={addClause}>
                                    Ajouter
                                </button>
                            </div>

                            {formData.specificClauses.length > 0 && (
                                <div className="clauses-list">
                                    {formData.specificClauses.map((clause, index) => (
                                        <div key={index} className="clause-item">
                                            <span className="clause-text">{clause}</span>
                                            <button
                                                className="remove-button"
                                                onClick={() => removeClause(index)}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="form-actions">
                        <button
                            className="btn btn-primary"
                            onClick={generateDocument}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner"></span>
                                    Génération en cours...
                                </>
                            ) : (
                                <>
                                    ✨ Générer le Document
                                </>
                            )}
                        </button>
                        <button className="btn btn-secondary" onClick={resetForm}>
                            🔄 Réinitialiser
                        </button>
                    </div>
                </div>

                {generatedDocument && (
                    <div className="result-section">
                        <div className="card">
                            <div className="card-header">
                                <h2>Document Généré</h2>
                                <div className="document-meta">
                                    <span className="document-type">{generatedDocument.type}</span>
                                    <span className="document-language">{generatedDocument.language}</span>
                                </div>
                            </div>
                            <div className="card-content">
                                <div className="document-preview">
                                    <h3 className="document-title">{generatedDocument.title}</h3>
                                    <div
                                        className="document-content"
                                        dangerouslySetInnerHTML={{
                                            __html: generatedDocument.content.replace(/\n/g, '<br>')
                                        }}
                                    />
                                </div>
                                <div className="document-actions">
                                    <button className="btn btn-primary">
                                        📝 Éditer
                                    </button>
                                    <button className="btn btn-success">
                                        ✍️ Signer
                                    </button>
                                    <button className="btn btn-secondary">
                                        📄 Télécharger
                                    </button>
                                    <button className="btn btn-secondary">
                                        🌍 Traduire
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
        .document-generator {
          max-width: 1200px;
          margin: 0 auto;
        }

        .generator-header {
          margin-bottom: 2rem;
        }

        .generator-header h1 {
          font-size: 2rem;
          color: #2c3e50;
          margin-bottom: 0.5rem;
        }

        .generator-header p {
          color: #7f8c8d;
          font-size: 1.1rem;
          margin-bottom: 1rem;
        }

        .offline-notice {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          color: #856404;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
        }

        .error-message {
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

        .generator-content {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
        }

        .form-section {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .party-form {
          border: 1px solid #ecf0f1;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .party-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .party-header h4 {
          margin: 0;
          color: #2c3e50;
        }

        .remove-button {
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          cursor: pointer;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .clause-input {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .clause-input .form-input {
          flex: 1;
        }

        .clauses-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .clause-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8f9fa;
          padding: 0.75rem;
          border-radius: 6px;
          border: 1px solid #ecf0f1;
        }

        .clause-text {
          flex: 1;
          font-size: 0.9rem;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-top: 2rem;
        }

        .result-section {
          margin-top: 2rem;
        }

        .document-meta {
          display: flex;
          gap: 0.5rem;
        }

        .document-type,
        .document-language {
          background: #3498db;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .document-language {
          background: #27ae60;
        }

        .document-preview {
          background: #f8f9fa;
          border: 1px solid #ecf0f1;
          border-radius: 8px;
          padding: 2rem;
          margin-bottom: 1.5rem;
          font-family: 'Georgia', serif;
          line-height: 1.8;
        }

        .document-title {
          color: #2c3e50;
          text-align: center;
          margin-bottom: 2rem;
          font-size: 1.5rem;
        }

        .document-content {
          color: #2c3e50;
          white-space: pre-line;
        }

        .document-actions {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          justify-content: center;
        }

        .required {
          color: #e74c3c;
          margin-left: 0.25rem;
        }

        @media (max-width: 768px) {
          .form-row {
            grid-template-columns: 1fr;
          }

          .form-actions,
          .document-actions {
            flex-direction: column;
          }

          .clause-input {
            flex-direction: column;
          }

          .generator-content {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
        </div>
    );
};

export default DocumentGenerator;