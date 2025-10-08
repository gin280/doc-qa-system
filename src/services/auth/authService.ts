/**
 * 认证服务层
 * 统一管理所有认证相关的 API 调用
 */

import type {
  RegisterInput,
  LoginInput,
  ResetPasswordRequestInput,
  ResetPasswordInput,
  UpdateProfileInput,
  ChangePasswordInput,
} from '@/lib/validations/auth'

/**
 * API 响应基础类型
 */
interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * 用户信息类型
 */
interface User {
  id: string
  email: string
  name: string
  avatar?: string | null
  createdAt: string
}

/**
 * 认证响应类型
 */
interface AuthResponse {
  user: User
  message?: string
}

/**
 * API 错误类型
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * 发送 API 请求的辅助函数
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new ApiError(
        data.error || data.message || '请求失败',
        response.status,
        data.code
      )
    }

    return {
      success: true,
      data: data.data || data,
      message: data.message,
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    // 网络错误或其他未知错误
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError('网络连接失败，请检查您的网络设置')
    }

    throw new ApiError(
      error instanceof Error ? error.message : '未知错误，请重试'
    )
  }
}

/**
 * 用户注册
 */
export async function register(input: RegisterInput): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      name: input.name,
    }),
  })

  return response.data!
}

/**
 * 用户登录
 */
export async function login(input: LoginInput): Promise<AuthResponse> {
  const response = await apiRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  return response.data!
}

/**
 * 用户登出
 */
export async function logout(): Promise<void> {
  await apiRequest('/api/auth/logout', {
    method: 'POST',
  })
}

/**
 * 请求密码重置
 */
export async function requestPasswordReset(
  input: ResetPasswordRequestInput
): Promise<{ message: string }> {
  const response = await apiRequest<{ message: string }>(
    '/api/auth/reset-password',
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  )

  return response.data!
}

/**
 * 重置密码
 */
export async function resetPassword(
  input: ResetPasswordInput
): Promise<{ message: string }> {
  const response = await apiRequest<{ message: string }>(
    '/api/auth/reset-password/confirm',
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  )

  return response.data!
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(): Promise<User> {
  const response = await apiRequest<User>('/api/auth/me')
  return response.data!
}

/**
 * 更新用户资料
 */
export async function updateProfile(input: UpdateProfileInput): Promise<User> {
  const response = await apiRequest<User>('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })

  return response.data!
}

/**
 * 修改密码
 */
export async function changePassword(
  input: ChangePasswordInput
): Promise<{ message: string }> {
  const response = await apiRequest<{ message: string }>(
    '/api/auth/change-password',
    {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      }),
    }
  )

  return response.data!
}

/**
 * 删除账户
 */
export async function deleteAccount(password: string): Promise<void> {
  await apiRequest('/api/auth/account', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  })
}
