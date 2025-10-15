// src/components/chat/ExportButton.tsx
'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface ExportButtonProps {
  conversationId: string
  conversationTitle?: string
  className?: string
}

/**
 * 对话导出按钮 - 仅支持 Markdown 格式
 */
export function ExportButton({ conversationId, conversationTitle = '对话记录', className }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)

    try {
      // 调用导出 API
      const response = await fetch(
        `/api/conversations/${conversationId}/export?format=markdown`
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '导出失败')
      }

      // 获取文件内容
      const blob = await response.blob()
      
      // 从响应头获取文件名
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `${conversationTitle}.md`
      
      if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition)
        if (matches?.[1]) {
          filename = decodeURIComponent(matches[1].replace(/['"]/g, ''))
        }
      }

      // 下载文件
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      
      // 延迟清理，确保下载开始
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }, 100)

    } catch (error: any) {
      console.error('Export failed:', error)
      
      // 根据错误类型显示不同的用户提示
      if (error.message?.includes('未授权') || error.message?.includes('401')) {
        toast.error('认证失败，请重新登录')
      } else if (error.message?.includes('对话不存在') || error.message?.includes('404')) {
        toast.error('对话不存在或已删除')
      } else if (error.message?.includes('频繁') || error.message?.includes('429')) {
        toast.error('操作过于频繁，请稍后再试')
      } else if (error.message?.includes('权限') || error.message?.includes('403')) {
        toast.error('无权导出此对话')
      } else {
        // 通用错误，提供重试选项
        toast.error('导出失败，请重试', {
          action: {
            label: '重试',
            onClick: handleExport
          }
        })
      }
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isExporting}
      onClick={handleExport}
      className={className}
    >
      {isExporting ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          导出中...
        </>
      ) : (
        <>
          <Download className="h-4 w-4 mr-2" />
          导出
        </>
      )}
    </Button>
  )
}
