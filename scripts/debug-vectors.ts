/**
 * 调试脚本：检查向量维度
 */
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

async function debugVectors() {
  const documentId = process.argv[2] || 'wyjsgt6f28v8wwmvhjvxih3u'
  
  console.log('=== 检查向量数据 ===\n')
  
  // 1. 检查向量维度
  const result = await db.execute(sql`
    SELECT 
      id,
      documentId,
      chunkIndex,
      array_length(embedding, 1) as vector_dimension,
      embedding IS NOT NULL as has_embedding
    FROM document_chunks 
    WHERE documentId = ${documentId}
    LIMIT 3
  `)
  
  console.log('文档chunks：')
  console.log(JSON.stringify(result.rows, null, 2))
  
  // 2. 检查表结构
  const tableInfo = await db.execute(sql`
    SELECT 
      column_name, 
      data_type,
      udt_name
    FROM information_schema.columns 
    WHERE table_name = 'document_chunks' 
    AND column_name = 'embedding'
  `)
  
  console.log('\n表结构：')
  console.log(JSON.stringify(tableInfo.rows, null, 2))
}

debugVectors()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
