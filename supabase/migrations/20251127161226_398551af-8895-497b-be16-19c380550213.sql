-- Add document_type column to baseline_documents
ALTER TABLE baseline_documents 
ADD COLUMN document_type text NOT NULL DEFAULT 'supplier_code';

-- Add document_type column to accepted_requirements
ALTER TABLE accepted_requirements 
ADD COLUMN document_type text NOT NULL DEFAULT 'supplier_code';

-- Add document_type column to gap_analyses
ALTER TABLE gap_analyses 
ADD COLUMN document_type text NOT NULL DEFAULT 'supplier_code';

-- Add document_type column to completed_evaluations
ALTER TABLE completed_evaluations 
ADD COLUMN document_type text NOT NULL DEFAULT 'supplier_code';

COMMENT ON COLUMN baseline_documents.document_type IS 'Type of document: supplier_code or nda';
COMMENT ON COLUMN accepted_requirements.document_type IS 'Type of document: supplier_code or nda';
COMMENT ON COLUMN gap_analyses.document_type IS 'Type of document: supplier_code or nda';
COMMENT ON COLUMN completed_evaluations.document_type IS 'Type of document: supplier_code or nda';