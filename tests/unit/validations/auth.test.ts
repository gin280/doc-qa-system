/**
 * 认证验证 Schema 测试
 */

import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
} from '@/lib/validations/auth'

describe('registerSchema', () => {
  it('应该验证有效的注册数据', () => {
    const validData = {
      email: 'test@example.com',
      password: 'Test123!@#',
      confirmPassword: 'Test123!@#',
      name: 'TestUser',
    }

    const result = registerSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('应该拒绝无效的邮箱格式', () => {
    const invalidData = {
      email: 'invalid-email',
      password: 'Test123!@#',
      confirmPassword: 'Test123!@#',
      name: 'TestUser',
    }

    const result = registerSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe('email')
    }
  })

  it('应该拒绝弱密码（无大写字母）', () => {
    const invalidData = {
      email: 'test@example.com',
      password: 'test123!@#',
      confirmPassword: 'test123!@#',
      name: 'TestUser',
    }

    const result = registerSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      const passwordErrors = result.error.issues.filter(
        (issue) => issue.path[0] === 'password'
      )
      expect(passwordErrors.length).toBeGreaterThan(0)
      expect(passwordErrors[0].message).toContain('大写字母')
    }
  })

  it('应该拒绝弱密码（无小写字母）', () => {
    const invalidData = {
      email: 'test@example.com',
      password: 'TEST123!@#',
      confirmPassword: 'TEST123!@#',
      name: 'TestUser',
    }

    const result = registerSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      const passwordErrors = result.error.issues.filter(
        (issue) => issue.path[0] === 'password'
      )
      expect(passwordErrors[0].message).toContain('小写字母')
    }
  })

  it('应该拒绝弱密码（无数字）', () => {
    const invalidData = {
      email: 'test@example.com',
      password: 'TestTest!@#',
      confirmPassword: 'TestTest!@#',
      name: 'TestUser',
    }

    const result = registerSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      const passwordErrors = result.error.issues.filter(
        (issue) => issue.path[0] === 'password'
      )
      expect(passwordErrors[0].message).toContain('数字')
    }
  })

  it('应该拒绝弱密码（无特殊字符）', () => {
    const invalidData = {
      email: 'test@example.com',
      password: 'Test1234',
      confirmPassword: 'Test1234',
      name: 'TestUser',
    }

    const result = registerSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      const passwordErrors = result.error.issues.filter(
        (issue) => issue.path[0] === 'password'
      )
      expect(passwordErrors[0].message).toContain('特殊字符')
    }
  })

  it('应该拒绝过短的密码', () => {
    const invalidData = {
      email: 'test@example.com',
      password: 'Te1!',
      confirmPassword: 'Te1!',
      name: 'TestUser',
    }

    const result = registerSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      const passwordErrors = result.error.issues.filter(
        (issue) => issue.path[0] === 'password'
      )
      expect(passwordErrors[0].message).toContain('至少需要8个字符')
    }
  })

  it('应该拒绝密码不匹配', () => {
    const invalidData = {
      email: 'test@example.com',
      password: 'Test123!@#',
      confirmPassword: 'Different123!@#',
      name: 'TestUser',
    }

    const result = registerSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe('confirmPassword')
      expect(result.error.issues[0].message).toContain('不一致')
    }
  })

  it('应该拒绝无效的用户名（包含非法字符）', () => {
    const invalidData = {
      email: 'test@example.com',
      password: 'Test123!@#',
      confirmPassword: 'Test123!@#',
      name: 'Test@User!',
    }

    const result = registerSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      const nameErrors = result.error.issues.filter(
        (issue) => issue.path[0] === 'name'
      )
      expect(nameErrors[0].message).toContain('只能包含')
    }
  })

  it('应该接受包含中文的用户名', () => {
    const validData = {
      email: 'test@example.com',
      password: 'Test123!@#',
      confirmPassword: 'Test123!@#',
      name: '测试用户',
    }

    const result = registerSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })
})

describe('loginSchema', () => {
  it('应该验证有效的登录数据', () => {
    const validData = {
      email: 'test@example.com',
      password: 'anypassword',
    }

    const result = loginSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('应该拒绝空邮箱', () => {
    const invalidData = {
      email: '',
      password: 'anypassword',
    }

    const result = loginSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })
})

describe('changePasswordSchema', () => {
  it('应该验证有效的密码修改', () => {
    const validData = {
      currentPassword: 'OldPass123!@#',
      newPassword: 'NewPass123!@#',
      confirmNewPassword: 'NewPass123!@#',
    }

    const result = changePasswordSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('应该拒绝新旧密码相同', () => {
    const invalidData = {
      currentPassword: 'Test123!@#',
      newPassword: 'Test123!@#',
      confirmNewPassword: 'Test123!@#',
    }

    const result = changePasswordSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('不能与当前密码相同')
    }
  })

  it('应该拒绝新密码不匹配', () => {
    const invalidData = {
      currentPassword: 'OldPass123!@#',
      newPassword: 'NewPass123!@#',
      confirmNewPassword: 'DifferentPass123!@#',
    }

    const result = changePasswordSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('不一致')
    }
  })
})
