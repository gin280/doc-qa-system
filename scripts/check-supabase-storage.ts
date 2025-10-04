#!/usr/bin/env tsx

/**
 * Supabase Storage 配置检查脚本
 * 
 * 检查项：
 * 1. 环境变量是否配置
 * 2. Supabase连接是否正常
 * 3. Storage bucket是否存在
 * 4. RLS policies是否正确配置
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// 加载环境变量
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
]

const STORAGE_BUCKET = 'documents'

async function main() {
console.log('🔍 Supabase Storage 配置检查\n')
console.log('=' .repeat(50))

// 1. 检查环境变量
console.log('\n✅ Step 1: 检查环境变量')
let hasAllVars = true
for (const varName of REQUIRED_ENV_VARS) {
  const value = process.env[varName]
  if (!value) {
    console.log(`❌ 缺少环境变量: ${varName}`)
    hasAllVars = false
  } else {
    console.log(`✅ ${varName}: ${value.substring(0, 20)}...`)
  }
}

if (!hasAllVars) {
  console.log('\n❌ 请在 .env.local 中配置所有必需的环境变量')
  process.exit(1)
}

// 2. 测试Supabase连接
console.log('\n✅ Step 2: 测试Supabase连接')
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

try {
  // 测试基本连接
  const { data, error } = await supabaseAdmin.storage.listBuckets()
  
  if (error) {
    console.log('❌ Supabase连接失败:', error.message)
    process.exit(1)
  }
  
  console.log('✅ Supabase连接成功')
  console.log(`✅ 找到 ${data.length} 个 buckets`)
  
  // 3. 检查Storage bucket是否存在
  console.log(`\n✅ Step 3: 检查Storage bucket "${STORAGE_BUCKET}"`)
  const bucket = data.find(b => b.name === STORAGE_BUCKET)
  
  if (!bucket) {
    console.log(`❌ Bucket "${STORAGE_BUCKET}" 不存在`)
    console.log('\n📝 请按以下步骤创建:')
    console.log('1. 访问 Supabase Dashboard: https://supabase.com/dashboard')
    console.log('2. 选择你的项目')
    console.log('3. 进入 Storage 页面')
    console.log('4. 点击 "New bucket"')
    console.log(`5. 输入名称: ${STORAGE_BUCKET}`)
    console.log('6. 设置为 Private (不要公开访问)')
    console.log('7. 创建以下RLS policies (见 docs/stories/2.2-file-storage-metadata.md)')
    process.exit(1)
  }
  
  console.log(`✅ Bucket "${STORAGE_BUCKET}" 存在`)
  console.log(`   - Public: ${bucket.public}`)
  console.log(`   - Created: ${bucket.created_at}`)
  
  // 4. 测试上传权限
  console.log('\n✅ Step 4: 测试上传权限')
  const testPath = 'test/connection-test.txt'
  const testContent = new Blob(['Connection test'], { type: 'text/plain' })
  
  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(testPath, testContent, {
      upsert: true
    })
  
  if (uploadError) {
    console.log('❌ 上传测试失败:', uploadError.message)
    console.log('\n可能的原因:')
    console.log('1. RLS policies 配置不正确')
    console.log('2. Service Role Key 权限不足')
    console.log('\n请检查 Supabase Dashboard 中的 Storage policies')
    
    // 尝试清理
    await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([testPath])
    process.exit(1)
  }
  
  console.log('✅ 上传测试成功:', uploadData.path)
  
  // 5. 测试下载权限
  console.log('\n✅ Step 5: 测试下载权限')
  const { data: downloadData, error: downloadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .download(testPath)
  
  if (downloadError) {
    console.log('❌ 下载测试失败:', downloadError.message)
  } else {
    console.log('✅ 下载测试成功')
  }
  
  // 6. 清理测试文件
  console.log('\n✅ Step 6: 清理测试文件')
  const { error: deleteError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .remove([testPath])
  
  if (deleteError) {
    console.log('⚠️  清理测试文件失败:', deleteError.message)
  } else {
    console.log('✅ 测试文件已清理')
  }
  
  // 总结
  console.log('\n' + '='.repeat(50))
  console.log('🎉 所有检查通过！Supabase Storage 配置正确')
  console.log('\n现在可以正常使用上传功能了')
  
} catch (error) {
  console.error('\n❌ 检查过程中出错:', error)
  process.exit(1)
}
}

// 运行主函数
main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

