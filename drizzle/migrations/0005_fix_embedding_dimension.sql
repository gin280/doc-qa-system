-- 修复向量维度不匹配问题
-- 将embedding从1536维改为1024维（智谱AI embedding-2）

-- 警告：此操作会删除所有现有向量数据！
-- 执行后需要重新向量化所有文档

-- 1. 删除现有索引
DROP INDEX IF EXISTS document_chunks_embedding_idx;

-- 2. 删除现有embedding列
ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding;

-- 3. 添加新的1024维embedding列
ALTER TABLE document_chunks 
ADD COLUMN embedding vector(1024);

-- 4. 重建向量索引
CREATE INDEX document_chunks_embedding_idx 
ON document_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 5. 将所有文档状态重置为PENDING，需要重新处理
UPDATE documents SET status = 'PENDING' WHERE status = 'READY';
