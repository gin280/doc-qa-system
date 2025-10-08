/**
 * Documents Page - 文档管理页面
 * Story 2.5: 文档列表与管理
 * Story 1.10: 使用AppHeader,简化布局
 */

'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { DocumentList } from '@/components/documents/DocumentList'
import { DocumentSearchBar } from '@/components/documents/DocumentSearchBar'
import { DocumentPagination } from '@/components/documents/DocumentPagination'
import { DocumentUploadModal } from '@/components/documents/DocumentUploadModal'
import { Button } from '@/components/ui/button'
import { useDocuments } from '@/hooks/useDocuments'
import { Upload } from 'lucide-react'

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
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* 页面头部 */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">我的文档</h1>
            <p className="text-muted-foreground mt-2">
              共 {total} 个文档 · 支持 PDF、Word、Markdown 等格式
            </p>
          </div>
          <Button 
            onClick={() => setUploadModalOpen(true)}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            上传文档
          </Button>
        </div>
      </div>

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

      {/* 上传模态框 */}
      <DocumentUploadModal 
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
      />
    </div>
  )
}
