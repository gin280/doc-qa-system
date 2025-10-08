# 单元测试指南

## 🎯 什么是单元测试？

单元测试验证**单个函数或组件**的行为，完全隔离外部依赖（数据库、API、文件系统等）。

**特点**：
- ⚡ 快速（毫秒级）
- 🔒 隔离（Mock 所有依赖）
- 🎯 聚焦（只测试一个功能点）

---

## 📝 编写单元测试的基本原则

### 1. AAA 模式（Arrange-Act-Assert）

```typescript
it('应该计算文档分块数量', () => {
  // Arrange（准备）：设置测试数据
  const content = '这是测试内容'.repeat(1000)
  const chunkSize = 500
  
  // Act（执行）：调用被测试的函数
  const chunks = calculateChunks(content, chunkSize)
  
  // Assert（断言）：验证结果
  expect(chunks.length).toBeGreaterThan(1)
  expect(chunks[0].length).toBeLessThanOrEqual(chunkSize)
})
```

---

### 2. 一个测试只测一件事

```typescript
// ✅ 正确：每个测试独立
it('应该在密码为空时返回错误', () => {
  const result = validatePassword('')
  expect(result.valid).toBe(false)
})

it('应该在密码过短时返回错误', () => {
  const result = validatePassword('123')
  expect(result.valid).toBe(false)
})

// ❌ 错误：一个测试测多件事
it('应该验证密码', () => {
  expect(validatePassword('').valid).toBe(false)
  expect(validatePassword('123').valid).toBe(false)
  expect(validatePassword('ValidPass123!').valid).toBe(true)
})
```

---

### 3. 使用描述性测试名称

```typescript
// ✅ 正确：清晰说明测试什么
it('应该在用户不存在时创建新的 usage 记录', async () => {})
it('应该在密码错误时返回 401 状态码', async () => {})

// ❌ 错误：不明确
it('test user', async () => {})
it('should work', async () => {})
```

---

## 🔧 Mock 外部依赖

### Mock 数据库

```typescript
// tests/unit/services/user/userService.test.ts

import { userService } from '@/services/userService'
import { db } from '@/lib/db'

// ✅ Mock 整个 db 模块
jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
}))

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('应该创建新用户', async () => {
    // 设置 Mock 返回值
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User'
    }
    
    ;(db.insert as jest.Mock).mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([mockUser])
      })
    })

    // 调用被测试的函数
    const result = await userService.createUser({
      email: 'test@example.com',
      name: 'Test User'
    })

    // 验证结果
    expect(result).toEqual(mockUser)
    expect(db.insert).toHaveBeenCalledTimes(1)
  })
})
```

---

### Mock API 调用

```typescript
// tests/unit/services/llm/llmService.test.ts

import { llmService } from '@/services/llm/llmService'
import { fetch } from 'node-fetch'

jest.mock('node-fetch')

describe('LLM Service', () => {
  it('应该调用智谱 AI API', async () => {
    // Mock fetch 响应
    ;(fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: { content: 'AI 回答' }
        }]
      })
    } as any)

    const result = await llmService.generateAnswer('测试问题')

    expect(result).toBe('AI 回答')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.bigmodel.cn'),
      expect.any(Object)
    )
  })
})
```

---

### Mock 文件系统

```typescript
// tests/unit/services/parserService.test.ts

import { parseDocument } from '@/services/parserService'
import fs from 'fs'

jest.mock('fs')

describe('Parser Service', () => {
  it('应该读取并解析 PDF 文件', async () => {
    // Mock 文件读取
    const mockBuffer = Buffer.from('PDF content')
    ;(fs.readFileSync as jest.Mock).mockReturnValue(mockBuffer)

    const result = await parseDocument('/path/to/file.pdf')

    expect(result).toBeDefined()
    expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/file.pdf')
  })
})
```

---

## 🎯 测试不同类型的代码

### Service 层（业务逻辑）

```typescript
// tests/unit/services/embeddingService.test.ts

describe('Embedding Service', () => {
  it('应该批量处理文档分块', async () => {
    const chunks = Array.from({ length: 50 }, (_, i) => ({
      id: `chunk-${i}`,
      content: `Content ${i}`
    }))
    
    const mockLLM = {
      generateEmbeddings: jest.fn().mockResolvedValue(
        Array(50).fill(Array(1536).fill(0.1))
      )
    }

    await embeddingService.processChunks(chunks, mockLLM)

    // 验证批处理（每批 20 个）
    expect(mockLLM.generateEmbeddings).toHaveBeenCalledTimes(3)
  })
})
```

---

### Util 函数（工具函数）

```typescript
// tests/unit/lib/file-validator.test.ts

import { validateFile } from '@/lib/file-validator'

describe('File Validator', () => {
  it('应该拒绝超过大小限制的文件', () => {
    const largeFile = {
      name: 'large.pdf',
      size: 60 * 1024 * 1024, // 60MB
      type: 'application/pdf'
    }

    const result = validateFile(largeFile)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('大小超过限制')
  })

  it('应该拒绝不支持的文件类型', () => {
    const invalidFile = {
      name: 'image.png',
      size: 1024,
      type: 'image/png'
    }

    const result = validateFile(invalidFile)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('不支持的文件类型')
  })
})
```

---

### React Hooks

```typescript
// tests/unit/hooks/useChat.test.ts

import { renderHook, act } from '@testing-library/react'
import { useChat } from '@/hooks/useChat'

jest.mock('@/lib/db')

describe('useChat Hook', () => {
  it('应该发送消息并更新状态', async () => {
    const { result } = renderHook(() => useChat('doc-123'))

    act(() => {
      result.current.sendMessage('测试问题')
    })

    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].content).toBe('测试问题')
    expect(result.current.isLoading).toBe(true)

    // 等待异步操作完成
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.messages).toHaveLength(2)
  })
})
```

