-- 启用pgvector扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 在document_chunks表添加向量列
ALTER TABLE document_chunks 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 创建向量索引(使用ivfflat,适合中等规模数据)
-- lists参数: 建议为rows/1000,这里假设10万行,使用100
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
ON document_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 添加复合索引用于过滤查询
CREATE INDEX IF NOT EXISTS document_chunks_metadata_idx
ON document_chunks
USING gin (metadata);
