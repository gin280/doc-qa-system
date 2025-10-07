#!/bin/bash

# 测试向量相似度

echo "🔍 测试向量相似度..."
echo ""

# 加载环境变量
export $(grep -v '^#' .env.local | grep DATABASE_URL | xargs)

DOC_ID="wyjsgt6f28v8wwmvhjvxih3u"

echo "📊 获取第一个chunk的向量（用于测试）："
psql $DATABASE_URL << SQL
\x
SELECT 
  id,
  chunk_index,
  substring(content, 1, 100) as content_preview,
  -- 检查向量的一些统计信息
  vector_dims(embedding) as dims,
  -- 向量的前3个值
  embedding[1] as v1,
  embedding[2] as v2,
  embedding[3] as v3
FROM document_chunks
WHERE document_id = '$DOC_ID'
ORDER BY chunk_index
LIMIT 1;
SQL

echo ""
echo "🔍 测试：chunk自身与自身的相似度（应该=1.0）："
psql $DATABASE_URL << SQL
SELECT 
  dc1.id,
  dc1.chunk_index,
  -- 自己和自己的余弦相似度
  1 - (dc1.embedding <=> dc1.embedding) as self_similarity,
  -- 向量的模长（应该=1如果已归一化）
  sqrt((dc1.embedding <#> dc1.embedding)) as vector_norm
FROM document_chunks dc1
WHERE dc1.document_id = '$DOC_ID'
ORDER BY dc1.chunk_index
LIMIT 1;
SQL

echo ""
echo "🔍 测试：不同chunks之间的相似度："
psql $DATABASE_URL << SQL
SELECT 
  dc1.chunk_index as chunk1,
  dc2.chunk_index as chunk2,
  1 - (dc1.embedding <=> dc2.embedding) as similarity
FROM document_chunks dc1
CROSS JOIN document_chunks dc2
WHERE dc1.document_id = '$DOC_ID'
  AND dc2.document_id = '$DOC_ID'
  AND dc1.chunk_index < dc2.chunk_index
ORDER BY similarity DESC
LIMIT 5;
SQL

echo ""
echo "✅ 测试完成"
