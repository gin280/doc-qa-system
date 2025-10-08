'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Logo } from '@/components/ui/logo'
import { OAuthButtons } from './OAuthButtons'
import { registerSchema, type RegisterInput } from '@/lib/validations/auth'
import { register, ApiError } from '@/services/auth/authService'

export function RegisterForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterInput) => {
    try {
      setIsLoading(true)
      setError('')

      // 使用认证服务进行注册
      await register(data)

      // Story 1.10: 注册成功，直接跳转到 Chat
      router.push('/chat')
    } catch (err) {
      // 处理不同类型的错误
      if (err instanceof ApiError) {
        // API 错误（包括业务错误和网络错误）
        setError(err.message)
      } else {
        // 未知错误
        setError('注册失败，请重试')
        console.error('Registration error:', err)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md p-8">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <Logo size="md" />
      </div>
      
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-center">注册账户</h2>
        <p className="text-center text-muted-foreground mt-2">创建您的文档问答账户</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* 用户名字段 */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            用户名
          </label>
          <Input
            id="name"
            type="text"
            placeholder="请输入用户名（支持中文、字母、数字）"
            aria-invalid={errors.name ? 'true' : 'false'}
            aria-describedby={errors.name ? 'name-error' : undefined}
            {...registerField('name')}
            disabled={isLoading}
          />
          {errors.name && (
            <p 
              id="name-error"
              role="alert"
              className="text-destructive text-sm mt-1 animate-in fade-in slide-in-from-top-1 duration-200"
            >
              {errors.name.message}
            </p>
          )}
        </div>

        {/* 邮箱字段 */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            邮箱
          </label>
          <Input
            id="email"
            type="email"
            placeholder="your@example.com"
            autoComplete="email"
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...registerField('email')}
            disabled={isLoading}
          />
          {errors.email && (
            <p 
              id="email-error"
              role="alert"
              className="text-destructive text-sm mt-1 animate-in fade-in slide-in-from-top-1 duration-200"
            >
              {errors.email.message}
            </p>
          )}
        </div>

        {/* 密码字段 */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">
            密码
          </label>
          <Input
            id="password"
            type="password"
            placeholder="至少8位，包含大小写字母、数字和特殊字符"
            autoComplete="new-password"
            aria-invalid={errors.password ? 'true' : 'false'}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...registerField('password')}
            disabled={isLoading}
          />
          {errors.password && (
            <p 
              id="password-error"
              role="alert"
              className="text-destructive text-sm mt-1 animate-in fade-in slide-in-from-top-1 duration-200"
            >
              {errors.password.message}
            </p>
          )}
        </div>

        {/* 确认密码字段 */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
            确认密码
          </label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="再次输入密码"
            autoComplete="new-password"
            aria-invalid={errors.confirmPassword ? 'true' : 'false'}
            aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
            {...registerField('confirmPassword')}
            disabled={isLoading}
          />
          {errors.confirmPassword && (
            <p 
              id="confirmPassword-error"
              role="alert"
              className="text-destructive text-sm mt-1 animate-in fade-in slide-in-from-top-1 duration-200"
            >
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div 
            role="alert"
            aria-live="assertive"
            className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded animate-in fade-in slide-in-from-top-2 duration-300"
          >
            {error}
          </div>
        )}

        {/* 提交按钮 */}
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? '注册中...' : '注册'}
        </Button>
      </form>

      {/* OAuth 按钮 */}
      <div className="mt-4">
        <OAuthButtons />
      </div>

      {/* 登录链接 */}
      <p className="text-center text-sm text-muted-foreground mt-4">
        已有账户？{' '}
        <a href="/login" className="text-primary link-underline">
          立即登录
        </a>
      </p>
    </Card>
  )
}

