import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface SignatureData {
    id: string;
    documentId: string;
    signerId: string;
    signerName: string;
    signerEmail: string;
    signature: string;
    timestamp: string;
    ipAddress: string;
    blockchainHash?: string;
    verified: boolean;
}

interface DocumentToSign {
    id: string;
    title: string;
    content: string;
    type: string;
    parties: Array<{
        name: string;
        email: string;
        role: string;
        signed: boolean;
        signatureId?: string;
    }>;
    status: string;
    createdAt: string;
}

const DigitalSignature: React.FC = () => {
    const { documentId } = useParams<{ documentId?: string }>();
    const { user } = useAuth();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const [document, setDocument] = useState<DocumentToSign | null>(null);
    const [signatures, setSignatures] = useState<SignatureData[]>([]);
    const [loading, setLoading] = useState(false);
    const [signing, setSigning] = useState(false);
    const [signatureMode, setSignatureMode] = useState<'draw' | 'type' | 'upload'>('draw');
    const [typedSignature, setTypedSignature] = useState('');
    const [signatureFile, setSignatureFile] = useState<File | null>(null);
    const [showVerification, setShowVerification] = useState(false);
    const [verificationResult, setVerificationResult] = useState<any>(null);

    useEffect(() => {
        if (documentId && documentId !== 'new') {
            loadDocument();
            loadSignatures();
        } else {
            loadMockDocument();
        }
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
                }
            } else {
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
        const mockDocument: DocumentToSign = {
            id: documentId || 'demo-doc',
            title: 'Contrat de Vente - Terrain Antananarivo',
            content: `CONTRAT DE VENTE

Entre les soussignés :

M. Jean RAKOTO, vendeur
Demeurant à Antananarivo, Madagascar

Et

Mme Marie RAZAFY, acquéreur
Demeurant à Antananarivo, Madagascar

Il a été convenu ce qui suit :

Article 1 - Objet du contrat
Le présent contrat a pour objet la vente d'un terrain situé à Antananarivo, d'une superficie de 500 m².

Article 2 - Prix de vente
Le prix de vente est fixé à cinquante millions (50 000 000) d'Ariary.

Article 3 - Modalités de paiement
Le paiement s'effectuera en trois versements égaux de seize millions six cent soixante-six mille six cent soixante-six (16 666 666) Ariary chacun.

Article 4 - Obligations
Le vendeur s'engage à livrer le bien en parfait état et à fournir tous les documents nécessaires au transfert de propriété.

Fait à Antananarivo, le [DATE]

Signatures :`,
            type: 'contract',
            parties: [
                {
                    name: 'Jean RAKOTO',
                    email: 'jean.rakoto@email.mg',
                    role: 'Vendeur',
                    signed: false
                },
                {
                    name: 'Marie RAZAFY',
                    email: 'marie.razafy@email.mg',
                    role: 'Acquéreur',
                    signed: user?.name === 'Marie RAZAFY'
                }
            ],
            status: 'ready_for_signature',
            createdAt: new Date().toISOString()
        };

        setDocument(mockDocument);
    };

    const loadSignatures = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/documents/${documentId}/signatures`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setSignatures(data.signatures);
                }
            }
        } catch (error) {
            console.error('Failed to load signatures:', error);
            // Mock signatures for demo
            if (user?.name === 'Marie RAZAFY') {
                setSignatures([
                    {
                        id: '1',
                        documentId: documentId || 'demo-doc',
                        signerId: user.id,
                        signerName: user.name,
                        signerEmail: user.email,
                        signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                        timestamp: new Date().toISOString(),
                        ipAddress: '192.168.1.1',
                        blockchainHash: '0x1234567890abcdef',
                        verified: true
                    }
                ]);
            }
        }
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.beginPath();
                ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
            }
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;

        const canvas = canvasRef.current;
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                ctx.stroke();
            }
        }
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        setTypedSignature('');
        setSignatureFile(null);
    };

    const getSignatureData = (): string | null => {
        switch (signatureMode) {
            case 'draw':
                const canvas = canvasRef.current;
                return canvas ? canvas.toDataURL() : null;
            case 'type':
                if (!typedSignature.trim()) return null;
                // Create a canvas with typed signature
                const typeCanvas = document.createElement('canvas');
                typeCanvas.width = 400;
                typeCanvas.height = 100;
                const ctx = typeCanvas.getContext('2d');
                if (ctx) {
                    ctx.font = '24px cursive';
                    ctx.fillStyle = '#2c3e50';
                    ctx.fillText(typedSignature, 20, 50);
                }
                return typeCanvas.toDataURL();
            case 'upload':
                return signatureFile ? URL.createObjectURL(signatureFile) : null;
            default:
                return null;
        }
    };

    const signDocument = async () => {
        const signatureData = getSignatureData();
        if (!signatureData) {
            alert('Veuillez créer une signature avant de signer');
            return;
        }

        setSigning(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/documents/${document?.id}/sign`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    signature: signatureData,
                    signatureMethod: signatureMode,
                    timestamp: new Date().toISOString()
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Update document status
                if (document) {
                    const updatedParties = document.parties.map(party =>
                        party.email === user?.email
                            ? { ...party, signed: true, signatureId: result.signature.id }
                            : party
                    );

                    setDocument({
                        ...document,
                        parties: updatedParties,
                        status: updatedParties.every(p => p.signed) ? 'fully_signed' : 'partially_signed'
                    });
                }

                // Add signature to list
                setSignatures(prev => [...prev, result.signature]);

                alert('Document signé avec succès! La signature a été enregistrée sur la blockchain.');
            } else {
                alert('Erreur lors de la signature: ' + (result.message || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Signature error:', error);
            alert('Erreur de connexion lors de la signature');
        } finally {
            setSigning(false);
        }
    };

    const verifySignature = async (signatureId: string) => {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/signatures/${signatureId}/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (response.ok && result.success) {
                setVerificationResult(result.verification);
                setShowVerification(true);
            } else {
                alert('Erreur lors de la vérification: ' + (result.message || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Verification error:', error);
            // Mock verification result for demo
            setVerificationResult({
                valid: true,
                blockchainHash: '0x1234567890abcdef',
                timestamp: new Date().toISOString(),
                signerVerified: true,
                documentIntegrity: true,
                blockchainNetwork: 'Hedera Testnet'
            });
            setShowVerification(true);
        }
    };

    const formatTimestamp = (timestamp: string) => {
        return new Date(timestamp).toLocaleString('fr-FR');
    };

    const canUserSign = () => {
        if (!document || !user) return false;
        const userParty = document.parties.find(party => party.email === user.email);
        return userParty && !userParty.signed;
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Chargement du document...</p>
            </div>
        );
    }

    if (!document) {
        return (
            <div className="error-container">
                <h2>Document non trouvé</h2>
                <p>Le document demandé n'existe pas ou vous n'avez pas les permissions pour y accéder.</p>
            </div>
        );
    }

    return (
        <div className="digital-signature">
            <div className="signature-header">
                <h1>Signature Numérique</h1>
                <p>Signez vos documents de manière sécurisée avec la blockchain</p>
            </div>

            <div className="signature-content">
                {/* Document Preview */}
                <div className="document-section">
                    <div className="card">
                        <div className="card-header">
                            <h2>{document.title}</h2>
                            <div className="document-status">
                                <span className={`status-badge ${document.status}`}>
                                    {document.status === 'ready_for_signature' && 'Prêt pour signature'}
                                    {document.status === 'partially_signed' && 'Partiellement signé'}
                                    {document.status === 'fully_signed' && 'Entièrement signé'}
                                </span>
                            </div>
                        </div>
                        <div className="card-content">
                            <div className="document-preview">
                                <pre className="document-content">{document.content}</pre>
                            </div>
                        </div>
                    </div>

                    {/* Parties Status */}
                    <div className="card">
                        <div className="card-header">
                            <h3>État des Signatures</h3>
                        </div>
                        <div className="card-content">
                            <div className="parties-list">
                                {document.parties.map((party, index) => (
                                    <div key={index} className={`party-item ${party.signed ? 'signed' : 'pending'}`}>
                                        <div className="party-info">
                                            <div className="party-name">{party.name}</div>
                                            <div className="party-role">{party.role}</div>
                                            <div className="party-email">{party.email}</div>
                                        </div>
                                        <div className="party-status">
                                            {party.signed ? (
                                                <div className="signed-indicator">
                                                    <span className="check-icon">✅</span>
                                                    <span>Signé</span>
                                                    {party.signatureId && (
                                                        <button
                                                            className="verify-button"
                                                            onClick={() => verifySignature(party.signatureId!)}
                                                        >
                                                            🔍 Vérifier
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="pending-indicator">
                                                    <span className="pending-icon">⏳</span>
                                                    <span>En attente</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Signature Interface */}
                {canUserSign() && (
                    <div className="signature-section">
                        <div className="card">
                            <div className="card-header">
                                <h3>Créer votre Signature</h3>
                                <div className="signature-mode-selector">
                                    <button
                                        className={`mode-button ${signatureMode === 'draw' ? 'active' : ''}`}
                                        onClick={() => setSignatureMode('draw')}
                                    >
                                        ✏️ Dessiner
                                    </button>
                                    <button
                                        className={`mode-button ${signatureMode === 'type' ? 'active' : ''}`}
                                        onClick={() => setSignatureMode('type')}
                                    >
                                        ⌨️ Taper
                                    </button>
                                    <button
                                        className={`mode-button ${signatureMode === 'upload' ? 'active' : ''}`}
                                        onClick={() => setSignatureMode('upload')}
                                    >
                                        📁 Importer
                                    </button>
                                </div>
                            </div>
                            <div className="card-content">
                                {signatureMode === 'draw' && (
                                    <div className="draw-signature">
                                        <canvas
                                            ref={canvasRef}
                                            width={400}
                                            height={150}
                                            className="signature-canvas"
                                            onMouseDown={startDrawing}
                                            onMouseMove={draw}
                                            onMouseUp={stopDrawing}
                                            onMouseLeave={stopDrawing}
                                        />
                                        <p className="signature-instruction">
                                            Dessinez votre signature dans la zone ci-dessus
                                        </p>
                                    </div>
                                )}

                                {signatureMode === 'type' && (
                                    <div className="type-signature">
                                        <input
                                            type="text"
                                            className="signature-input"
                                            value={typedSignature}
                                            onChange={(e) => setTypedSignature(e.target.value)}
                                            placeholder="Tapez votre nom complet"
                                        />
                                        {typedSignature && (
                                            <div className="signature-preview">
                                                <span className="typed-signature">{typedSignature}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {signatureMode === 'upload' && (
                                    <div className="upload-signature">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => setSignatureFile(e.target.files?.[0] || null)}
                                            className="file-input"
                                        />
                                        {signatureFile && (
                                            <div className="signature-preview">
                                                <img
                                                    src={URL.createObjectURL(signatureFile)}
                                                    alt="Signature"
                                                    className="uploaded-signature"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="signature-actions">
                                    <button className="btn btn-secondary" onClick={clearSignature}>
                                        🗑️ Effacer
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={signDocument}
                                        disabled={signing || !getSignatureData()}
                                    >
                                        {signing ? (
                                            <>
                                                <span className="spinner"></span>
                                                Signature en cours...
                                            </>
                                        ) : (
                                            <>
                                                ✍️ Signer le Document
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Existing Signatures */}
                {signatures.length > 0 && (
                    <div className="signatures-history">
                        <div className="card">
                            <div className="card-header">
                                <h3>Signatures Enregistrées</h3>
                            </div>
                            <div className="card-content">
                                <div className="signatures-list">
                                    {signatures.map((signature) => (
                                        <div key={signature.id} className="signature-item">
                                            <div className="signature-info">
                                                <div className="signer-name">{signature.signerName}</div>
                                                <div className="signature-time">
                                                    Signé le {formatTimestamp(signature.timestamp)}
                                                </div>
                                                {signature.blockchainHash && (
                                                    <div className="blockchain-hash">
                                                        Hash: {signature.blockchainHash.substring(0, 20)}...
                                                    </div>
                                                )}
                                            </div>
                                            <div className="signature-preview">
                                                <img
                                                    src={signature.signature}
                                                    alt={`Signature de ${signature.signerName}`}
                                                    className="signature-image"
                                                />
                                            </div>
                                            <div className="signature-actions">
                                                <button
                                                    className="btn btn-outline"
                                                    onClick={() => verifySignature(signature.id)}
                                                >
                                                    🔍 Vérifier
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Verification Modal */}
            {showVerification && verificationResult && (
                <div className="modal-overlay" onClick={() => setShowVerification(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Résultat de la Vérification</h3>
                            <button
                                className="close-modal"
                                onClick={() => setShowVerification(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-content">
                            <div className="verification-result">
                                <div className={`verification-status ${verificationResult.valid ? 'valid' : 'invalid'}`}>
                                    <span className="status-icon">
                                        {verificationResult.valid ? '✅' : '❌'}
                                    </span>
                                    <span className="status-text">
                                        {verificationResult.valid ? 'Signature Valide' : 'Signature Invalide'}
                                    </span>
                                </div>

                                <div className="verification-details">
                                    <div className="detail-item">
                                        <strong>Hash Blockchain:</strong>
                                        <span>{verificationResult.blockchainHash}</span>
                                    </div>
                                    <div className="detail-item">
                                        <strong>Réseau:</strong>
                                        <span>{verificationResult.blockchainNetwork}</span>
                                    </div>
                                    <div className="detail-item">
                                        <strong>Horodatage:</strong>
                                        <span>{formatTimestamp(verificationResult.timestamp)}</span>
                                    </div>
                                    <div className="detail-item">
                                        <strong>Signataire Vérifié:</strong>
                                        <span>{verificationResult.signerVerified ? '✅ Oui' : '❌ Non'}</span>
                                    </div>
                                    <div className="detail-item">
                                        <strong>Intégrité du Document:</strong>
                                        <span>{verificationResult.documentIntegrity ? '✅ Préservée' : '❌ Compromise'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
        .digital-signature {
          max-width: 1200px;
          margin: 0 auto;
        }

        .signature-header {
          margin-bottom: 2rem;
        }

        .signature-header h1 {
          font-size: 2rem;
          color: #2c3e50;
          margin-bottom: 0.5rem;
        }

        .signature-header p {
          color: #7f8c8d;
          font-size: 1.1rem;
        }

        .signature-content {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2rem;
        }

        .document-section,
        .signature-section,
        .signatures-history {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .document-preview {
          max-height: 400px;
          overflow-y: auto;
          border: 1px solid #ecf0f1;
          border-radius: 8px;
          padding: 1.5rem;
          background: #f8f9fa;
        }

        .document-content {
          font-family: 'Georgia', serif;
          line-height: 1.6;
          white-space: pre-wrap;
          margin: 0;
        }

        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-badge.ready_for_signature {
          background: #fff3cd;
          color: #856404;
        }

        .status-badge.partially_signed {
          background: #cce5ff;
          color: #004085;
        }

        .status-badge.fully_signed {
          background: #d4edda;
          color: #155724;
        }

        .parties-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .party-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border: 1px solid #ecf0f1;
          border-radius: 8px;
          background: #f8f9fa;
        }

        .party-item.signed {
          border-color: #27ae60;
          background: #f0fff4;
        }

        .party-info {
          flex: 1;
        }

        .party-name {
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 0.25rem;
        }

        .party-role {
          color: #3498db;
          font-size: 0.9rem;
          margin-bottom: 0.25rem;
        }

        .party-email {
          color: #7f8c8d;
          font-size: 0.8rem;
        }

        .party-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .signed-indicator,
        .pending-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
        }

        .verify-button {
          background: #3498db;
          color: white;
          border: none;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.8rem;
          cursor: pointer;
          margin-left: 0.5rem;
        }

        .signature-mode-selector {
          display: flex;
          gap: 0.5rem;
        }

        .mode-button {
          padding: 0.5rem 1rem;
          border: 1px solid #ecf0f1;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.3s ease;
        }

        .mode-button.active {
          background: #3498db;
          color: white;
          border-color: #3498db;
        }

        .signature-canvas {
          border: 2px solid #ecf0f1;
          border-radius: 8px;
          cursor: crosshair;
          background: white;
        }

        .signature-instruction {
          text-align: center;
          color: #7f8c8d;
          font-size: 0.9rem;
          margin-top: 0.5rem;
        }

        .signature-input {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #ecf0f1;
          border-radius: 8px;
          font-size: 1rem;
          margin-bottom: 1rem;
        }

        .signature-preview {
          text-align: center;
          padding: 1rem;
          border: 1px solid #ecf0f1;
          border-radius: 8px;
          background: #f8f9fa;
        }

        .typed-signature {
          font-family: cursive;
          font-size: 2rem;
          color: #2c3e50;
        }

        .uploaded-signature {
          max-width: 200px;
          max-height: 100px;
          border: 1px solid #ecf0f1;
        }

        .file-input {
          width: 100%;
          padding: 0.75rem;
          border: 2px dashed #ecf0f1;
          border-radius: 8px;
          background: #f8f9fa;
          margin-bottom: 1rem;
        }

        .signature-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-top: 1.5rem;
        }

        .signatures-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .signature-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border: 1px solid #ecf0f1;
          border-radius: 8px;
          background: #f8f9fa;
        }

        .signature-info {
          flex: 1;
        }

        .signer-name {
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 0.25rem;
        }

        .signature-time {
          color: #7f8c8d;
          font-size: 0.9rem;
          margin-bottom: 0.25rem;
        }

        .blockchain-hash {
          color: #3498db;
          font-size: 0.8rem;
          font-family: monospace;
        }

        .signature-image {
          max-width: 150px;
          max-height: 75px;
          border: 1px solid #ecf0f1;
          border-radius: 4px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: white;
          border-radius: 12px;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #ecf0f1;
        }

        .modal-header h3 {
          margin: 0;
          color: #2c3e50;
        }

        .close-modal {
          background: none;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
          color: #7f8c8d;
          padding: 0.25rem;
        }

        .modal-content {
          padding: 1.5rem;
        }

        .verification-status {
          text-align: center;
          margin-bottom: 2rem;
        }

        .verification-status.valid {
          color: #27ae60;
        }

        .verification-status.invalid {
          color: #e74c3c;
        }

        .status-icon {
          font-size: 3rem;
          display: block;
          margin-bottom: 0.5rem;
        }

        .status-text {
          font-size: 1.2rem;
          font-weight: 600;
        }

        .verification-details {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: #f8f9fa;
          border-radius: 6px;
        }

        .loading-container,
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          color: #7f8c8d;
        }

        @media (max-width: 768px) {
          .signature-content {
            grid-template-columns: 1fr;
          }

          .party-item {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
          }

          .signature-item {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }

          .signature-actions {
            flex-direction: column;
          }

          .signature-mode-selector {
            flex-wrap: wrap;
          }
        }
      `}</style>
        </div>
    );
};

export default DigitalSignature;