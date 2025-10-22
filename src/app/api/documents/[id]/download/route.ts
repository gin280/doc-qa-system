import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents } from '@/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { StorageService } from '@/services/documents/storageService'
import { logger } from '@/lib/logger'

export async function GET(
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

    // 3. 生成临时签名URL
    const signedUrl = await StorageService.getSignedUrl(
      document.storagePath,
      3600  // 1小时有效期
    )

    // 4. 返回signed URL
    return NextResponse.json({
      signedUrl,
      filename: document.filename,
      fileSize: document.fileSize,
      fileType: document.fileType,
      expiresIn: 3600
    })

  } catch (error) {
    logger.error({ error: error, action: 'error' }, 'Download error:')
    return NextResponse.json(
      { error: '获取下载链接失败' },
      { status: 500 }
    )
  }
}

