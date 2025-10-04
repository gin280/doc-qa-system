'use client'

import { useState, useCallback, useRef } from 'react'
import { createId } from '@paralleldrive/cuid2'
import { toast } from 'sonner'

export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error'

export interface UploadItem {
  id: string
  file: File
  progress: number
  status: UploadStatus
  error?: string
  documentId?: string
  xhr?: XMLHttpRequest
}

const MAX_CONCURRENT_UPLOADS = 3
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_FILES_PER_BATCH = 10
const MAX_TOTAL_SIZE = 200 * 1024 * 1024 // 200MB (PERF-002 mitigation)

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/markdown',
  'text/plain'
]

export function useDocumentUpload() {
  const [items, setItems] = useState<UploadItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const uploadQueueRef = useRef<UploadItem[]>([])

  // 验证文件
  const validateFiles = useCallback((files: File[]): { valid: File[], errors: string[] } => {
    const errors: string[] = []
    const valid: File[] = []

    // 检查总文件大小 (PERF-002)
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    if (totalSize > MAX_TOTAL_SIZE) {
      errors.push(`批量文件总大小超过 ${MAX_TOTAL_SIZE / (1024 * 1024)}MB`)
      return { valid, errors }
    }

    files.forEach(file => {
      // 大小验证
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`文件过大(超过50MB): ${file.name}`)
        return
      }

      if (file.size === 0) {
        errors.push(`文件为空: ${file.name}`)
        return
      }

      // 格式验证
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        errors.push(`不支持的文件格式: ${file.name}`)
        return
      }

      // 文件名验证 (SEC-001 partial - 清理文件名)
      // 允许：字母、数字、中文、下划线、连字符、点、空格、括号
      if (!/^[\w\u4e00-\u9fa5\-. ()]+\.(pdf|docx?|md|txt)$/i.test(file.name)) {
        errors.push(`文件名包含非法字符: ${file.name}`)
        return
      }

      valid.push(file)
    })

    return { valid, errors }
  }, [])

  // 添加文件到队列
  const addFiles = useCallback((files: File[]) => {
    // 数量验证
    if (items.length + files.length > MAX_FILES_PER_BATCH) {
      toast.error('文件数量超限', {
        description: `单次最多上传${MAX_FILES_PER_BATCH}个文件`
      })
      return
    }

    // 验证文件
    const { valid, errors } = validateFiles(files)
    
    if (errors.length > 0) {
      errors.forEach(error => {
        toast.error('文件验证失败', {
          description: error
        })
      })
    }

    if (valid.length === 0) {
      return
    }

    // 添加到队列
    const newItems: UploadItem[] = valid.map(file => ({
      id: createId(),
      file,
      progress: 0,
      status: 'pending'
    }))

    setItems(prev => [...prev, ...newItems])
    uploadQueueRef.current = [...uploadQueueRef.current, ...newItems]
    
    // 自动开始上传
    setTimeout(() => processUploadQueue(), 100)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, validateFiles])

  // 上传单个文件
  const uploadFile = useCallback(async (item: UploadItem): Promise<void> => {
    return new Promise((resolve, reject) => {
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, status: 'uploading', progress: 0 } : i
      ))

      const formData = new FormData()
      formData.append('file', item.file)

      const xhr = new XMLHttpRequest()

      // 保存 xhr 引用以便取消
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, xhr } : i
      ))

      // 监听上传进度
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          // 进度只到95%，保留最后5%用于服务器处理
          // 这样用户就不会看到"100%但还没成功"的困惑状态
          const uploadProgress = Math.round((e.loaded / e.total) * 100)
          const progress = Math.min(uploadProgress, 95)
          setItems(prev => prev.map(i =>
            i.id === item.id ? { ...i, progress } : i
          ))
        }
      })

      // 完成
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText)
            setItems(prev => prev.map(i =>
              i.id === item.id
                ? { ...i, status: 'success', progress: 100, documentId: response.documents[0]?.id }
                : i
            ))
            toast.success('上传成功', {
              description: `${item.file.name} 上传完成`
            })
            resolve()
          } catch (error) {
            console.error('[Upload] Response parse error:', error)
            setItems(prev => prev.map(i =>
              i.id === item.id
                ? { ...i, status: 'error', error: '响应解析失败' }
                : i
            ))
            toast.error('上传失败', {
              description: '响应解析失败'
            })
            reject(error)
          }
        } else {
          let errorMessage = '上传失败'
          let errorDetails = ''
          try {
            const errorResponse = JSON.parse(xhr.responseText)
            errorMessage = errorResponse.error || errorMessage
            errorDetails = errorResponse.details || ''
            console.error('[Upload] Server error:', errorResponse)
          } catch {
            // 非JSON响应
          }
          
          setItems(prev => prev.map(i =>
            i.id === item.id
              ? { ...i, status: 'error', error: errorMessage }
              : i
          ))
          toast.error('上传失败', {
            description: errorDetails || errorMessage
          })
          reject(new Error(errorMessage))
        }
      })

      // 错误处理
      xhr.addEventListener('error', () => {
        console.error('[Upload] Network error')
        setItems(prev => prev.map(i =>
          i.id === item.id
            ? { ...i, status: 'error', error: '网络错误，请检查连接' }
            : i
        ))
        toast.error('上传失败', {
          description: '网络错误，请检查连接'
        })
        reject(new Error('Network error'))
      })

      // 超时处理
      xhr.addEventListener('timeout', () => {
        console.error('[Upload] Timeout')
        setItems(prev => prev.map(i =>
          i.id === item.id
            ? { ...i, status: 'error', error: '上传超时，请重试' }
            : i
        ))
        toast.error('上传超时', {
          description: '请重试或联系管理员'
        })
        reject(new Error('Timeout'))
      })

      xhr.timeout = 5 * 60 * 1000 // 5分钟超时
      xhr.open('POST', '/api/documents/upload')
      xhr.send(formData)
    })
  }, [])

  // 处理上传队列(并发控制)
  const processUploadQueue = useCallback(async () => {
    if (isUploading) {
      return
    }
    
    // 直接使用uploadQueueRef，不依赖items状态
    const queue = uploadQueueRef.current
    
    if (queue.length === 0) {
      return
    }

    setIsUploading(true)

    const uploading: Set<Promise<void>> = new Set()
    let queueIndex = 0

    const uploadNext = async () => {
      if (queueIndex >= queue.length) return

      const item = queue[queueIndex++]
      const uploadPromise = uploadFile(item)
        .catch(() => {
          // 错误已在 uploadFile 中处理
        })
        .finally(() => {
          uploading.delete(uploadPromise)
          uploadNext() // 继续下一个
        })

      uploading.add(uploadPromise)
    }

    // 启动初始并发上传
    const initialUploads = Math.min(MAX_CONCURRENT_UPLOADS, queue.length)
    for (let i = 0; i < initialUploads; i++) {
      uploadNext()
    }

    // 等待所有上传完成
    while (uploading.size > 0) {
      await Promise.race(Array.from(uploading))
    }

    setIsUploading(false)
    uploadQueueRef.current = []

    // 显示完成通知
    const currentItems = items
    const successCount = currentItems.filter(i => i.status === 'success').length
    const failCount = currentItems.filter(i => i.status === 'error').length

    if (failCount === 0 && successCount > 0) {
      toast.success('上传完成', {
        description: `成功上传 ${successCount} 个文档`
      })
    } else if (successCount > 0 || failCount > 0) {
      if (failCount > successCount) {
        toast.error('上传完成', {
          description: `${successCount} 个成功，${failCount} 个失败`
        })
      } else {
        toast.success('上传完成', {
          description: `${successCount} 个成功，${failCount} 个失败`
        })
      }
    }
  }, [isUploading, uploadFile])

  // 取消上传
  const cancelUpload = useCallback((id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id)
      if (item?.xhr) {
        item.xhr.abort()
      }
      return prev.filter(i => i.id !== id)
    })
    uploadQueueRef.current = uploadQueueRef.current.filter(i => i.id !== id)
  }, [])

  // 重试上传
  const retryUpload = useCallback((id: string) => {
    setItems(prev => prev.map(i => 
      i.id === id ? { ...i, status: 'pending', progress: 0, error: undefined } : i
    ))
    
    const item = items.find(i => i.id === id)
    if (item) {
      uploadQueueRef.current.push({ ...item, status: 'pending' })
      setTimeout(() => processUploadQueue(), 100)
    }
  }, [items, processUploadQueue])

  // 移除项目
  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  // 清空队列
  const clearAll = useCallback(() => {
    setItems([])
    uploadQueueRef.current = []
  }, [])

  return {
    items,
    isUploading,
    addFiles,
    cancelUpload,
    retryUpload,
    removeItem,
    clearAll
  }
}

