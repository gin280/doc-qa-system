/**
 * DocumentSelector - 文档选择器组件
 * Story 3.1: 问答界面与输入处理
 */

'use client'

import { useDocuments } from '@/hooks/useDocuments'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileText, File, FileType, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value?: string
  onChange: (documentId: string) => void
  className?: string
}

/**
 * 根据文件类型返回图标
 */
function getFileIcon(fileType: string) {
  switch (fileType.toLowerCase()) {
    case 'pdf':
      return <FileText className="h-4 w-4 text-red-500" />
    case 'docx':
    case 'doc':
      return <FileType className="h-4 w-4 text-blue-500" />
    case 'txt':
    case 'md':
      return <File className="h-4 w-4 text-gray-500" />
    default:
      return <FileText className="h-4 w-4 text-gray-500" />
  }
}

/**
 * 文档选择器组件
 */
export function DocumentSelector({ value, onChange, className }: Props) {
  const { documents, isLoading, isError } = useDocuments()

  // 分类文档：处理完成的和正在处理的
  const allDocuments = documents ?? []
  const readyDocuments = allDocuments.filter(doc => doc.status === 'READY')
  const processingDocuments = allDocuments.filter(doc => 
    ['PENDING', 'PARSING', 'EMBEDDING'].includes(doc.status)
  )

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>加载文档列表...</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className={cn("text-sm text-destructive", className)}>
        加载文档失败
      </div>
    )
  }

  if (allDocuments.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        暂无文档，请先上传文档
      </div>
    )
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("w-full", className)} aria-label="选择文档">
        <SelectValue placeholder="选择文档..." />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {/* 可用文档 */}
          {readyDocuments.map((doc) => (
            <SelectItem key={doc.id} value={doc.id}>
              <div className="flex items-center gap-2">
                {getFileIcon(doc.fileType)}
                <span className="truncate">{doc.filename}</span>
              </div>
            </SelectItem>
          ))}
          
          {/* 正在处理的文档 - 禁用状态 */}
          {processingDocuments.map((doc) => (
            <SelectItem key={doc.id} value={doc.id} disabled>
              <div className="flex items-center gap-2 opacity-60">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="truncate">{doc.filename}</span>
                <span className="text-xs text-muted-foreground">(处理中...)</span>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
