/**
 * 检查migration后的数据状态
 */
import { db } from '@/lib/db'
import { documentChunks, documents } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

async function checkData() {
  const documentId = 'wyjsgt6f28v8wwmvhjvxih3u'
  
  console.log('=== 检查migration后的数据 ===\n')
  
  // 1. 检查文档状态
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
  
  console.log('文档状态：')
  console.log(`  - ID: ${doc?.id}`)
  console.log(`  - 文件名: ${doc?.filename}`)
  console.log(`  - 状态: ${doc?.status}`)
  console.log(`  - chunks数量: ${doc?.chunksCount}`)
  
  // 2. 检查chunks数据
  const chunks = await db
    .select()
    .from(documentChunks)
    .where(eq(documentChunks.documentId, documentId))
    .limit(3)
  
  console.log('\nChunks数据（前3条）：')
  chunks.forEach((chunk, i) => {
    console.log(`\n  Chunk ${i + 1}:`)
    console.log(`    - ID: ${chunk.id}`)
    console.log(`    - Index: ${chunk.chunkIndex}`)
    console.log(`    - Content长度: ${chunk.content.length}字符`)
    console.log(`    - Content预览: ${chunk.content.substring(0, 50)}...`)
    console.log(`    - Embedding ID: ${chunk.embeddingId}`)
    console.log(`    - Metadata: ${JSON.stringify(chunk.metadata)}`)
  })
  
  console.log(`\n总结：`)
  console.log(`  ✅ 文档元数据：${doc ? '存在' : '不存在'}`)
  console.log(`  ✅ Chunks文本内容：${chunks.length > 0 ? '存在' : '不存在'}`)
  console.log(`  ⚠️  Embedding向量：已被清空，需要重新生成`)
}

checkData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
