import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents } from '@/drizzle/schema'
import { eq, and, like, desc, asc, count } from 'drizzle-orm'

/**
 * GET /api/documents
 * 获取文档列表(支持分页、搜索、排序)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权,请先登录' },
        { status: 401 }
      )
    }

    // 解析查询参数
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Number(searchParams.get('limit')) || 20)
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'uploadedAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // 构建查询条件
    const conditions = [eq(documents.userId, session.user.id)]
    
    if (search) {
      conditions.push(like(documents.filename, `%${search}%`))
    }

    // 计算总数
    const [{ total }] = await db
      .select({ total: count() })
      .from(documents)
      .where(and(...conditions))

    // 构建排序
    let orderBy
    const orderFn = sortOrder === 'desc' ? desc : asc
    switch (sortBy) {
      case 'filename':
        orderBy = orderFn(documents.filename)
        break
      case 'fileSize':
        orderBy = orderFn(documents.fileSize)
        break
      case 'status':
        orderBy = orderFn(documents.status)
        break
      default:
        orderBy = orderFn(documents.uploadedAt)
    }

    // 查询文档
    const results = await db
      .select({
        id: documents.id,
        filename: documents.filename,
        fileSize: documents.fileSize,
        fileType: documents.fileType,
        status: documents.status,
        chunksCount: documents.chunksCount,
        uploadedAt: documents.uploadedAt,
        metadata: documents.metadata
      })
      .from(documents)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset((page - 1) * limit)

    return NextResponse.json({
      documents: results,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    })

  } catch (error) {
    console.error('List documents error:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}
