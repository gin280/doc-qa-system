/**
 * API 响应类型定义
 * 
 * 提供统一的 API 响应格式，消除响应处理中的 `any` 类型
 */

/**
 * 标准 API 错误响应
 * 
 * @property error - 错误消息
 * @property details - 详细错误信息 (可选，通常仅在开发环境返回)
 * @property code - 错误代码 (可选，用于客户端错误处理)
 */
export interface ApiError {
  error: string
  details?: string
  code?: string
}

/**
 * 统一的 API 响应包装
 * 
 * @template T - 成功响应数据的类型
 * 
 * @property success - 请求是否成功
 * @property data - 成功时的数据 (可选)
 * @property error - 失败时的错误信息 (可选)
 * @property timestamp - 响应时间戳 (可选)
 * 
 * @example
 * ```typescript
 * // API Route 返回
 * return NextResponse.json<ApiResponse<User>>({
 *   success: true,
 *   data: user,
 *   timestamp: new Date().toISOString()
 * })
 * 
 * // API Route 错误返回
 * return NextResponse.json<ApiResponse<User>>({
 *   success: false,
 *   error: {
 *     error: 'User not found',
 *     code: 'USER_NOT_FOUND'
 *   }
 * }, { status: 404 })
 * ```
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
  timestamp?: string
}

/**
 * 分页响应
 * 
 * @template T - 列表项的类型
 * 
 * @property items - 当前页的项目列表
 * @property total - 总项目数
 * @property page - 当前页码 (从 1 开始)
 * @property pageSize - 每页大小
 * @property hasMore - 是否有更多页
 * 
 * @example
 * ```typescript
 * const response: ApiResponse<PaginatedResponse<Document>> = {
 *   success: true,
 *   data: {
 *     items: documents,
 *     total: 100,
 *     page: 1,
 *     pageSize: 20,
 *     hasMore: true
 *   }
 * }
 * ```
 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/**
 * 类型守卫: 检查是否为成功响应
 * 
 * @param response - API 响应对象
 * @returns 如果响应成功且包含 data，返回 true
 * 
 * @remarks
 * 使用此守卫后，TypeScript 会推断 response.data 必定存在
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/users').then(r => r.json()) as ApiResponse<User>
 * 
 * if (isSuccessResponse(response)) {
 *   console.log(response.data.name) // TypeScript 知道 data 存在
 * } else {
 *   console.error(response.error?.error)
 * }
 * ```
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { data: T } {
  return response.success === true && response.data !== undefined
}

/**
 * 类型守卫: 检查是否为错误响应
 * 
 * @param response - API 响应对象
 * @returns 如果响应失败且包含 error，返回 true
 * 
 * @remarks
 * 使用此守卫后，TypeScript 会推断 response.error 必定存在
 * 
 * @example
 * ```typescript
 * const response = await fetch('/api/users').then(r => r.json()) as ApiResponse<User>
 * 
 * if (isErrorResponse(response)) {
 *   console.error(response.error.error) // TypeScript 知道 error 存在
 *   if (response.error.code === 'NOT_FOUND') {
 *     // 处理特定错误
 *   }
 * }
 * ```
 */
export function isErrorResponse<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { error: ApiError } {
  return response.success === false && response.error !== undefined
}

