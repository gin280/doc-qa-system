import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents, userUsage } from '@/drizzle/schema'
import { eq, sql } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { 
  validateFileType, 
  validateFileSize, 
  sanitizeFilename,
  validateFileExtension 
} from '@/lib/file-validator'

const MAX_DOCUMENTS_PER_USER = 50
const MAX_STORAGE_PER_USER = 500 * 1024 * 1024  // 500MB

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/markdown',
  'text/plain'
]

/**
 * POST /api/documents/upload
 * 
 * 上传单个文档文件
 * 
 * Security Features:
 * - SEC-001: Magic Bytes 文件签名验证
 * - SEC-001: 文件名清理（防止路径遍历）
 * - DATA-001: 原子配额检查（防止竞态条件）
 * - PERF-002: 客户端已限制批量大小
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 认证检查
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      )
    }

    // 2. 获取文件
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: '未找到文件' },
        { status: 400 }
      )
    }

    // 3. 基本验证
    const sizeValidation = validateFileSize(file.size)
    if (!sizeValidation.valid) {
      return NextResponse.json(
        { error: sizeValidation.error },
        { status: 400 }
      )
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: '不支持的文件格式' },
        { status: 400 }
      )
    }

    // 4. 文件扩展名验证
    const extValidation = validateFileExtension(file.name, file.type)
    if (!extValidation.valid) {
      return NextResponse.json(
        { error: extValidation.error },
        { status: 400 }
      )
    }

    // 5. SEC-001: Magic Bytes 验证
    // 读取文件内容进行签名验证
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    const typeValidation = await validateFileType(buffer, file.type)
    if (!typeValidation.valid) {
      console.warn('File type validation failed:', {
        filename: file.name,
        declared: file.type,
        detected: typeValidation.detectedType,
        error: typeValidation.error
      })
      
      return NextResponse.json(
        { error: typeValidation.error || '文件类型验证失败' },
        { status: 400 }
      )
    }

    // 6. SEC-001: 清理文件名
    const sanitizedFilename = sanitizeFilename(file.name)

    // 7. DATA-001: 原子配额检查
    // 使用数据库原子操作防止竞态条件
    try {
      // 查询当前使用量
      const [usage] = await db.select()
        .from(userUsage)
        .where(eq(userUsage.userId, session.user.id))

      if (!usage) {
        // 创建使用量记录
        await db.insert(userUsage).values({
          userId: session.user.id,
          documentCount: 0,
          storageUsed: 0,
          queryCount: 0,
          queryResetDate: new Date()
        })
      } else {
        // 检查配额
        if (usage.documentCount >= MAX_DOCUMENTS_PER_USER) {
          return NextResponse.json(
            { 
              error: `文档数量已达上限(${MAX_DOCUMENTS_PER_USER}个)`,
              details: {
                current: usage.documentCount,
                limit: MAX_DOCUMENTS_PER_USER
              }
            },
            { status: 400 }
          )
        }

        if (usage.storageUsed + file.size > MAX_STORAGE_PER_USER) {
          return NextResponse.json(
            { 
              error: '存储空间不足',
              details: {
                current: usage.storageUsed,
                needed: file.size,
                limit: MAX_STORAGE_PER_USER
              }
            },
            { status: 400 }
          )
        }
      }

      // 8. 创建文档记录 (PENDING 状态)
      // 注意: 实际文件存储将在 Story 2.2 中实现
      const documentId = createId()
      const storagePath = `${session.user.id}/${documentId}_${sanitizedFilename}`

      const [document] = await db.insert(documents).values({
        id: documentId,
        userId: session.user.id,
        filename: sanitizedFilename,
        fileSize: file.size,
        fileType: file.type,
        storagePath,
        status: 'PENDING',
        chunksCount: 0,
        contentLength: 0,
        metadata: {
          originalFilename: file.name,
          uploadedFrom: req.headers.get('user-agent') || 'unknown',
          validatedType: typeValidation.detectedType
        }
      }).returning()

      // 9. DATA-001: 使用原子操作更新配额
      // 使用 WHERE 条件确保不会超出限制
      const updateResult = await db.update(userUsage)
        .set({
          documentCount: sql`${userUsage.documentCount} + 1`,
          storageUsed: sql`${userUsage.storageUsed} + ${file.size}`
        })
        .where(
          sql`${userUsage.userId} = ${session.user.id} 
              AND ${userUsage.documentCount} < ${MAX_DOCUMENTS_PER_USER}
              AND ${userUsage.storageUsed} + ${file.size} <= ${MAX_STORAGE_PER_USER}`
        )
        .returning()

      // 如果更新失败（竞态条件），删除刚创建的文档记录
      if (updateResult.length === 0) {
        await db.delete(documents).where(eq(documents.id, documentId))
        
        return NextResponse.json(
          { error: '配额检查失败，请重试' },
          { status: 409 }
        )
      }

      // 10. 返回成功响应
      return NextResponse.json({
        success: true,
        documents: [{
          id: document.id,
          filename: document.filename,
          status: document.status
        }]
      })

    } catch (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: '数据库操作失败' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    )
  }
}

/**
 * Route Segment Config
 * PERF-001: 提高内存限制和超时时间
 * 内存配置在 vercel.json 中设置
 */
export const maxDuration = 300 // 5 minutes

