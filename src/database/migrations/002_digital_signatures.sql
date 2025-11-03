-- Migration pour les signatures numériques et enregistrements blockchain
-- Création des tables pour supporter les signatures avec blockchain

-- Table pour les signatures numériques
CREATE TABLE IF NOT EXISTS digital_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
    signer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    signer_name VARCHAR(255) NOT NULL,
    signer_email VARCHAR(255) NOT NULL,
    signature TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'rejected', 'expired')),
    blockchain_hash VARCHAR(255),
    blockchain_record JSONB,
    verification_code VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table pour les enregistrements blockchain
CREATE TABLE IF NOT EXISTS blockchain_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_hash VARCHAR(255) NOT NULL UNIQUE,
    block_number BIGINT,
    network VARCHAR(50) NOT NULL CHECK (network IN ('hedera', 'polygon')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    gas_used BIGINT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
    topic_id VARCHAR(100), -- Pour Hedera
    sequence_number VARCHAR(100), -- Pour Hedera
    data JSONB, -- Données associées à la transaction
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table pour les preuves cryptographiques
CREATE TABLE IF NOT EXISTS cryptographic_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
    hash VARCHAR(255) NOT NULL,
    algorithm VARCHAR(50) NOT NULL DEFAULT 'SHA-256',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    blockchain_record_id UUID REFERENCES blockchain_records(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_digital_signatures_document_id ON digital_signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_signer_id ON digital_signatures(signer_id);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_timestamp ON digital_signatures(timestamp);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_status ON digital_signatures(status);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_blockchain_hash ON digital_signatures(blockchain_hash);

CREATE INDEX IF NOT EXISTS idx_blockchain_records_transaction_hash ON blockchain_records(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_blockchain_records_network ON blockchain_records(network);
CREATE INDEX IF NOT EXISTS idx_blockchain_records_status ON blockchain_records(status);
CREATE INDEX IF NOT EXISTS idx_blockchain_records_timestamp ON blockchain_records(timestamp);

CREATE INDEX IF NOT EXISTS idx_cryptographic_proofs_document_id ON cryptographic_proofs(document_id);
CREATE INDEX IF NOT EXISTS idx_cryptographic_proofs_hash ON cryptographic_proofs(hash);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at
CREATE TRIGGER update_digital_signatures_updated_at 
    BEFORE UPDATE ON digital_signatures 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blockchain_records_updated_at 
    BEFORE UPDATE ON blockchain_records 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Politique de sécurité RLS (Row Level Security)
ALTER TABLE digital_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockchain_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE cryptographic_proofs ENABLE ROW LEVEL SECURITY;

-- Politique pour les signatures numériques
CREATE POLICY "Users can view their own signatures" ON digital_signatures
    FOR SELECT USING (signer_id = auth.uid());

CREATE POLICY "Users can create signatures for documents they have access to" ON digital_signatures
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM legal_documents 
            WHERE id = document_id 
            AND (created_by = auth.uid() OR auth.uid() = ANY(
                SELECT jsonb_array_elements_text(parties::jsonb -> 'id')
            ))
        )
    );

-- Politique pour les enregistrements blockchain (lecture seule pour les utilisateurs)
CREATE POLICY "Users can view blockchain records for their signatures" ON blockchain_records
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM digital_signatures ds
            WHERE ds.blockchain_record->>'id' = blockchain_records.id::text
            AND ds.signer_id = auth.uid()
        )
    );

-- Politique pour les preuves cryptographiques
CREATE POLICY "Users can view proofs for their documents" ON cryptographic_proofs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM legal_documents 
            WHERE id = document_id 
            AND (created_by = auth.uid() OR auth.uid() = ANY(
                SELECT jsonb_array_elements_text(parties::jsonb -> 'id')
            ))
        )
    );

-- Vues pour simplifier les requêtes
CREATE OR REPLACE VIEW signature_details AS
SELECT 
    ds.id,
    ds.document_id,
    ds.signer_id,
    ds.signer_name,
    ds.signer_email,
    ds.signature,
    ds.timestamp,
    ds.status,
    ds.blockchain_hash,
    br.network,
    br.transaction_hash,
    br.block_number,
    br.status as blockchain_status,
    ld.title as document_title,
    ld.type as document_type
FROM digital_signatures ds
LEFT JOIN blockchain_records br ON ds.blockchain_record->>'id' = br.id::text
LEFT JOIN legal_documents ld ON ds.document_id = ld.id;

-- Commentaires pour documentation
COMMENT ON TABLE digital_signatures IS 'Stockage des signatures numériques avec références blockchain';
COMMENT ON TABLE blockchain_records IS 'Enregistrements des transactions blockchain (Hedera/Polygon)';
COMMENT ON TABLE cryptographic_proofs IS 'Preuves cryptographiques des documents';
COMMENT ON VIEW signature_details IS 'Vue consolidée des signatures avec détails blockchain et document';