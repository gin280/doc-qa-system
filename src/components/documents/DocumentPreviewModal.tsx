'use client'

import { useEffect, useState } from 'react'
import { Document } from '@/hooks/useDocuments'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { PreviewErrorBoundary } from '@/components/ui/error-boundary'

interface Props {
  document: Document | null
  open: boolean
  onClose: () => void
}

interface PreviewData {
  content: string
  truncated: boolean
  totalLength: number
  fileType: string
}

export function DocumentPreviewModal({ document, open, onClose }: Props) {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      if (!document) return

      setIsLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/documents/${document.id}/preview`)
        if (!response.ok) {
          throw new Error('获取预览失败')
        }
        const data = await response.json()
        setPreviewData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载预览失败')
      } finally {
        setIsLoading(false)
      }
    }

    if (open && document) {
      fetchData()
    }
  }, [open, document])


  const handleDownload = () => {
    if (document) {
      window.open(`/api/documents/${document.id}/download`, '_blank')
    }
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="text-center py-12 text-destructive">
          {error}
        </div>
      )
    }

    if (!previewData) {
      return null
    }

    const isMarkdown = document?.fileType.includes('markdown')

    return (
      <PreviewErrorBoundary 
        onDownload={handleDownload}
      >
        <div className="max-h-[60vh] overflow-y-auto">
          {isMarkdown ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>
                {previewData.content}
              </ReactMarkdown>
            </div>
          ) : (
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-4 rounded-md">
              {previewData.content}
            </pre>
          )}
          {previewData.truncated && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              显示前 500 字符，共 {previewData.totalLength} 字符
            </p>
          )}
        </div>
      </PreviewErrorBoundary>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{document?.filename}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span>文档预览</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="ml-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              下载原文件
            </Button>
          </DialogDescription>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
