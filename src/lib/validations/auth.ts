/**
 * 认证相关的 Zod 验证 Schema
 * 前后端共享，确保验证规则一致性
 */

import { z } from 'zod'

/**
 * 密码验证规则：
 * - 至少 8 位
 * - 至少一个小写字母
 * - 至少一个大写字母
 * - 至少一个数字
 * - 至少一个特殊字符 (@$!%*?&#)
 */
const passwordSchema = z
  .string()
  .min(8, '密码至少需要8个字符')
  .regex(/^(?=.*[a-z])/, '密码必须包含至少一个小写字母')
  .regex(/^(?=.*[A-Z])/, '密码必须包含至少一个大写字母')
  .regex(/^(?=.*\d)/, '密码必须包含至少一个数字')
  .regex(/^(?=.*[@$!%*?&#])/, '密码必须包含至少一个特殊字符 (@$!%*?&#)')

/**
 * 前端用户注册表单验证 Schema (包含 confirmPassword)
 */
export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, '邮箱不能为空')
      .email('邮箱格式不正确')
      .max(255, '邮箱长度不能超过255个字符'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, '请确认密码'),
    name: z
      .string()
      .min(1, '用户名不能为空')
      .max(50, '用户名不能超过50个字符')
      .regex(/^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/, '用户名只能包含中文、字母、数字、下划线和连字符'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  })

/**
 * 后端 API 注册验证 Schema (不包含 confirmPassword，用户名允许空格)
 */
export const registerApiSchema = z.object({
  email: z
    .string()
    .min(1, '邮箱不能为空')
    .email('邮箱格式不正确')
    .max(255, '邮箱长度不能超过255个字符'),
  password: passwordSchema,
  name: z
    .string()
    .min(1, '用户名不能为空')
    .max(50, '用户名不能超过50个字符')
    .regex(/^[\u4e00-\u9fa5a-zA-Z0-9_\s-]+$/, '用户名只能包含中文、字母、数字、空格、下划线和连字符'),
})

/**
 * 用户登录表单验证 Schema
 */
export const loginSchema = z.object({
  email: z.string().min(1, '邮箱不能为空').email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空'),
})

/**
 * 密码重置请求验证 Schema
 */
export const resetPasswordRequestSchema = z.object({
  email: z.string().min(1, '邮箱不能为空').email('邮箱格式不正确'),
})

/**
 * 密码重置验证 Schema
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, '重置令牌不能为空'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, '请确认密码'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  })

/**
 * 用户资料更新验证 Schema
 */
export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, '用户名不能为空')
    .max(50, '用户名不能超过50个字符')
    .regex(/^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/, '用户名只能包含中文、字母、数字、下划线和连字符')
    .optional(),
  avatar: z.string().url('头像必须是有效的URL').optional(),
})

/**
 * 修改密码验证 Schema
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '请输入当前密码'),
    newPassword: passwordSchema,
    confirmNewPassword: z.string().min(1, '请确认新密码'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: '两次输入的新密码不一致',
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: '新密码不能与当前密码相同',
    path: ['newPassword'],
  })

// 导出类型定义
export type RegisterInput = z.infer<typeof registerSchema>
export type RegisterApiInput = z.infer<typeof registerApiSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
