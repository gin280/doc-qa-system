// src/services/export/markdownExporter.ts
// Markdown 导出服务

import { formatDate } from './exportFormatter'

export interface ConversationExportData {
  id: string
  title: string
  documentName: string
  createdAt: Date
  messages: Array<{
    id: string
    role: 'USER' | 'ASSISTANT'
    content: string
    citations?: Array<{
      id: string
      documentName: string
      pageNumber?: number
      quoteText: string
      relevanceScore: number
    }>
    createdAt: Date
  }>
}

/**
 * 生成 Markdown 格式的对话导出
 */
export async function generateMarkdownExport(
  data: ConversationExportData
): Promise<Buffer> {
  const { title, documentName, createdAt, messages } = data
  
  // 构建 Markdown 内容
  let markdown = `# 对话: ${title}\n\n`
  markdown += `**关联文档**: ${documentName}\n`
  markdown += `**创建时间**: ${formatDate(createdAt)}\n`
  markdown += `**导出时间**: ${formatDate(new Date())}\n`
  markdown += `**系统**: DocQA System v1.0\n\n`
  markdown += `---\n\n`

  // 遍历消息
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    
    if (msg.role === 'USER') {
      markdown += `## Q: ${msg.content}\n\n`
    } else {
      markdown += `${msg.content}\n\n`
      
      // 添加引用（如果有）
      if (msg.citations && msg.citations.length > 0) {
        markdown += `**引用来源**:\n`
        msg.citations.forEach((citation, idx) => {
          const location = citation.pageNumber 
            ? `第${citation.pageNumber}页` 
            : '文档片段'
          markdown += `- [${idx + 1}] ${citation.documentName} - ${location}\n`
        })
        markdown += `\n`
      }
      
      markdown += `---\n\n`
    }
  }

  // 添加页脚
  markdown += `\n\n*导出于 ${formatDate(new Date())}*\n`

  return Buffer.from(markdown, 'utf-8')
}
