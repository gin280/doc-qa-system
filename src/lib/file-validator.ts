import { fileTypeFromBuffer } from 'file-type'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

// MIME类型到文件扩展名的映射
const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'text/markdown': ['.md'],
  'text/plain': ['.txt']
}

export interface FileValidationResult {
  valid: boolean
  error?: string
  detectedType?: string
}

/**
 * SEC-001 Mitigation: Magic Bytes 文件签名验证
 * 
 * 防止 MIME Type Spoofing 攻击
 * 通过检查文件的实际二进制签名来验证文件类型
 */
export async function validateFileType(
  file: Buffer,
  declaredMimeType: string
): Promise<FileValidationResult> {
  try {
    // 获取文件的前几个字节进行签名检测
    const buffer: Buffer = file

    // 使用 file-type 库检测真实文件类型
    const detectedType = await fileTypeFromBuffer(buffer)

    // 文本文件（.txt, .md）无法通过 magic bytes 识别
    // 需要额外的验证逻辑
    if (!detectedType) {
      // 对于文本文件，检查声明的 MIME 类型是否是允许的文本类型
      if (declaredMimeType === 'text/plain' || declaredMimeType === 'text/markdown') {
        // 检查文件内容是否为有效的文本
        const isValidText = validateTextContent(buffer)
        if (!isValidText) {
          return {
            valid: false,
            error: '文件内容不是有效的文本格式'
          }
        }
        return { valid: true, detectedType: declaredMimeType }
      }
      
      return {
        valid: false,
        error: '无法识别文件类型，可能不是支持的格式'
      }
    }

    // 验证检测到的类型是否与声明的类型匹配
    const allowedMimeTypes = Object.keys(ALLOWED_FILE_TYPES)
    
    if (!allowedMimeTypes.includes(detectedType.mime)) {
      return {
        valid: false,
        error: `不支持的文件类型: ${detectedType.mime}`,
        detectedType: detectedType.mime
      }
    }

    // 检测到的类型与声明的类型不匹配
    if (detectedType.mime !== declaredMimeType) {
      return {
        valid: false,
        error: `文件类型不匹配。声明: ${declaredMimeType}, 实际: ${detectedType.mime}`,
        detectedType: detectedType.mime
      }
    }

    return { valid: true, detectedType: detectedType.mime }
  } catch (error) {
    console.error('File type validation error:', error)
    return {
      valid: false,
      error: '文件类型验证失败'
    }
  }
}

/**
 * 验证文本内容
 * 检查文件是否包含有效的文本字符
 */
function validateTextContent(buffer: Buffer): boolean {
  // 检查前 1024 字节
  const sampleSize = Math.min(buffer.length, 1024)
  const sample = buffer.subarray(0, sampleSize)
  
  // 统计非文本字符的数量
  let nonTextCount = 0
  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i]
    // 允许的字符: 可打印 ASCII (32-126), 换行符 (10), 回车符 (13), Tab (9), UTF-8 多字节
    if (
      !(byte >= 32 && byte <= 126) && // 可打印 ASCII
      byte !== 10 && // LF
      byte !== 13 && // CR
      byte !== 9 &&  // TAB
      byte < 128 // 简单的 UTF-8 检查
    ) {
      nonTextCount++
    }
  }
  
  // 如果超过 10% 是非文本字符，认为不是文本文件
  return nonTextCount / sample.length < 0.1
}

/**
 * 验证文件大小
 */
export function validateFileSize(size: number): FileValidationResult {
  if (size === 0) {
    return {
      valid: false,
      error: '文件为空'
    }
  }

  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `文件大小超过限制(${MAX_FILE_SIZE / (1024 * 1024)}MB)`
    }
  }

  return { valid: true }
}

/**
 * SEC-001 Mitigation: 清理文件名
 * 
 * 防止路径遍历攻击和特殊字符注入
 */
export function sanitizeFilename(filename: string): string {
  // 1. 移除路径分隔符
  let sanitized = filename.replace(/[\/\\]/g, '')
  
  // 2. 移除特殊字符，只保留字母、数字、中文、下划线、连字符、点和括号
  sanitized = sanitized.replace(/[^\w\u4e00-\u9fa5\-. ()]/g, '_')
  
  // 3. 防止多个连续的点（可能用于隐藏文件或扩展名欺骗）
  sanitized = sanitized.replace(/\.{2,}/g, '.')
  
  // 4. 确保文件名不以点开头（隐藏文件）
  sanitized = sanitized.replace(/^\.+/, '')
  
  // 5. 限制文件名长度（防止过长的文件名）
  const maxLength = 255
  if (sanitized.length > maxLength) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'))
    const name = sanitized.substring(0, maxLength - ext.length)
    sanitized = name + ext
  }
  
  return sanitized || 'unnamed_file'
}

/**
 * 验证文件扩展名是否与 MIME 类型匹配
 * 
 * 注意：浏览器对文件类型识别不一致，特别是.md和.txt文件
 * 可能被识别为text/plain, text/markdown, 或application/octet-stream
 */
export function validateFileExtension(
  filename: string,
  mimeType: string
): FileValidationResult {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0]
  
  if (!ext) {
    return {
      valid: false,
      error: '文件没有扩展名'
    }
  }

  // 特殊处理：浏览器可能把.md和.txt识别为application/octet-stream
  if (mimeType === 'application/octet-stream') {
    const textExtensions = ['.md', '.txt']
    if (textExtensions.includes(ext)) {
      return { valid: true }
    }
    return {
      valid: false,
      error: `文件扩展名 ${ext} 与 MIME 类型 ${mimeType} 不匹配`
    }
  }

  const allowedExtensions = ALLOWED_FILE_TYPES[mimeType]
  
  if (!allowedExtensions || !allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `文件扩展名 ${ext} 与 MIME 类型 ${mimeType} 不匹配`
    }
  }

  return { valid: true }
}

