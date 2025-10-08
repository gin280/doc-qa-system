// src/services/export/exportFormatter.ts
// 导出格式化工具

import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

/**
 * 清理文件名，移除非法字符
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // 移除非法字符
    .replace(/\s+/g, '_') // 空格替换为下划线
    .substring(0, 100) // 限制长度
}

/**
 * 格式化日期为中文格式
 */
export function formatDate(date: Date): string {
  return format(date, 'yyyy年MM月dd日 HH:mm:ss', { locale: zhCN })
}

/**
 * 格式化日期为文件名格式
 */
export function formatDateForFilename(date: Date = new Date()): string {
  return format(date, 'yyyyMMdd_HHmmss')
}

/**
 * 转义 Markdown 特殊字符
 */
export function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

/**
 * 生成导出文件名
 */
export function generateExportFilename(
  title: string,
  format: 'markdown' | 'pdf',
  date: Date = new Date()
): string {
  const cleanTitle = sanitizeFilename(title)
  const dateStr = formatDateForFilename(date)
  const extension = format === 'markdown' ? 'md' : 'pdf'
  return `${cleanTitle}_${dateStr}.${extension}`
}

/**
 * 生成批量导出文件夹名
 */
export function generateBatchExportFolderName(date: Date = new Date()): string {
  const dateStr = formatDateForFilename(date)
  return `对话导出_${dateStr}`
}
