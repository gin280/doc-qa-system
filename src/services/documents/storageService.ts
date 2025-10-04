import { supabaseAdmin } from '@/lib/supabase'

const STORAGE_BUCKET = 'documents'
const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAY = 1000 // ms

export class StorageService {
  /**
   * 上传文件到Supabase Storage
   * 使用指数退避重试策略
   * 
   * 注意：Supabase Storage 不支持中文路径，因此使用 documentId + 扩展名作为存储路径
   * 原始文件名会保存在数据库的 filename 和 metadata 字段中
   */
  static async uploadFile(
    userId: string,
    documentId: string,
    file: File,
    sanitizedFilename: string
  ): Promise<string> {
    // 从文件名提取扩展名
    const fileExtension = sanitizedFilename.match(/\.[^.]+$/)?.[0] || ''
    // 使用纯英文路径: userId/documentId.ext
    const storagePath = `${userId}/${documentId}${fileExtension}`
    
    let attempt = 0
    let lastError: Error | null = null

    while (attempt < MAX_RETRY_ATTEMPTS) {
      try {
        const { data, error } = await supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
          })

        if (error) {
          // 提供更具体的错误信息
          let errorMessage = error.message
          if (error.message.includes('Bucket not found')) {
            errorMessage = `Bucket "${STORAGE_BUCKET}" not found. Please create it in Supabase Dashboard.`
          } else if (error.message.includes('new row violates row-level security policy')) {
            errorMessage = 'Permission denied. Please check RLS policies for the documents bucket.'
          }
          throw new Error(`Supabase Storage upload failed: ${errorMessage}`)
        }

        return data.path
      } catch (error) {
        lastError = error as Error
        attempt++
        
        if (attempt < MAX_RETRY_ATTEMPTS) {
          const delay = RETRY_DELAY * Math.pow(2, attempt - 1)
          // 指数退避: 1s, 2s, 4s
          await new Promise(resolve => 
            setTimeout(resolve, delay)
          )
        }
      }
    }

    throw new Error(
      `Failed to upload file after ${MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message}`
    )
  }

  /**
   * 从Storage获取文件
   * 返回文件Buffer供解析使用
   */
  static async getFile(storagePath: string): Promise<ArrayBuffer> {
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .download(storagePath)

    if (error) {
      throw new Error(`Failed to download file: ${error.message}`)
    }

    return await data.arrayBuffer()
  }

  /**
   * 生成文件的临时签名URL
   * 用于前端预览或下载
   */
  static async getSignedUrl(
    storagePath: string,
    expiresIn: number = 3600 // 1小时
  ): Promise<string> {
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, expiresIn)

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`)
    }

    return data.signedUrl
  }

  /**
   * 删除Storage中的文件
   */
  static async deleteFile(storagePath: string): Promise<void> {
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath])

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`)
    }
  }

  /**
   * 检查文件是否存在
   */
  static async fileExists(storagePath: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .list(storagePath.split('/').slice(0, -1).join('/'))

    if (error) return false
    
    const filename = storagePath.split('/').pop()
    return data?.some(file => file.name === filename) ?? false
  }
}

