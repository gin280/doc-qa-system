/**
 * 检查文档状态的脚本
 * 使用方法: npx tsx scripts/check-document-status.ts
 */

// 加载环境变量
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { db } from '@/lib/db'
import { documents, documentChunks } from '@/drizzle/schema'
import { eq } from 'drizzle-orm'

async function checkDocumentStatus() {
  try {
    console.log('📊 检查所有文档状态...\n')

    // 获取所有文档
    const allDocs = await db.select({
      id: documents.id,
      filename: documents.filename,
      status: documents.status,
      chunksCount: documents.chunksCount,
      userId: documents.userId,
      uploadedAt: documents.uploadedAt
    }).from(documents)

    if (allDocs.length === 0) {
      console.log('❌ 没有找到任何文档')
      console.log('💡 请先上传文档: http://localhost:3000/documents')
      return
    }

    console.log(`找到 ${allDocs.length} 个文档:\n`)

    for (const doc of allDocs) {
      // 检查实际的chunks数量
      const actualChunks = await db
        .select()
        .from(documentChunks)
        .where(eq(documentChunks.documentId, doc.id))

      const statusIcon = doc.status === 'READY' ? '✅' : 
                        doc.status === 'EMBEDDING' ? '⏳' :
                        doc.status === 'PARSING' ? '⏳' : '❌'
      
      console.log(`${statusIcon} ${doc.filename}`)
      console.log(`   ID: ${doc.id}`)
      console.log(`   状态: ${doc.status}`)
      console.log(`   记录的chunks: ${doc.chunksCount}`)
      console.log(`   实际chunks: ${actualChunks.length}`)
      console.log(`   用户ID: ${doc.userId}`)
      console.log(`   上传时间: ${doc.uploadedAt.toLocaleString('zh-CN')}`)
      
      if (doc.status === 'READY' && actualChunks.length > 0) {
        console.log(`   ✅ 可以用于问答`)
      } else if (doc.status !== 'READY') {
        console.log(`   ⚠️  需要等待处理完成`)
      } else if (actualChunks.length === 0) {
        console.log(`   ❌ 状态异常：标记为READY但没有chunks`)
      }
      console.log('')
    }

    // 统计
    const readyDocs = allDocs.filter(d => d.status === 'READY' && d.chunksCount > 0)
    console.log(`\n📈 统计:`)
    console.log(`   总文档数: ${allDocs.length}`)
    console.log(`   可用文档: ${readyDocs.length}`)
    console.log(`   处理中文档: ${allDocs.filter(d => d.status !== 'READY').length}`)

    if (readyDocs.length > 0) {
      console.log(`\n✅ 可以使用以下文档ID进行测试:`)
      readyDocs.forEach(d => {
        console.log(`   - ${d.id} (${d.filename})`)
      })
    } else {
      console.log(`\n⚠️  没有可用的文档，请确保文档已上传并处理完成`)
    }

  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    process.exit(0)
  }
}

checkDocumentStatus()
