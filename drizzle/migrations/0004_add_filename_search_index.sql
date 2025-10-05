-- Migration: Add filename search index for better performance
-- Date: 2025-01-05
-- Issue: PERF-002 - Search uses LIKE query without index

-- Enable pg_trgm extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram index for filename search
-- This improves LIKE/ILIKE query performance significantly
CREATE INDEX IF NOT EXISTS idx_documents_filename_search 
ON documents USING gin (filename gin_trgm_ops);

-- Create composite index for common query patterns
-- Improves queries filtering by userId and sorting by uploadedAt
CREATE INDEX IF NOT EXISTS idx_documents_user_uploaded 
ON documents (user_id, uploaded_at DESC);

-- Add comment explaining the indexes
COMMENT ON INDEX idx_documents_filename_search IS 
'Trigram GIN index for efficient filename LIKE/ILIKE searches';

COMMENT ON INDEX idx_documents_user_uploaded IS 
'Composite index for user document listing with default sort order';
