#!/usr/bin/env tsx

/**
 * Story 4.1 - Upstash Redis 配置验证脚本
 * 
 * 用途：检查 Upstash Redis 环境变量是否正确配置
 * 运行：npx tsx scripts/verify-redis-config.ts
 */

import { config } from 'dotenv'

// 加载环境变量
config({ path: '.env.local' })

console.log('🔍 Story 4.1 - Upstash Redis 配置验证\n')

// 检查环境变量
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

let hasErrors = false

// 验证 URL
console.log('1. 检查 UPSTASH_REDIS_REST_URL:')
if (!UPSTASH_URL) {
  console.log('   ❌ 未配置')
  console.log('   → 请在 .env.local 中添加: UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"\n')
  hasErrors = true
} else if (!UPSTASH_URL.startsWith('https://')) {
  console.log('   ⚠️  格式可能不正确')
  console.log(`   当前值: ${UPSTASH_URL}`)
  console.log('   → URL 应该以 https:// 开头\n')
  hasErrors = true
} else {
  console.log(`   ✅ 已配置: ${UPSTASH_URL}\n`)
}

// 验证 Token
console.log('2. 检查 UPSTASH_REDIS_REST_TOKEN:')
if (!UPSTASH_TOKEN) {
  console.log('   ❌ 未配置')
  console.log('   → 请在 .env.local 中添加: UPSTASH_REDIS_REST_TOKEN="your-redis-token-here"\n')
  hasErrors = true
} else if (UPSTASH_TOKEN.length < 20) {
  console.log('   ⚠️  Token 长度可能不正确')
  console.log(`   当前长度: ${UPSTASH_TOKEN.length} 字符`)
  console.log('   → Upstash Token 通常很长（> 100 字符）\n')
  hasErrors = true
} else {
  const maskedToken = UPSTASH_TOKEN.substring(0, 10) + '...' + UPSTASH_TOKEN.substring(UPSTASH_TOKEN.length - 10)
  console.log(`   ✅ 已配置: ${maskedToken}\n`)
}

// 测试连接（如果配置完整）
if (!hasErrors) {
  console.log('3. 测试 Redis 连接:')
  console.log('   尝试连接到 Upstash Redis...')
  
  // 简单的 ping 测试
  const pingUrl = `${UPSTASH_URL}/ping`
  
  fetch(pingUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${UPSTASH_TOKEN}`
    }
  })
    .then(response => {
      if (response.ok) {
        return response.json()
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    })
    .then(data => {
      if (data.result === 'PONG') {
        console.log('   ✅ 连接成功！Redis 响应正常\n')
        console.log('═'.repeat(60))
        console.log('✅ 配置验证通过！')
        console.log('═'.repeat(60))
        console.log('\n下一步：')
        console.log('1. 启动应用: npm run dev')
        console.log('2. 运行手动测试: tests/manual/test-rate-limit-manual.md')
        console.log('3. 验证速率限制功能正常工作\n')
      } else {
        throw new Error('Redis 响应格式不正确')
      }
    })
    .catch(error => {
      console.log(`   ❌ 连接失败: ${error.message}\n`)
      console.log('可能的原因：')
      console.log('- Redis Token 不正确')
      console.log('- Redis URL 不正确')
      console.log('- Redis 数据库未创建或已删除')
      console.log('- 网络连接问题\n')
      console.log('请检查：')
      console.log('1. 访问 https://console.upstash.com/')
      console.log('2. 确认数据库存在且状态正常')
      console.log('3. 重新复制 REST API 凭证\n')
    })
} else {
  console.log('═'.repeat(60))
  console.log('❌ 配置验证失败')
  console.log('═'.repeat(60))
  console.log('\n请按照以下步骤修复：\n')
  console.log('1. 创建 Upstash Redis 数据库：')
  console.log('   https://console.upstash.com/\n')
  console.log('2. 复制 REST API 凭证到 .env.local：')
  console.log('   UPSTASH_REDIS_REST_URL="https://..."')
  console.log('   UPSTASH_REDIS_REST_TOKEN="..."\n')
  console.log('3. 重新运行此脚本验证：')
  console.log('   npx tsx scripts/verify-redis-config.ts\n')
  console.log('详细配置指南：')
  console.log('docs/deployment/upstash-redis-setup.md\n')
  
  process.exit(1)
}

