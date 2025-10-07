/**
 * 手动应用embedding列修复
 */
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

async function fixEmbeddingColumn() {
  console.log('开始修复embedding列...\n')
  
  try {
    // 1. 删除现有索引
    console.log('1. 删除现有索引...')
    await db.execute(sql`DROP INDEX IF EXISTS document_chunks_embedding_idx`)
    console.log('   ✓ 索引已删除\n')
    
    // 2. 删除现有embedding列
    console.log('2. 删除现有embedding列...')
    await db.execute(sql`ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding`)
    console.log('   ✓ 列已删除\n')
    
    // 3. 添加新的1024维embedding列
    console.log('3. 添加新的1024维embedding列...')
    await db.execute(sql`ALTER TABLE document_chunks ADD COLUMN embedding vector(1024)`)
    console.log('   ✓ 新列已创建\n')
    
    // 4. 重建向量索引
    console.log('4. 重建向量索引...')
    await db.execute(sql`
      CREATE INDEX document_chunks_embedding_idx 
      ON document_chunks 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `)
    console.log('   ✓ 索引已重建\n')
    
    // 5. 重置文档状态
    console.log('5. 重置文档状态...')
    const result = await db.execute(sql`
      UPDATE documents 
      SET status = 'PENDING' 
      WHERE status = 'READY'
    `)
    console.log(`   ✓ 已重置文档状态\n`)
    
    console.log('✅ Embedding列修复完成！')
    console.log('\n请重新上传文档进行向量化。')
    
  } catch (error) {
    console.error('❌ 修复失败:', error)
    throw error
  }
}

fixEmbeddingColumn()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
