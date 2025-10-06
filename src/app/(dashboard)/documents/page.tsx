'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { DocumentList } from '@/components/documents/DocumentList'
import { DocumentSearchBar } from '@/components/documents/DocumentSearchBar'
import { DocumentPagination } from '@/components/documents/DocumentPagination'
import { DocumentUploadModal } from '@/components/documents/DocumentUploadModal'
import { Button } from '@/components/ui/button'
import { useDocuments } from '@/hooks/useDocuments'
import { Upload, ArrowLeft, MessageSquare } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export default function DocumentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  
  // URL状态管理
  const page = Number(searchParams.get('page')) || 1
  const search = searchParams.get('search') || ''
  const sortBy = (searchParams.get('sortBy') || 'uploadedAt') as 'uploadedAt' | 'filename' | 'fileSize' | 'status'
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

  // 获取文档数据
  const { 
    documents, 
    total, 
    totalPages,
    currentPage,
    isLoading, 
    isError,
    renameDocument,
    deleteDocument
  } = useDocuments({
    page,
    search,
    sortBy,
    sortOrder
  })

  // 更新URL参数 - 使用replace避免历史记录堆积
  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    router.replace(`/documents?${params.toString()}`)
  }

  // 页面切换时滚动到顶部
  const handlePageChange = (newPage: number) => {
    updateParams({ page: String(newPage) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* 左侧：返回按钮和标题 */}
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold">我的文档</h1>
                <p className="text-sm text-muted-foreground">
                  共 {total} 个文档
                </p>
              </div>
            </div>

            {/* 右侧：操作按钮 */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link href="/chat">
                <Button 
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">智能问答</span>
                </Button>
              </Link>
              <Button 
                variant="default"
                size="sm"
                onClick={() => setUploadModalOpen(true)}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">上传文档</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="container mx-auto py-6 px-4">
        {/* 搜索和排序栏 */}
        <DocumentSearchBar
          value={search}
          onSearch={(value) => updateParams({ search: value, page: '1' })}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(by, order) => updateParams({ sortBy: by, sortOrder: order })}
        />

        {/* 文档列表 */}
        <DocumentList
          documents={documents}
          isLoading={isLoading}
          isError={isError}
          onRename={renameDocument}
          onDelete={deleteDocument}
        />

        {/* 分页器 */}
        {totalPages > 1 && (
          <DocumentPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </main>

      {/* 上传模态框 */}
      <DocumentUploadModal 
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
      />
    </div>
  )
}