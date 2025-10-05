/**
 * 手动测试脚本：验证文档解析功能
 * 
 * 使用方法：
 * 1. 确保开发服务器运行: npm run dev
 * 2. 登录获取session cookie
 * 3. 运行: npx tsx scripts/test-parse-api.ts
 */

async function testParseAPI() {
  const baseUrl = 'http://localhost:3000'
  
  console.log('📝 文档解析API测试脚本')
  console.log('=' .repeat(50))
  
  // 提示用户提供信息
  console.log('\n使用步骤:')
  console.log('1. 先通过浏览器登录系统')
  console.log('2. 打开浏览器开发者工具 -> Application -> Cookies')
  console.log('3. 复制 next-auth.session-token 的值')
  console.log('4. 上传一个文件获取 documentId')
  console.log('5. 修改下面的 DOCUMENT_ID 和 SESSION_TOKEN')
  console.log('\n然后运行此脚本...\n')
  
  // 需要手动填写
  const DOCUMENT_ID = 'your-document-id-here'
  const SESSION_TOKEN = 'your-session-token-here'
  
  if (DOCUMENT_ID === 'your-document-id-here') {
    console.log('❌ 请先修改脚本中的 DOCUMENT_ID 和 SESSION_TOKEN')
    return
  }
  
  try {
    // 测试GET解析状态
    console.log(`\n📊 查询文档解析状态: ${DOCUMENT_ID}`)
    const response = await fetch(`${baseUrl}/api/documents/${DOCUMENT_ID}/parse`, {
      method: 'GET',
      headers: {
        'Cookie': `next-auth.session-token=${SESSION_TOKEN}`
      }
    })
    
    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ 查询成功!')
      console.log('文档状态:', JSON.stringify(data, null, 2))
      
      // 解析状态判断
      switch (data.status) {
        case 'PENDING':
          console.log('\n⏳ 文档等待解析中...')
          console.log('提示: 上传后会自动触发解析')
          break
        case 'PARSING':
          console.log('\n🔄 文档正在解析中...')
          console.log('提示: 请等待几秒后再次查询')
          break
        case 'READY':
          console.log('\n✅ 文档解析完成!')
          console.log(`📄 内容长度: ${data.contentLength} 字符`)
          console.log(`⏱️  解析时间: ${data.metadata?.parseTime}ms`)
          console.log(`💾 内存使用: ${(data.metadata?.memoryUsed / 1024 / 1024).toFixed(2)}MB`)
          console.log(`📊 元信息:`, data.metadata)
          break
        case 'FAILED':
          console.log('\n❌ 文档解析失败!')
          console.log('错误信息:', data.metadata?.error)
          break
      }
    } else {
      console.log('❌ 查询失败:', data)
    }
    
    // 如果状态是PENDING，可以尝试手动触发解析
    if (data.status === 'PENDING') {
      console.log('\n🔧 尝试手动触发解析...')
      const parseResponse = await fetch(`${baseUrl}/api/documents/${DOCUMENT_ID}/parse`, {
        method: 'POST',
        headers: {
          'Cookie': `next-auth.session-token=${SESSION_TOKEN}`
        }
      })
      
      const parseData = await parseResponse.json()
      console.log('解析结果:', parseData)
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error)
  }
}

// 运行测试
testParseAPI()

