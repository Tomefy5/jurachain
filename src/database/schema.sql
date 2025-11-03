-- JusticeAutomation Database Schema
-- Supabase PostgreSQL schema for the legal document platform

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types (enums)
CREATE TYPE document_type AS ENUM (
  'contract',
  'lease', 
  'sale_agreement',
  'employment_contract',
  'service_agreement',
  'partnership_agreement',
  'non_disclosure_agreement',
  'power_of_attorney',
  'other'
);

CREATE TYPE language_type AS ENUM ('fr', 'mg', 'en');

CREATE TYPE document_status AS ENUM (
  'draft',
  'in_review',
  'pending_signature',
  'signed',
  'archived',
  'cancelled'
);

CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE risk_type AS ENUM (
  'abusive_clause',
  'unfair_terms',
  'missing_clause',
  'legal_compliance',
  'financial_risk',
  'termination_risk',
  'liability_risk'
);

CREATE TYPE signature_status AS ENUM ('pending', 'signed', 'rejected', 'expired');

CREATE TYPE user_role AS ENUM ('user', 'admin', 'legal_expert');

CREATE TYPE blockchain_status AS ENUM ('pending', 'confirmed', 'failed');

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role DEFAULT 'user',
  phone TEXT,
  address TEXT,
  preferences JSONB DEFAULT '{
    "language": "fr",
    "notifications": true,
    "twoFactorEnabled": false
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Legal documents table
CREATE TABLE legal_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type document_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  language language_type NOT NULL,
  status document_status DEFAULT 'draft',
  metadata JSONB DEFAULT '{
    "version": 1,
    "generatedBy": "manual",
    "jurisdiction": "Madagascar",
    "tags": []
  }'::jsonb,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  signed_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE
);

-- Parties table
CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  role TEXT NOT NULL,
  national_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clauses table
CREATE TABLE clauses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  position INTEGER NOT NULL,
  is_required BOOLEAN DEFAULT false,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blockchain records table
CREATE TABLE blockchain_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_hash TEXT UNIQUE NOT NULL,
  block_number BIGINT,
  network TEXT NOT NULL CHECK (network IN ('hedera', 'polygon')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  gas_used BIGINT,
  status blockchain_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Digital signatures table
CREATE TABLE digital_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  signer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signature TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET NOT NULL,
  user_agent TEXT,
  status signature_status DEFAULT 'pending',
  blockchain_hash TEXT,
  blockchain_record_id UUID REFERENCES blockchain_records(id),
  verification_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Risk assessments table
CREATE TABLE risk_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clause_id UUID NOT NULL REFERENCES clauses(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  risk_level risk_level NOT NULL,
  risk_type risk_type NOT NULL,
  description TEXT NOT NULL,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'ignored')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suggestions table
CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  risk_assessment_id UUID NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('replacement', 'addition', 'removal', 'modification')),
  original_text TEXT,
  suggested_text TEXT NOT NULL,
  reason TEXT NOT NULL,
  priority risk_level NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Compliance reports table
CREATE TABLE compliance_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  is_compliant BOOLEAN NOT NULL,
  jurisdiction TEXT NOT NULL,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  score INTEGER CHECK (score >= 0 AND score <= 100),
  issues JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collaboration sessions table
CREATE TABLE collaboration_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  participants UUID[] NOT NULL,
  google_doc_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Document versions table
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  changes TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(document_id, version)
);

-- Create indexes for better performance
CREATE INDEX idx_legal_documents_created_by ON legal_documents(created_by);
CREATE INDEX idx_legal_documents_status ON legal_documents(status);
CREATE INDEX idx_legal_documents_type ON legal_documents(type);
CREATE INDEX idx_parties_document_id ON parties(document_id);
CREATE INDEX idx_clauses_document_id ON clauses(document_id);
CREATE INDEX idx_digital_signatures_document_id ON digital_signatures(document_id);
CREATE INDEX idx_digital_signatures_signer_id ON digital_signatures(signer_id);
CREATE INDEX idx_risk_assessments_document_id ON risk_assessments(document_id);
CREATE INDEX idx_risk_assessments_clause_id ON risk_assessments(clause_id);
CREATE INDEX idx_suggestions_risk_assessment_id ON suggestions(risk_assessment_id);
CREATE INDEX idx_compliance_reports_document_id ON compliance_reports(document_id);
CREATE INDEX idx_collaboration_sessions_document_id ON collaboration_sessions(document_id);
CREATE INDEX idx_document_versions_document_id ON document_versions(document_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_legal_documents_updated_at BEFORE UPDATE ON legal_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE clauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

-- Users can read and update their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Users can manage their own documents
CREATE POLICY "Users can view own documents" ON legal_documents
  FOR SELECT USING (
    auth.uid() = created_by OR 
    auth.uid() IN (
      SELECT signer_id FROM digital_signatures WHERE document_id = legal_documents.id
    ) OR
    auth.uid() = ANY(
      SELECT unnest(participants) FROM collaboration_sessions WHERE document_id = legal_documents.id
    )
  );

CREATE POLICY "Users can create documents" ON legal_documents
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own documents" ON legal_documents
  FOR UPDATE USING (auth.uid() = created_by);

-- Similar policies for related tables
CREATE POLICY "Users can view parties of accessible documents" ON parties
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM legal_documents WHERE 
        auth.uid() = created_by OR 
        auth.uid() IN (SELECT signer_id FROM digital_signatures WHERE document_id = legal_documents.id)
    )
  );

CREATE POLICY "Users can manage parties of own documents" ON parties
  FOR ALL USING (
    document_id IN (SELECT id FROM legal_documents WHERE auth.uid() = created_by)
  );

-- Add similar policies for other tables following the same pattern
CREATE POLICY "Users can view clauses of accessible documents" ON clauses
  FOR SELECT USING (
    document_id IN (
      SELECT id FROM legal_documents WHERE 
        auth.uid() = created_by OR 
        auth.uid() IN (SELECT signer_id FROM digital_signatures WHERE document_id = legal_documents.id)
    )
  );

CREATE POLICY "Users can manage clauses of own documents" ON clauses
  FOR ALL USING (
    document_id IN (SELECT id FROM legal_documents WHERE auth.uid() = created_by)
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;