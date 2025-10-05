'use client'

import { useState } from 'react'
import { DocumentCard } from './DocumentCard'
import { DocumentRenameDialog } from './DocumentRenameDialog'
import { DocumentDeleteDialog } from './DocumentDeleteDialog'
import { DocumentPreviewModal } from './DocumentPreviewModal'
import { Skeleton } from '@/components/ui/skeleton'
import type { Document } from '@/hooks/useDocuments'
import { FileX } from 'lucide-react'

interface Props {
  documents: Document[]
  isLoading: boolean
  isError: boolean
  onRename: (id: string, newName: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function DocumentList({ 
  documents, 
  isLoading, 
  isError,
  onRename,
  onDelete
}: Props) {
  const [renameDoc, setRenameDoc] = useState<Document | null>(null)
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null)
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 加载状态
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-[280px] w-full rounded-lg" />
        ))}
      </div>
    )
  }

  // 错误状态
  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">加载文档失败,请刷新重试</p>
      </div>
    )
  }

  // 空状态
  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileX className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">暂无文档</h3>
        <p className="text-muted-foreground mt-2">
          点击右上角&quot;上传文档&quot;开始使用
        </p>
      </div>
    )
  }

  // 删除确认处理
  const handleDeleteConfirm = async (id: string) => {
    setDeletingId(id)
    try {
      await onDelete(id)
    } finally {
      setDeletingId(null)
    }
  }

  // 文档网格 - 使用 auto-rows-fr 确保所有卡片等高
  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            onRename={() => setRenameDoc(doc)}
            onDelete={() => setDeleteDoc(doc)}
            onPreview={() => setPreviewDoc(doc)}
            isDeleting={deletingId === doc.id}
          />
        ))}
      </div>

      {/* 对话框 */}
      <DocumentRenameDialog
        document={renameDoc}
        open={!!renameDoc}
        onClose={() => setRenameDoc(null)}
        onConfirm={onRename}
      />

      <DocumentDeleteDialog
        document={deleteDoc}
        open={!!deleteDoc}
        onClose={() => setDeleteDoc(null)}
        onConfirm={handleDeleteConfirm}
      />

      <DocumentPreviewModal
        document={previewDoc}
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </>
  )
}
