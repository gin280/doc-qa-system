/**
 * 文档解析结果
 */
export interface ParseResult {
  content: string          // 提取的纯文本内容
  contentLength: number    // 字符数
  metadata: Record<string, any>  // 文档元信息
}

/**
 * 解析错误类型
 */
export type ParseErrorType = 
  | 'PARSE_ERROR' 
  | 'TIMEOUT_ERROR' 
  | 'MEMORY_ERROR' 
  | 'ENCRYPTION_ERROR'
  | 'UNSUPPORTED_FORMAT'

/**
 * 解析错误
 */
export class ParseError extends Error {
  constructor(
    public type: ParseErrorType,
    message: string
  ) {
    super(message)
    this.name = 'ParseError'
  }
}

