// src/lib/db.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/drizzle/schema'

// 设置 Node.js 进程时区为中国标准时间
process.env.TZ = 'Asia/Shanghai'

// 检查DATABASE_URL环境变量
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const connectionString = process.env.DATABASE_URL

// 创建postgres连接
const client = postgres(connectionString, {
  max: process.env.NODE_ENV === 'production' ? 10 : 1,
  idle_timeout: 20,
  connect_timeout: 10,
})

// 创建drizzle实例
export const db = drizzle(client, { schema })

// 导出schema供外部使用
export { schema }

