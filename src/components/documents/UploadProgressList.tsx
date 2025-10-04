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
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-foreground">
          上传列表 ({items.length})
        </h3>
        <p className="text-xs text-muted-foreground">
          {items.filter(i => i.status === 'success').length} / {items.length} 完成
        </p>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
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
    <div className={cn(
      "group relative flex items-start gap-3 p-4 rounded-lg border transition-all duration-200",
      item.status === 'success' && "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900",
      item.status === 'error' && "bg-destructive/5 border-destructive/30",
      item.status === 'uploading' && "bg-primary/5 border-primary/30",
      item.status === 'pending' && "bg-muted/50 border-border"
    )}>
      {/* 文件图标 */}
      <div className={cn(
        "flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0",
        item.status === 'success' && "bg-green-100 dark:bg-green-900/30",
        item.status === 'error' && "bg-destructive/10",
        item.status === 'uploading' && "bg-primary/10",
        item.status === 'pending' && "bg-muted"
      )}>
        <FileText className={cn(
          "h-5 w-5",
          item.status === 'success' && "text-green-600 dark:text-green-500",
          item.status === 'error' && "text-destructive",
          item.status === 'uploading' && "text-primary",
          item.status === 'pending' && "text-muted-foreground"
        )} />
      </div>
      
      {/* 内容区域 */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* 文件名和大小 */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate flex-1">
              {item.file.name}
            </p>
            <StatusIcon 
              className={cn(
                'h-5 w-5 flex-shrink-0', 
                statusColor,
                isAnimating && 'animate-spin'
              )} 
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(item.file.size)}
          </p>
        </div>

        {/* 上传进度 */}
        {item.status === 'uploading' && (
          <div className="space-y-1.5">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full bg-primary rounded-full transition-all duration-300 ease-out",
                  item.progress >= 95 && "animate-pulse"
                )}
                style={{ width: `${item.progress}%` }}
                role="progressbar"
                aria-valuenow={item.progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {item.progress >= 95 ? '服务器处理中...' : `上传中 ${item.progress}%`}
            </p>
          </div>
        )}

        {/* 错误信息 */}
        {item.status === 'error' && item.error && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">{item.error}</p>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {item.status === 'uploading' && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3"
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
            className="h-8 px-3"
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
            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
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

