import type { Config } from 'drizzle-kit'
import * as dotenv from 'dotenv'

// 加载 .env.local 文件
dotenv.config({ path: '.env.local' })

export default {
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
} satisfies Config

