'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

// 注册表单验证 Schema
const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z
    .string()
    .min(8, '密码至少8位')
    .regex(/^(?=.*[A-Za-z])(?=.*\d)/, '密码必须包含字母和数字'),
  confirmPassword: z.string(),
  name: z.string().min(1, '用户名不能为空').max(50, '用户名不能超过50个字符'),
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次密码不一致',
  path: ['confirmPassword'],
})

type RegisterFormData = z.infer<typeof registerSchema>

export function RegisterForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setIsLoading(true)
      setError('')

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          name: data.name,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '注册失败')
      }

      // 注册成功，跳转到登录页或 dashboard
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败，请重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-center">注册账户</h2>
        <p className="text-center text-gray-600 mt-2">创建您的文档问答账户</p>
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
            placeholder="请输入用户名"
            {...register('name')}
            disabled={isLoading}
          />
          {errors.name && (
            <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
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
            {...register('email')}
            disabled={isLoading}
          />
          {errors.email && (
            <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
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
            placeholder="至少8位，包含字母和数字"
            {...register('password')}
            disabled={isLoading}
          />
          {errors.password && (
            <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
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
            {...register('confirmPassword')}
            disabled={isLoading}
          />
          {errors.confirmPassword && (
            <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
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

        {/* 登录链接 */}
        <p className="text-center text-sm text-gray-600">
          已有账户？{' '}
          <a href="/login" className="text-blue-600 hover:underline">
            立即登录
          </a>
        </p>
      </form>
    </Card>
  )
}

