'use client'

import { Button } from '@/components/ui/button'
import { FileText, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error'

export interface UploadItem {
  id: string
  file: File
  progress: number
  status: UploadStatus
  error?: string
  documentId?: string
}

interface UploadProgressListProps {
  items: UploadItem[]
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  onRemove: (id: string) => void
}

export function UploadProgressList({
  items,
  onCancel,
  onRetry,
  onRemove
}: UploadProgressListProps) {
  if (items.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">
          上传队列 ({items.length})
        </h3>
        <p className="text-sm text-muted-foreground">
          {items.filter(i => i.status === 'success').length} / {items.length} 完成
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <UploadProgressItem
            key={item.id}
            item={item}
            onCancel={onCancel}
            onRetry={onRetry}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  )
}

function UploadProgressItem({
  item,
  onCancel,
  onRetry,
  onRemove
}: {
  item: UploadItem
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  onRemove: (id: string) => void
}) {
  const StatusIcon = {
    pending: Loader2,
    uploading: Loader2,
    success: CheckCircle,
    error: AlertCircle
  }[item.status]

  const statusColor = {
    pending: 'text-muted-foreground',
    uploading: 'text-primary',
    success: 'text-green-600 dark:text-green-500',
    error: 'text-destructive'
  }[item.status]

  const isAnimating = item.status === 'pending' || item.status === 'uploading'

  return (
    <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card">
      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-sm font-medium text-foreground truncate">
            {item.file.name}
          </p>
          <StatusIcon 
            className={cn(
              'h-4 w-4', 
              statusColor,
              isAnimating && 'animate-spin'
            )} 
          />
        </div>

        <p className="text-xs text-muted-foreground mb-2">
          {formatFileSize(item.file.size)}
        </p>

        {item.status === 'uploading' && (
          <div className="space-y-1">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${item.progress}%` }}
                role="progressbar"
                aria-valuenow={item.progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {item.progress}% 已上传
            </p>
          </div>
        )}

        {item.status === 'error' && item.error && (
          <p className="text-xs text-destructive">{item.error}</p>
        )}
      </div>

      <div className="flex gap-2">
        {item.status === 'uploading' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCancel(item.id)}
            aria-label={`取消上传 ${item.file.name}`}
          >
            取消
          </Button>
        )}
        
        {item.status === 'error' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRetry(item.id)}
            aria-label={`重试上传 ${item.file.name}`}
          >
            重试
          </Button>
        )}

        {(item.status === 'success' || item.status === 'error') && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRemove(item.id)}
            aria-label={`移除 ${item.file.name}`}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

