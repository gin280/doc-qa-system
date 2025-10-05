'use client'

import { useState } from 'react'
import { Document } from '@/hooks/useDocuments'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface Props {
  document: Document | null
  open: boolean
  onClose: () => void
  onConfirm: (id: string, newName: string) => Promise<void>
}

export function DocumentRenameDialog({ document, open, onClose, onConfirm }: Props) {
  const [baseName, setBaseName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // 获取文件扩展名
  const getFileExtension = (filename: string): string => {
    const lastDot = filename.lastIndexOf('.')
    return lastDot > 0 ? filename.substring(lastDot) : ''
  }

  // 获取基础文件名（不含扩展名）
  const getBaseName = (filename: string): string => {
    const lastDot = filename.lastIndexOf('.')
    return lastDot > 0 ? filename.substring(0, lastDot) : filename
  }

  // 当对话框打开时,初始化文件名（只显示基础名称）
  useState(() => {
    if (document) {
      setBaseName(getBaseName(document.filename))
    }
  })

  // 获取当前文档的扩展名
  const fileExtension = document ? getFileExtension(document.filename) : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!document) return

    // 验证基础文件名
    const trimmed = baseName.trim()
    if (!trimmed) {
      setError('文件名不能为空')
      return
    }

    // 组合完整文件名（基础名 + 扩展名）
    const fullFilename = trimmed + fileExtension

    if (fullFilename.length > 255) {
      setError('文件名过长')
      return
    }

    const invalidChars = /[\/\\:*?"<>|]/
    if (invalidChars.test(trimmed)) {
      setError('文件名包含非法字符')
      return
    }

    if (fullFilename === document.filename) {
      onClose()
      return
    }

    setIsLoading(true)
    try {
      await onConfirm(document.id, fullFilename)
      toast.success('重命名成功', {
        description: `文件已重命名为 "${fullFilename}"`
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '重命名失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>重命名文档</DialogTitle>
            <DialogDescription>
              为文档设置新的名称
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div>
              <Label htmlFor="filename">文件名</Label>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  id="filename"
                  value={baseName}
                  onChange={(e) => {
                    setBaseName(e.target.value)
                    setError('')
                  }}
                  placeholder="输入新文件名"
                  className="flex-1"
                  autoFocus
                />
                <span className="text-sm text-muted-foreground font-mono bg-muted px-3 py-2 rounded-md border">
                  {fileExtension}
                </span>
              </div>
              {error && (
                <p className="text-sm text-destructive mt-2">{error}</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              💡 提示：文件扩展名 <code className="bg-muted px-1 rounded">{fileExtension}</code> 将自动保留
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? '重命名中...' : '确认'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
