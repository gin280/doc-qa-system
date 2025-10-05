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
import { StorageService } from '@/services/documents/storageService'

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

    // 检查文件类型（基于扩展名和MIME类型的组合检查）
    // 因为浏览器对某些文件的MIME类型识别不一致
    const fileName = file.name.toLowerCase()
    const fileExt = fileName.match(/\.[^.]+$/)?.[0] || ''
    
    // 允许的文件扩展名
    const allowedExtensions = ['.pdf', '.docx', '.doc', '.md', '.txt']
    const hasValidExtension = allowedExtensions.includes(fileExt)
    
    // 检查MIME类型或文件扩展名
    // 对于.md和.txt文件，浏览器可能发送text/plain, text/markdown, 或application/octet-stream
    const isTextFile = ['.md', '.txt'].includes(fileExt) && 
      ['text/plain', 'text/markdown', 'application/octet-stream'].includes(file.type)
    
    const isAllowedType = ALLOWED_MIME_TYPES.includes(file.type) || 
      (hasValidExtension && isTextFile)
    
    if (!isAllowedType) {
      return NextResponse.json(
        { error: `不支持的文件格式: ${file.type}。请上传 PDF、Word、Markdown 或 TXT 文件` },
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
    
    // 规范化MIME类型：对于.md和.txt文件，如果浏览器发送的是application/octet-stream，
    // 需要转换为标准的文本类型，以便validateFileType能够正确处理
    let normalizedMimeType = file.type
    if (file.type === 'application/octet-stream' && ['.md', '.txt'].includes(fileExt)) {
      normalizedMimeType = fileExt === '.md' ? 'text/markdown' : 'text/plain'
    }
    
    const typeValidation = await validateFileType(buffer, normalizedMimeType)
    if (!typeValidation.valid) {
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

      // ==================== Story 2.2的新逻辑 ====================

      const documentId = createId()
      
      try {
        // 8. ✨ Story 2.2: 上传文件到Supabase Storage
        const storagePath = await StorageService.uploadFile(
          session.user.id,
          documentId,
          file,
          sanitizedFilename
        )

        // 9. ✨ 创建document记录(使用实际storage path)
        const [document] = await db.insert(documents).values({
          id: documentId,
          userId: session.user.id,
          filename: sanitizedFilename,
          fileSize: file.size,
          fileType: normalizedMimeType,  // 使用规范化后的MIME类型
          storagePath,  // 实际Storage路径
          status: 'PENDING',
          chunksCount: 0,
          contentLength: 0,
          metadata: {
            originalFilename: file.name,
            originalMimeType: file.type,  // 保留原始类型用于追溯
            uploadedFrom: req.headers.get('user-agent') || 'unknown',
            validatedType: typeValidation.detectedType,
            supabaseMetadata: {
              bucket: 'documents',
              path: storagePath
            }
          }
        }).returning()

        // 10. ✨ 更新userUsage统计(原子操作)
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

        // 如果更新失败（竞态条件），清理Storage和数据库
        if (updateResult.length === 0) {
          // 回滚: 删除Storage文件
          try {
            await StorageService.deleteFile(storagePath)
          } catch (cleanupError) {
            console.error('Storage cleanup error:', cleanupError)
          }
          
          // 回滚: 删除document记录
          await db.delete(documents).where(eq(documents.id, documentId))
          
          return NextResponse.json(
            { error: '配额检查失败，请重试' },
            { status: 409 }
          )
        }

        // 11. Story 2.3: 触发异步解析(不等待完成)
        // 使用异步调用,不阻塞上传响应
        fetch(`${req.nextUrl.origin}/api/documents/${document.id}/parse`, {
          method: 'POST',
          headers: {
            'Cookie': req.headers.get('Cookie') || ''
          }
        }).catch(err => {
          console.error('[Upload] Failed to trigger parsing:', err)
          // 解析失败不影响上传成功响应
        })

        // 12. 返回成功响应
        return NextResponse.json({
          success: true,
          documents: [{
            id: document.id,
            filename: document.filename,
            status: document.status,
            uploadedAt: document.uploadedAt
          }]
        })

      } catch (uploadError) {
        // ==================== 错误回滚处理 ====================
        
        console.error('[Upload] Storage upload error:', uploadError)
        
        // 回滚: 删除Storage文件(如果已上传)
        try {
          const fileExtension = sanitizedFilename.match(/\.[^.]+$/)?.[0] || ''
          const storagePath = `${session.user.id}/${documentId}${fileExtension}`
          await StorageService.deleteFile(storagePath)
        } catch (cleanupError) {
          console.error('[Cleanup] Failed to delete storage file:', cleanupError)
        }

        // 回滚: 删除document记录(如果已创建)
        try {
          await db.delete(documents).where(eq(documents.id, documentId))
        } catch (cleanupError) {
          console.error('[Cleanup] Failed to delete document record:', cleanupError)
        }

        // 提供更友好的错误消息
        let userMessage = '文件上传失败'
        let errorDetails = uploadError instanceof Error ? uploadError.message : 'Unknown error'
        
        // 检查是否是Supabase相关错误
        if (errorDetails.includes('Bucket not found') || errorDetails.includes('bucket')) {
          userMessage = 'Storage配置错误：请确保Supabase Storage bucket "documents" 已创建'
          errorDetails = 'Supabase Storage bucket "documents" not found. Please create it in Supabase Dashboard.'
        } else if (errorDetails.includes('permission') || errorDetails.includes('policy')) {
          userMessage = 'Storage权限错误：请检查RLS policies配置'
          errorDetails = 'Permission denied. Please check Supabase RLS policies for the documents bucket.'
        } else if (errorDetails.includes('timeout') || errorDetails.includes('network')) {
          userMessage = '网络超时，请检查网络连接后重试'
        }

        return NextResponse.json(
          { 
            error: userMessage,
            details: errorDetails
          },
          { status: 500 }
        )
      }

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

