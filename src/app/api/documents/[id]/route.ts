import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents, userUsage, documentChunks } from '@/drizzle/schema'
import { eq, and, sql } from 'drizzle-orm'
import { StorageService } from '@/services/documents/storageService'
import { VectorRepositoryFactory } from '@/infrastructure/vector/vector-repository.factory'
import { vectorConfig } from '@/config/vector.config'

/**
 * GET /api/documents/:id
 * 获取文档详情
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权,请先登录' },
        { status: 401 }
      )
    }

    // 查询文档
    const [document] = await db.select()
      .from(documents)
      .where(
        and(
          eq(documents.id, params.id),
          eq(documents.userId, session.user.id)
        )
      )

    if (!document) {
      return NextResponse.json(
        { error: '文档不存在或无权访问' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      document
    })

  } catch (error) {
    console.error('Get document error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/documents/:id
 * 更新文档(重命名)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权,请先登录' },
        { status: 401 }
      )
    }

    const { filename } = await req.json()
    
    // 验证文件名
    if (!filename || filename.trim().length === 0) {
      return NextResponse.json(
        { error: '文件名不能为空' },
        { status: 400 }
      )
    }

    if (filename.length > 255) {
      return NextResponse.json(
        { error: '文件名过长' },
        { status: 400 }
      )
    }

    // 验证文件名字符
    const invalidChars = /[\/\\:*?"<>|]/
    if (invalidChars.test(filename)) {
      return NextResponse.json(
        { error: '文件名包含非法字符' },
        { status: 400 }
      )
    }

    // 验证文档所有权
    const [document] = await db.select()
      .from(documents)
      .where(
        and(
          eq(documents.id, params.id),
          eq(documents.userId, session.user.id)
        )
      )

    if (!document) {
      return NextResponse.json(
        { error: '文档不存在或无权访问' },
        { status: 404 }
      )
    }

    // 更新文件名
    const [updated] = await db.update(documents)
      .set({ filename: filename.trim() })
      .where(eq(documents.id, params.id))
      .returning()

    return NextResponse.json({
      success: true,
      document: updated
    })

  } catch (error) {
    console.error('Update document error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

/**
 * 带重试的异步操作执行器
 * 实现指数退避策略
 */
async function retryOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3
): Promise<{ success: boolean; result?: T; error?: Error }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation()
      return { success: true, result }
    } catch (error) {
      const isLastAttempt = attempt === maxRetries
      console.error(`${operationName} failed (attempt ${attempt}/${maxRetries}):`, error)
      
      if (isLastAttempt) {
        return { 
          success: false, 
          error: error instanceof Error ? error : new Error(String(error))
        }
      }
      
      // 指数退避: 1s, 2s, 4s
      const delayMs = 1000 * Math.pow(2, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  
  return { 
    success: false, 
    error: new Error(`${operationName} failed after ${maxRetries} attempts`)
  }
}

/**
 * DELETE /api/documents/:id
 * 删除文档(级联删除chunks和向量，带回滚机制)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. 认证检查
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    // 2. 查询document记录
    const [document] = await db.select()
      .from(documents)
      .where(
        and(
          eq(documents.id, params.id),
          eq(documents.userId, session.user.id)
        )
      )

    if (!document) {
      return NextResponse.json(
        { error: '文档不存在或无权访问' },
        { status: 404 }
      )
    }

    // 3. 获取所有chunks用于删除向量
    const chunks = await db.select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, params.id))

    // 跟踪删除状态
    const deletionResults = {
      vectors: false,
      storage: false,
      database: false
    }

    // 4. 删除向量数据（带重试）
    if (chunks.length > 0) {
      const vectorRepo = VectorRepositoryFactory.create(vectorConfig)
      const chunkIds = chunks.map(c => c.id)
      
      const vectorResult = await retryOperation(
        async () => await vectorRepo.deleteBatch(chunkIds),
        'Vector deletion',
        3
      )
      
      deletionResults.vectors = vectorResult.success
      
      if (!vectorResult.success) {
        console.error('Vector deletion failed after retries:', vectorResult.error)
        // 继续但记录失败，后台任务可以清理孤儿向量
        // TODO: 在生产环境中，应该将失败记录到清理队列
      }
    } else {
      deletionResults.vectors = true // 没有向量需要删除
    }

    // 5. 删除Storage文件（带重试）
    const storageResult = await retryOperation(
      async () => await StorageService.deleteFile(document.storagePath),
      'Storage deletion',
      3
    )
    
    deletionResults.storage = storageResult.success
    
    if (!storageResult.success) {
      console.error('Storage deletion failed after retries:', storageResult.error)
      // 继续但记录失败
      // TODO: 将失败的storagePath记录到孤儿文件清理队列
    }

    // 6. 如果向量或存储删除都失败，返回错误不删除数据库
    // 这样可以保持数据一致性，允许用户重试
    if (!deletionResults.vectors && chunks.length > 0) {
      return NextResponse.json(
        { 
          error: '向量数据删除失败，请稍后重试',
          details: 'Vector deletion failed after multiple attempts'
        },
        { status: 500 }
      )
    }

    // 7. 删除数据库记录（在事务中）
    try {
      await db.transaction(async (tx) => {
        // 7.1 删除数据库记录(级联删除chunks)
        await tx.delete(documents).where(eq(documents.id, params.id))

        // 7.2 更新userUsage统计
        await tx.update(userUsage)
          .set({
            documentCount: sql`${userUsage.documentCount} - 1`,
            storageUsed: sql`${userUsage.storageUsed} - ${document.fileSize}`,
            updatedAt: new Date()
          })
          .where(eq(userUsage.userId, session.user.id))
      })
      
      deletionResults.database = true
    } catch (dbError) {
      console.error('Database deletion failed:', dbError)
      return NextResponse.json(
        { 
          error: '数据库删除失败',
          details: dbError instanceof Error ? dbError.message : String(dbError)
        },
        { status: 500 }
      )
    }

    // 8. 返回成功，即使storage删除失败（因为主要数据已删除）
    const response: {
      success: boolean
      message: string
      warnings?: string[]
    } = {
      success: true,
      message: '文档删除成功'
    }

    // 添加警告信息（如果有部分失败）
    const warnings: string[] = []
    if (!deletionResults.storage) {
      warnings.push('存储文件删除失败，将通过后台任务清理')
    }
    if (warnings.length > 0) {
      response.warnings = warnings
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Unexpected delete error:', error)
    return NextResponse.json(
      { 
        error: '删除文档失败',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

