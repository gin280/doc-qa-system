import useSWR from 'swr'
import { useMemo } from 'react'

/**
 * 文档列表查询参数
 */
export interface DocumentsQueryParams {
  page?: number          // 当前页码(从1开始)
  limit?: number         // 每页数量(默认20)
  search?: string        // 搜索关键词
  sortBy?: 'uploadedAt' | 'filename' | 'fileSize' | 'status'
  sortOrder?: 'asc' | 'desc'
}

/**
 * 文档对象
 */
export interface Document {
  id: string
  filename: string
  fileSize: number
  fileType: string
  status: 'PENDING' | 'PARSING' | 'EMBEDDING' | 'READY' | 'FAILED'
  chunksCount: number
  uploadedAt: string
  metadata?: {
    error?: {
      type: string
      message: string
    }
  }
}

/**
 * API响应
 */
interface DocumentsResponse {
  documents: Document[]
  total: number
  page: number
  totalPages: number
}

/**
 * SWR fetcher
 */
const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Failed to fetch documents')
  }
  return res.json()
}

/**
 * 文档管理Hook
 */
export function useDocuments(params: DocumentsQueryParams = {}) {
  const { page = 1, limit = 20, search, sortBy = 'uploadedAt', sortOrder = 'desc' } = params
  
  // 构建查询字符串
  const queryString = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search && { search }),
    sortBy,
    sortOrder
  }).toString()

  // SWR配置 - 先获取初始数据
  const { data, error, mutate, isValidating } = useSWR<DocumentsResponse>(
    `/api/documents?${queryString}`,
    fetcher,
    {
      refreshInterval: 0, // 初始不轮询，由下面的逻辑决定
      revalidateOnFocus: true,
      dedupingInterval: 2000
    }
  )

  // 计算是否需要轮询：只有当存在处理中的文档时才轮询
  const hasProcessingDocs = useMemo(() => {
    if (!data?.documents) return false
    return data.documents.some(doc => 
      ['PENDING', 'PARSING', 'EMBEDDING'].includes(doc.status)
    )
  }, [data?.documents])

  // 使用条件性轮询配置
  const { data: pollingData } = useSWR<DocumentsResponse>(
    hasProcessingDocs ? `/api/documents?${queryString}` : null,
    fetcher,
    {
      refreshInterval: 5000, // 每5秒轮询
      revalidateOnFocus: false, // 避免重复请求
      dedupingInterval: 2000
    }
  )

  // 使用最新的数据（轮询数据优先）
  const finalData = pollingData || data

  /**
   * 重命名文档
   */
  const renameDocument = async (id: string, newFilename: string) => {
    const response = await fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: newFilename })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || '重命名失败')
    }

    // 乐观更新
    mutate()
    return response.json()
  }

  /**
   * 删除文档
   */
  const deleteDocument = async (id: string) => {
    const response = await fetch(`/api/documents/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || '删除失败')
    }

    // 乐观更新 - 从列表中移除
    mutate((current) => {
      if (!current) return current
      return {
        ...current,
        documents: current.documents.filter(doc => doc.id !== id),
        total: current.total - 1
      }
    }, false)

    return response.json()
  }

  return {
    documents: finalData?.documents || [],
    total: finalData?.total || 0,
    totalPages: finalData?.totalPages || 0,
    currentPage: finalData?.page || page,
    isLoading: !error && !finalData,
    isError: error,
    isValidating,
    hasProcessingDocs, // 暴露这个状态供测试使用
    renameDocument,
    deleteDocument,
    mutate
  }
}
