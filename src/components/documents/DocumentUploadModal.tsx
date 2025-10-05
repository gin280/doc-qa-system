'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileDropzone } from './FileDropzone'
import { UploadProgressList } from './UploadProgressList'
import { useDocumentUpload } from '@/hooks/useDocumentUpload'
import { mutate } from 'swr'

interface DocumentUploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DocumentUploadModal({ open, onOpenChange }: DocumentUploadModalProps) {
  const {
    items,
    isUploading,
    addFiles,
    cancelUpload,
    retryUpload,
    removeItem,
    clearAll
  } = useDocumentUpload()

  const handleFilesSelected = (files: File[]) => {
    addFiles(files)
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // 关闭时检查是否正在上传
      if (isUploading) {
        const confirmed = window.confirm('文件正在上传中，确定要关闭吗？')
        if (!confirmed) return
      }
      
      // 如果有成功上传的文档，刷新文档列表
      const hasSuccess = items.some(i => i.status === 'success')
      if (hasSuccess) {
        // 使用 mutate 刷新所有文档列表查询
        mutate(
          (key) => typeof key === 'string' && key.startsWith('/api/documents'),
          undefined,
          { revalidate: true }
        )
      }
      
      // 关闭时自动清空列表
      clearAll()
    }
    
    onOpenChange(isOpen)
  }

  const handleComplete = () => {
    // 如果有成功上传的文档，刷新文档列表
    const hasSuccess = items.some(i => i.status === 'success')
    if (hasSuccess) {
      // 使用 mutate 刷新所有文档列表查询
      mutate(
        (key) => typeof key === 'string' && key.startsWith('/api/documents'),
        undefined,
        { revalidate: true }
      )
    }
    
    // 点击"完成"按钮时，清空列表并关闭
    clearAll()
    onOpenChange(false)
  }

  const completedCount = items.filter(i => i.status === 'success').length
  const failedCount = items.filter(i => i.status === 'error').length
  const canClose = !isUploading || items.every(i => i.status === 'success' || i.status === 'error')

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>上传文档</DialogTitle>
          <DialogDescription>
            支持 PDF、Word、Markdown、TXT 格式，单文件最大 50MB
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <FileDropzone 
            onFilesSelected={handleFilesSelected}
            disabled={isUploading}
          />

          {items.length > 0 && (
            <>
              <UploadProgressList
                items={items}
                onCancel={cancelUpload}
                onRetry={retryUpload}
                onRemove={removeItem}
              />

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="flex items-center gap-3 text-sm">
                  {completedCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-600 dark:bg-green-500" />
                      <span className="text-green-600 dark:text-green-500 font-medium">
                        {completedCount} 个成功
                      </span>
                    </div>
                  )}
                  {failedCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-destructive" />
                      <span className="text-destructive font-medium">
                        {failedCount} 个失败
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleComplete}
                    disabled={!canClose}
                    className="min-w-[80px]"
                  >
                    {isUploading ? '上传中...' : '完成'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

