import * as dotenv from 'dotenv'
// 加载环境变量
dotenv.config({ path: '.env.local' })

import { db } from '../src/lib/db'
import { documents, documentChunks, userUsage } from '../drizzle/schema'

async function clearDocuments() {
  try {
    console.log('清理所有文档数据...')
    
    // 1. 删除所有文档chunks
    const deletedChunks = await db.delete(documentChunks)
    console.log('✓ 已删除所有文档chunks')
    
    // 2. 删除所有文档
    const deletedDocs = await db.delete(documents)
    console.log('✓ 已删除所有文档')
    
    // 3. 重置用户使用统计
    await db.update(userUsage).set({
      documentCount: 0,
      storageUsed: 0
    })
    console.log('✓ 已重置用户统计')
    
    console.log('\n✅ 清理完成！现在可以重新上传文档测试时区了。')
    process.exit(0)
  } catch (error) {
    console.error('❌ 清理失败:', error)
    process.exit(1)
  }
}

clearDocuments()

