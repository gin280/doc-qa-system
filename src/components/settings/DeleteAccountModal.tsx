'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
  userEmail: string
}

export function DeleteAccountModal({ open, onClose, userEmail }: Props) {
  const [emailConfirmation, setEmailConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    if (emailConfirmation !== userEmail) {
      toast.error('邮箱输入不匹配,请重新输入')
      return
    }

    setIsDeleting(true)
    try {
      const res = await fetch('/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailConfirmation })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '删除账户失败')
      }

      // 清除客户端存储
      localStorage.clear()
      sessionStorage.clear()

      // 登出并跳转
      await signOut({ redirect: false })
      router.push('/')
      toast.success('账户已删除')
    } catch (error: any) {
      toast.error(error.message || '删除账户失败,请重试')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleClose = () => {
    setEmailConfirmation('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">删除账户</DialogTitle>
          <DialogDescription>
            ⚠️ 此操作无法撤销!您的所有数据将被永久删除,包括:
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm text-muted-foreground mb-4 list-disc list-inside">
          <li>所有上传的文档</li>
          <li>所有对话历史记录</li>
          <li>个人资料和使用量统计</li>
        </ul>

        <div className="space-y-4">
          <div>
            <Label htmlFor="emailConfirmation">
              请输入您的邮箱以确认删除:
            </Label>
            <Input
              id="emailConfirmation"
              type="email"
              value={emailConfirmation}
              onChange={(e) => setEmailConfirmation(e.target.value)}
              placeholder={userEmail}
            />
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={emailConfirmation !== userEmail || isDeleting}
          >
            {isDeleting ? '删除中...' : '确认删除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

