'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileDropzone } from './FileDropzone'
import { UploadProgressList } from './UploadProgressList'
import { useDocumentUpload } from '@/hooks/useDocumentUpload'

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

  const handleClose = () => {
    if (isUploading) {
      const confirm = window.confirm('文件正在上传中，确定要关闭吗？')
      if (!confirm) return
    }
    onOpenChange(false)
  }

  const completedCount = items.filter(i => i.status === 'success').length
  const failedCount = items.filter(i => i.status === 'error').length
  const canClose = !isUploading || items.every(i => i.status === 'success' || i.status === 'error')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  {completedCount > 0 && (
                    <span className="text-green-600 dark:text-green-500">
                      {completedCount} 个成功
                    </span>
                  )}
                  {failedCount > 0 && (
                    <span className="text-destructive ml-2">
                      {failedCount} 个失败
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {canClose && items.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAll}
                    >
                      清空列表
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleClose}
                    disabled={!canClose}
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

