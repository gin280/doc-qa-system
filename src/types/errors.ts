/**
 * 错误处理类型定义
 * 
 * 提供类型安全的错误处理工具，消除 `any` 类型使用
 */

/**
 * 带消息的错误接口
 * 
 * 用于表示任何包含 message 属性的错误对象
 */
export interface ErrorWithMessage {
  message: string
}

/**
 * 类型守卫: 检查是否为 ErrorWithMessage
 * 
 * @param error - 待检查的未知类型错误
 * @returns 如果 error 包含 message 字符串属性，返回 true
 * 
 * @example
 * ```typescript
 * try {
 *   // some code
 * } catch (error: unknown) {
 *   if (isErrorWithMessage(error)) {
 *     console.log(error.message) // TypeScript knows error has message
 *   }
 * }
 * ```
 */
export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  )
}

/**
 * 将任意错误转换为 ErrorWithMessage
 * 
 * @param maybeError - 任意类型的错误对象
 * @returns 包含 message 属性的错误对象
 * 
 * @remarks
 * 如果输入已经是 ErrorWithMessage，直接返回
 * 否则尝试序列化为 JSON，失败则转换为字符串
 * 
 * @example
 * ```typescript
 * catch (error: unknown) {
 *   const errorWithMessage = toErrorWithMessage(error)
 *   console.log(errorWithMessage.message)
 * }
 * ```
 */
export function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
  if (isErrorWithMessage(maybeError)) return maybeError

  try {
    return { message: JSON.stringify(maybeError) }
  } catch {
    // 处理循环引用或其他序列化问题
    return { message: String(maybeError) }
  }
}

/**
 * 安全地获取错误消息
 * 
 * @param error - 未知类型的错误
 * @returns 错误消息字符串
 * 
 * @remarks
 * 这是 toErrorWithMessage 的便捷包装，直接返回 message 字符串
 * 
 * @example
 * ```typescript
 * catch (error: unknown) {
 *   const message = getErrorMessage(error)
 *   return NextResponse.json({ error: message }, { status: 500 })
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  return toErrorWithMessage(error).message
}

