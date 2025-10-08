/**
 * 清理测试数据脚本
 * 
 * 用途：清理 Supabase 中由集成测试产生的测试数据
 * 
 * 运行：npm run test:cleanup
 */

import { db } from '../src/lib/db'
import { users } from '../drizzle/schema'
import { like, or } from 'drizzle-orm'

async function cleanupTestData() {
  console.log('🧹 开始清理测试数据...\n')

  try {
    // 查找所有测试用户
    const testUsers = await db.select()
      .from(users)
      .where(
        or(
          like(users.email, '%integration-test%'),
          like(users.email, '%test@example.com'),
          like(users.email, '%relationship-test%')
        )
      )

    if (testUsers.length === 0) {
      console.log('✅ 没有发现测试数据，数据库已清理')
      return
    }

    console.log(`📊 发现 ${testUsers.length} 个测试用户:\n`)
    testUsers.forEach(user => {
      console.log(`   - ${user.email} (ID: ${user.id})`)
    })

    console.log('\n⚠️  即将删除这些用户及其所有关联数据（文档、对话、消息等）')
    console.log('   这个操作不可撤销！\n')

    // 给用户 5 秒钟取消
    console.log('⏱️  5 秒后开始删除... (按 Ctrl+C 取消)')
    await new Promise(resolve => setTimeout(resolve, 5000))

    // 删除测试用户（级联删除会自动处理关联数据）
    const deleted = await db.delete(users)
      .where(
        or(
          like(users.email, '%integration-test%'),
          like(users.email, '%test@example.com'),
          like(users.email, '%relationship-test%')
        )
      )
      .returning()

    console.log(`\n✅ 成功删除 ${deleted.length} 个测试用户及其关联数据`)
    
    if (deleted.length > 0) {
      console.log('\n🗑️  已删除的用户:')
      deleted.forEach(user => {
        console.log(`   - ${user.email}`)
      })
    }

    console.log('\n✨ 清理完成！')

  } catch (error) {
    console.error('\n❌ 清理失败:', error)
    process.exit(1)
  }
}

// 执行清理
cleanupTestData()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ 脚本执行失败:', error)
    process.exit(1)
  })
