#!/bin/bash

# 调试向量数据的脚本
# 检查数据库中实际存储的向量维度

echo "🔍 检查向量数据..."
echo ""

# 加载环境变量
export $(grep -v '^#' .env.local | grep DATABASE_URL | xargs)

# 检查最新文档的chunks和向量
echo "📊 最新文档的chunks信息："
psql $DATABASE_URL << 'SQL'
SELECT 
  d.id as doc_id,
  d.filename,
  d.status,
  d.chunks_count,
  COUNT(dc.*) as actual_chunks,
  COUNT(dc.embedding) as vectorized_chunks
FROM documents d
LEFT JOIN document_chunks dc ON d.id = dc.document_id
WHERE d.id = (SELECT id FROM documents ORDER BY uploaded_at DESC LIMIT 1)
GROUP BY d.id, d.filename, d.status, d.chunks_count;
SQL

echo ""
echo "📊 检查向量维度（使用pgvector函数）："
psql $DATABASE_URL << 'SQL'
SELECT 
  id,
  chunk_index,
  length(content) as content_length,
  -- 使用pgvector的vector_dims函数
  CASE 
    WHEN embedding IS NOT NULL THEN vector_dims(embedding)
    ELSE NULL 
  END as vector_dim
FROM document_chunks
WHERE document_id = (SELECT id FROM documents ORDER BY uploaded_at DESC LIMIT 1)
ORDER BY chunk_index
LIMIT 3;
SQL

echo ""
echo "🔍 测试向量搜索（降低阈值）："
echo "提示：如果返回结果，说明向量数据正常，只是相似度阈值问题"
psql $DATABASE_URL << 'SQL'
SELECT 
  dc.id,
  dc.chunk_index,
  substring(dc.content, 1, 50) as content_preview,
  -- 计算与随机向量的余弦相似度（仅用于测试）
  1 - (dc.embedding <=> (SELECT embedding FROM document_chunks WHERE document_id = (SELECT id FROM documents ORDER BY uploaded_at DESC LIMIT 1) LIMIT 1)) as similarity
FROM document_chunks dc
WHERE dc.document_id = (SELECT id FROM documents ORDER BY uploaded_at DESC LIMIT 1)
ORDER BY similarity DESC
LIMIT 3;
SQL

echo ""
echo "✅ 调试完成"