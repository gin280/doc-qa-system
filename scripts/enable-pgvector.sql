-- 启用pgvector扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 删除旧的embedding列（如果存在且维度不对）
ALTER TABLE document_chunks 
DROP COLUMN IF EXISTS embedding;

-- 重新创建embedding列（智谱AI使用1024维，OpenAI使用1536维）
ALTER TABLE document_chunks 
ADD COLUMN embedding vector(1024);  -- 智谱AI: 1024维

-- 如果使用OpenAI，改为:
-- ADD COLUMN embedding vector(1536);  -- OpenAI: 1536维

-- 创建向量索引(使用ivfflat,适合中等规模数据)
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
ON document_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 添加复合索引用于过滤查询
CREATE INDEX IF NOT EXISTS document_chunks_metadata_idx
ON document_chunks
USING gin (metadata);

-- 验证扩展已启用
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 验证列已添加（应该显示1024维）
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'document_chunks' AND column_name = 'embedding';
