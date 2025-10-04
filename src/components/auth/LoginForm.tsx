'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Logo } from '@/components/ui/logo';
import Link from 'next/link';

const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空'),
  remember: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      remember: false,
    },
  });

  const rememberValue = watch('remember');

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        remember: data.remember ? 'true' : 'false',
        redirect: false,
      });

      if (result?.error) {
        // NextAuth 返回 "CredentialsSignin" 错误时，显示友好的错误提示
        if (result.error === 'CredentialsSignin') {
          setError('邮箱或密码错误，请检查后重试');
        } else {
          setError('登录失败，请稍后重试');
        }
        setIsLoading(false);
      } else if (result?.ok) {
        // PO Decision: 直接跳转到主工作区（文档管理）
        // 减少用户步骤，直达核心功能
        window.location.href = '/documents';
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('登录失败，请稍后重试');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Logo */}
      <div className="flex justify-center mb-4">
        <Logo size="md" />
      </div>
      
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">欢迎回来</h1>
        <p className="text-muted-foreground">登录您的账户</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/30 animate-in fade-in slide-in-from-top-2 duration-300">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            邮箱
          </label>
          <Input
            id="email"
            type="email"
            placeholder="your@email.com"
            {...register('email')}
            disabled={isLoading}
            aria-invalid={errors.email ? 'true' : 'false'}
          />
          {errors.email && (
            <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            密码
          </label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            {...register('password')}
            disabled={isLoading}
            aria-invalid={errors.password ? 'true' : 'false'}
          />
          {errors.password && (
            <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={rememberValue}
              onCheckedChange={(checked) => {
                setValue('remember', checked === true);
              }}
            />
            <label
              htmlFor="remember"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              记住我
            </label>
          </div>
          <Link
            href="/forgot-password"
            className="text-sm text-primary link-underline"
          >
            忘记密码?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? '登录中...' : '登录'}
        </Button>
      </form>

      <div className="text-center text-sm">
        还没有账号?{' '}
        <Link href="/register" className="text-primary link-underline font-medium">
          立即注册
        </Link>
      </div>
    </div>
  );
}

