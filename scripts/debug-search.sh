#!/bin/bash

# 调试向量搜索问题

echo "🔍 调试向量搜索..."
echo ""

# 加载环境变量
export $(grep -v '^#' .env.local | grep DATABASE_URL | xargs)

DOC_ID="wyjsgt6f28v8wwmvhjvxih3u"
USER_ID="lldydf8xb0qo2d2kqk5qch1y"

echo "📊 检查文档基本信息："
psql $DATABASE_URL << SQL
SELECT 
  id,
  user_id,
  filename,
  status,
  chunks_count
FROM documents
WHERE id = '$DOC_ID';
SQL

echo ""
echo "📊 检查chunks数据："
psql $DATABASE_URL << SQL
SELECT 
  id,
  document_id,
  chunk_index,
  length(content) as content_len,
  embedding IS NOT NULL as has_embedding,
  CASE WHEN embedding IS NOT NULL THEN vector_dims(embedding) ELSE NULL END as embedding_dim
FROM document_chunks
WHERE document_id = '$DOC_ID'
ORDER BY chunk_index;
SQL

echo ""
echo "🔍 测试过滤条件："
echo "WHERE document_id = '$DOC_ID'"
psql $DATABASE_URL << SQL
SELECT COUNT(*) as count
FROM document_chunks
WHERE document_id = '$DOC_ID';
SQL

echo ""
echo "🔍 测试用户权限过滤："
echo "WHERE EXISTS (SELECT 1 FROM documents WHERE id = document_id AND user_id = '$USER_ID')"
psql $DATABASE_URL << SQL
SELECT COUNT(*) as count
FROM document_chunks dc
WHERE EXISTS (
  SELECT 1 FROM documents d 
  WHERE d.id = dc.document_id 
  AND d.user_id = '$USER_ID'
);
SQL

echo ""
echo "🔍 测试同时应用两个过滤条件："
psql $DATABASE_URL << SQL
SELECT COUNT(*) as count
FROM document_chunks dc
WHERE dc.document_id = '$DOC_ID'
AND EXISTS (
  SELECT 1 FROM documents d 
  WHERE d.id = dc.document_id 
  AND d.user_id = '$USER_ID'
);
SQL

echo ""
echo "✅ 调试完成"
