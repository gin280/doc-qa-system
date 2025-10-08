'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { ChangePasswordModal } from '@/components/settings/ChangePasswordModal'
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal'
import { toast } from 'sonner'

interface UserProfile {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  authProvider: 'EMAIL' | 'GOOGLE' | 'GITHUB'
  createdAt: string
}

/**
 * AccountSettings - 账户设置组件
 * 
 * 功能:
 * - 显示和编辑个人信息
 * - 修改密码（仅邮箱登录用户）
 * - 删除账户
 */
export function AccountSettings() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [name, setName] = useState('')
  const [isNameChanged, setIsNameChanged] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false)

  useEffect(() => {
    fetchUserProfile()
  }, [])

  const fetchUserProfile = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/user/profile')
      if (!res.ok) throw new Error('Failed to fetch profile')
      const data = await res.json()
      setProfile(data)
      setName(data.name)
    } catch (error) {
      toast.error('加载用户信息失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveName = async () => {
    if (!name || name === profile?.name) return
    
    setIsSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
      
      if (!res.ok) throw new Error('Failed to update name')
      
      const updated = await res.json()
      setProfile(updated)
      setIsNameChanged(false)
      toast.success('用户名更新成功')
    } catch (error) {
      toast.error('更新用户名失败,请重试')
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (isLoading || !profile) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* 个人信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>个人信息</CardTitle>
          <CardDescription>管理您的个人资料和账户信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 头像 */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile.avatarUrl || undefined} alt={profile.name} />
              <AvatarFallback className="text-2xl">
                {profile.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">用户头像</p>
              {profile.authProvider !== 'EMAIL' && (
                <p className="text-xs text-muted-foreground">
                  头像已与 {profile.authProvider} 账号同步
                </p>
              )}
            </div>
          </div>

          {/* 邮箱 */}
          <div>
            <label className="text-sm font-medium">邮箱地址</label>
            <p className="text-sm text-muted-foreground mt-1">
              {profile.email} 
              <span className="ml-2 text-xs bg-secondary px-2 py-0.5 rounded">
                {profile.authProvider} 登录
              </span>
            </p>
          </div>

          {/* 用户名 */}
          <div>
            <label className="text-sm font-medium">用户名</label>
            <div className="flex gap-2 mt-1">
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setIsNameChanged(e.target.value !== profile.name)
                }}
                placeholder="输入用户名"
                maxLength={50}
              />
              <Button
                onClick={handleSaveName}
                disabled={!isNameChanged || !name || isSaving}
              >
                {isSaving ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>

          {/* 注册时间 */}
          <div>
            <label className="text-sm font-medium">注册时间</label>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDate(profile.createdAt)}
            </p>
          </div>

          {/* 修改密码按钮 */}
          {profile.authProvider === 'EMAIL' ? (
            <Button
              variant="outline"
              onClick={() => setShowChangePasswordModal(true)}
            >
              修改密码
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              您使用 {profile.authProvider} 登录,无需设置密码
            </p>
          )}
        </CardContent>
      </Card>

      {/* 危险操作卡片 */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">危险操作</CardTitle>
          <CardDescription>这些操作无法撤销,请谨慎操作</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteAccountModal(true)}
          >
            删除账户
          </Button>
        </CardContent>
      </Card>

      {/* 模态框 */}
      <ChangePasswordModal
        open={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
      <DeleteAccountModal
        open={showDeleteAccountModal}
        onClose={() => setShowDeleteAccountModal(false)}
        userEmail={profile.email}
      />
    </>
  )
}

