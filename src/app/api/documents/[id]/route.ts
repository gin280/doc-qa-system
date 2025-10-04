import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { documents, userUsage } from '@/drizzle/schema'
import { eq, and, sql } from 'drizzle-orm'
import { StorageService } from '@/services/documents/storageService'

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

    // 3. 先删除Storage文件
    // 注意：Storage操作不受数据库事务控制，所以先执行
    // 如果失败，记录错误但继续删除数据库记录（可通过后台任务清理孤儿文件）
    try {
      await StorageService.deleteFile(document.storagePath)
    } catch (storageError) {
      console.error('Storage deletion failed, continuing with DB cleanup:', storageError)
      // 注意：生产环境应该记录这个失败到监控系统，并有后台清理任务
      // TODO: 将失败的storagePath记录到孤儿文件清理队列
    }

    // 4. 然后使用事务删除数据库记录
    await db.transaction(async (tx) => {
      // 4.1 删除数据库记录(级联删除chunks)
      await tx.delete(documents).where(eq(documents.id, params.id))

      // 4.2 更新userUsage统计
      await tx.update(userUsage)
        .set({
          documentCount: sql`${userUsage.documentCount} - 1`,
          storageUsed: sql`${userUsage.storageUsed} - ${document.fileSize}`,
          updatedAt: new Date()
        })
        .where(eq(userUsage.userId, session.user.id))
    })

    return NextResponse.json({
      success: true,
      message: '文档删除成功'
    })

  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json(
      { error: '删除文档失败' },
      { status: 500 }
    )
  }
}

