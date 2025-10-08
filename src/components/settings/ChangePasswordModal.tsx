'use client'

import { useState } from 'react'
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
}

export function ChangePasswordModal({ open, onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!currentPassword) {
      newErrors.currentPassword = '请输入当前密码'
    }

    if (!newPassword) {
      newErrors.newPassword = '请输入新密码'
    } else if (newPassword.length < 8) {
      newErrors.newPassword = '密码至少8位'
    } else if (!/^(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      newErrors.newPassword = '密码必须包含字母和数字'
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = '请确认新密码'
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = '两次密码输入不一致'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '密码修改失败')
      }

      toast.success('密码修改成功')
      handleClose()
    } catch (error: any) {
      toast.error(error.message || '密码修改失败,请重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setErrors({})
    onClose()
  }

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { label: '', color: '' }
    if (password.length < 8) return { label: '弱', color: 'text-red-500' }
    if (!/^(?=.*[A-Za-z])(?=.*\d)/.test(password)) return { label: '弱', color: 'text-red-500' }
    if (password.length >= 12 && /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])/.test(password)) {
      return { label: '强', color: 'text-green-500' }
    }
    return { label: '中', color: 'text-yellow-500' }
  }

  const passwordStrength = getPasswordStrength(newPassword)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
          <DialogDescription>
            请输入当前密码和新密码。新密码必须至少8位,包含字母和数字。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* 当前密码 */}
            <div>
              <Label htmlFor="currentPassword">当前密码</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="输入当前密码"
              />
              {errors.currentPassword && (
                <p className="text-sm text-destructive mt-1">{errors.currentPassword}</p>
              )}
            </div>

            {/* 新密码 */}
            <div>
              <Label htmlFor="newPassword">新密码</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="输入新密码"
              />
              {newPassword && (
                <p className={`text-sm mt-1 ${passwordStrength.color}`}>
                  密码强度: {passwordStrength.label}
                </p>
              )}
              {errors.newPassword && (
                <p className="text-sm text-destructive mt-1">{errors.newPassword}</p>
              )}
            </div>

            {/* 确认密码 */}
            <div>
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive mt-1">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={handleClose}>
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? '保存中...' : '确认修改'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

