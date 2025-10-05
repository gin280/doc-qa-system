'use client'

import { useState } from 'react'
import { Document } from '@/hooks/useDocuments'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface Props {
  document: Document | null
  open: boolean
  onClose: () => void
  onConfirm: (id: string) => Promise<void>
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function DocumentDeleteDialog({ document, open, onClose, onConfirm }: Props) {
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    if (!document) return

    setIsLoading(true)
    try {
      await onConfirm(document.id)
      toast.success('删除成功', {
        description: `文档 "${document.filename}" 已删除`
      })
      onClose()
    } catch (err) {
      toast.error('删除失败', {
        description: err instanceof Error ? err.message : '删除文档时发生错误'
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!document) return null

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除文档?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p className="mb-2">此操作无法撤销。将永久删除以下文档:</p>
              <div className="mt-2 p-3 bg-muted rounded-md">
                <p className="font-semibold">{document.filename}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  大小: {formatFileSize(document.fileSize)}
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? '删除中...' : '确认删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
