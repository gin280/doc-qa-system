'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DocumentStatusBadge } from './DocumentStatusBadge'
import type { Document } from '@/hooks/useDocuments'
import { FileText, FileCode, File, MoreVertical, Eye, Edit, Trash, Clock, HardDrive, Layers, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

interface Props {
  document: Document
  onRename: () => void
  onDelete: () => void
  onPreview: () => void
  isDeleting?: boolean
}

/**
 * 根据文件类型返回精美图标
 */
function getFileIcon(fileType: string) {
  if (fileType.includes('pdf')) {
    return (
      <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-pink-500/20 flex items-center justify-center shadow-lg shadow-red-500/20 ring-1 ring-red-500/30">
        <FileText className="h-7 w-7 text-red-600 dark:text-red-400" />
      </div>
    )
  }
  if (fileType.includes('word') || fileType.includes('document')) {
    return (
      <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-blue-500/30">
        <FileText className="h-7 w-7 text-blue-600 dark:text-blue-400" />
      </div>
    )
  }
  if (fileType.includes('markdown')) {
    return (
      <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center shadow-lg shadow-purple-500/20 ring-1 ring-purple-500/30">
        <FileCode className="h-7 w-7 text-purple-600 dark:text-purple-400" />
      </div>
    )
  }
  return (
    <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center shadow-lg ring-1 ring-border">
      <File className="h-7 w-7 text-muted-foreground" />
    </div>
  )
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function DocumentCard({ document, onRename, onDelete, onPreview, isDeleting = false }: Props) {
  return (
    <Card className={`group relative flex flex-col h-full p-6 transition-all duration-300 bg-gradient-to-br from-card to-card/50 ${
      isDeleting 
        ? 'opacity-30 pointer-events-none scale-95 blur-sm' 
        : 'hover:shadow-xl hover:shadow-primary/5 hover:border-primary/50 hover:-translate-y-1'
    }`}>
      {/* 删除中的遮罩层 */}
      {isDeleting && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-destructive" />
            <span className="text-sm font-medium text-destructive">删除中...</span>
          </div>
        </div>
      )}
      {/* 头部：图标和操作菜单 */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
          {getFileIcon(document.fileType)}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-primary/10"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onPreview}>
              <Eye className="mr-2 h-4 w-4" />
              预览
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRename}>
              <Edit className="mr-2 h-4 w-4" />
              重命名
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash className="mr-2 h-4 w-4" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 文件名 */}
      <h3 className="font-semibold text-lg mb-3 line-clamp-2 min-h-[3.5rem] group-hover:text-primary transition-colors" title={document.filename}>
        {document.filename}
      </h3>

      {/* 状态徽章 */}
      <div className="mb-4">
        <DocumentStatusBadge status={document.status} />
      </div>

      {/* 文件信息 - 固定在底部 */}
      <div className="mt-auto space-y-3 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <HardDrive className="h-3.5 w-3.5" />
          <span className="flex-1">大小</span>
          <span className="font-medium text-foreground">{formatFileSize(document.fileSize)}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span className="flex-1">上传</span>
          <span className="font-medium text-foreground">
            {formatDistanceToNow(new Date(document.uploadedAt), {
              addSuffix: true,
              locale: zhCN
            })}
          </span>
        </div>

        {document.status === 'READY' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            <span className="flex-1">文档块</span>
            <span className="font-semibold text-primary">{document.chunksCount} 个</span>
          </div>
        )}
      </div>
    </Card>
  )
}