---

### React 组件

```typescript
// tests/unit/components/ChatInput.test.tsx

import { render, screen, fireEvent } from '@testing-library/react'
import { ChatInput } from '@/components/ChatInput'

describe('ChatInput Component', () => {
  it('应该在点击按钮时调用 onSend', () => {
    const mockOnSend = jest.fn()
    render(<ChatInput onSend={mockOnSend} />)

    const input = screen.getByPlaceholderText('输入问题...')
    const button = screen.getByRole('button', { name: /发送/i })

    fireEvent.change(input, { target: { value: '测试问题' } })
    fireEvent.click(button)

    expect(mockOnSend).toHaveBeenCalledWith('测试问题')
  })

  it('应该在输入为空时禁用发送按钮', () => {
    render(<ChatInput onSend={jest.fn()} />)

    const button = screen.getByRole('button', { name: /发送/i })
    
    expect(button).toBeDisabled()
  })
})
```

---

## ⚠️ 常见错误

### 错误 1：测试实现细节而非行为

```typescript
// ❌ 错误：测试内部实现
it('should call setState', () => {
  const component = new MyComponent()
  const spy = jest.spyOn(component, 'setState')
  component.handleClick()
  expect(spy).toHaveBeenCalled()
})

// ✅ 正确：测试用户可见的行为
it('应该在点击后显示消息', () => {
  render(<MyComponent />)
  fireEvent.click(screen.getByRole('button'))
  expect(screen.getByText('成功!')).toBeInTheDocument()
})
```

---

### 错误 2：测试框架而非业务逻辑

```typescript
// ❌ 错误：测试 Drizzle ORM
it('should call db.insert', async () => {
  await db.insert(users).values({...})
  expect(db.insert).toHaveBeenCalled()
})

// ✅ 正确：测试业务逻辑
it('应该在邮箱重复时抛出错误', async () => {
  mockDb.insert.mockRejectedValue(new Error('Unique constraint'))
  
  await expect(
    userService.createUser({ email: 'existing@example.com' })
  ).rejects.toThrow('邮箱已存在')
})
```

---

### 错误 3：忘记 Mock 外部依赖

```typescript
// ❌ 错误：直接导入真实数据库
import { db } from '@/lib/db'

it('should create user', async () => {
  // 这会连接真实数据库！
  await db.insert(users).values({...})
})

// ✅ 正确：Mock 数据库
jest.mock('@/lib/db')

it('应该创建用户', async () => {
  mockDb.insert.mockReturnValue({...})
  await userService.createUser({...})
  expect(mockDb.insert).toHaveBeenCalled()
})
```

---

## 📊 测试覆盖率

### 查看覆盖率

```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

### 覆盖率目标

- **函数覆盖率**: ≥ 80%
- **分支覆盖率**: ≥ 75%
- **行覆盖率**: ≥ 80%

### 哪些代码需要测试？

**高优先级**（必须测试）：
- ✅ Service 层业务逻辑
- ✅ 数据验证和转换
- ✅ 错误处理逻辑
- ✅ 复杂算法（如分块、评分）

**中优先级**（建议测试）：
- ⚡ React Hooks
- ⚡ Util 工具函数
- ⚡ 关键组件

**低优先级**（可选测试）：
- 🔻 简单的 UI 组件
- 🔻 配置文件
- 🔻 类型定义

---

## 🎯 实战示例

### 完整的Service测试

```typescript
// tests/unit/services/user/usageService.test.ts

import { usageService } from '@/services/user/usageService'
import { db } from '@/lib/db'
import { userUsage } from '@/drizzle/schema'

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn()
  }
}))

jest.mock('@/drizzle/schema', () => ({
  userUsage: {}
}))

describe('UsageService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('incrementQueryCount', () => {
    it('应该增加现有用户的查询次数', async () => {
      // Arrange
      const mockUsage = {
        id: 'usage-id',
        userId: 'user-1',
        queryCount: 5,
        queryResetDate: new Date()
      }

      ;(db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUsage])
          })
        })
      })

      ;(db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined)
        })
      })

      // Act
      await usageService.incrementQueryCount('user-1')

      // Assert
      expect(db.update).toHaveBeenCalled()
      expect(db.select).toHaveBeenCalled()
    })

    it('应该为新用户创建usage记录', async () => {
      // Arrange: 用户不存在
      ;(db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      })

      ;(db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined)
      })

      // Act
      await usageService.incrementQueryCount('user-1')

      // Assert
      expect(db.insert).toHaveBeenCalled()
    })
  })

  describe('checkQuotaLimit', () => {
    it('应该允许未超限的查询', async () => {
      const mockUsage = {
        queryCount: 50,
        queryResetDate: new Date()
      }

      ;(db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUsage])
          })
        })
      })

      const result = await usageService.checkQuotaLimit('user-1', 100)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(50)
    })

    it('应该拒绝超限的查询', async () => {
      const mockUsage = {
        queryCount: 100,
        queryResetDate: new Date()
      }

      ;(db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUsage])
          })
        })
      })

      const result = await usageService.checkQuotaLimit('user-1', 100)

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })
  })
})
```

---

## 🚀 运行测试

```bash
# 运行所有单元测试
npm test

# 运行特定文件
npm test -- path/to/test.test.ts

# 监听模式（自动重跑）
npm run test:watch

# 查看覆盖率
npm run test:coverage
```

---

## 🔗 相关资源

- [测试策略概览](strategy.md)
- [集成测试指南](integration-testing.md)
- [Jest 文档](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)

---

**文档版本**: 1.0  
**创建日期**: 2025-01-15  
**维护人**: Product Owner (Sarah)
