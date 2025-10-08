// src/services/export/zipGenerator.ts
// ZIP 打包服务

import JSZip from 'jszip'
import { generateBatchExportFolderName } from './exportFormatter'

export interface ExportFile {
  filename: string
  content: Buffer
}

/**
 * 生成包含多个导出文件的 ZIP 压缩包
 */
export async function generateZipExport(
  files: ExportFile[],
  folderName?: string
): Promise<Buffer> {
  const zip = new JSZip()
  
  // 创建文件夹
  const folder = folderName || generateBatchExportFolderName()
  const zipFolder = zip.folder(folder)
  
  if (!zipFolder) {
    throw new Error('Failed to create ZIP folder')
  }

  // 添加所有文件到 ZIP
  for (const file of files) {
    zipFolder.file(file.filename, file.content)
  }

  // 生成 ZIP
  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6 // 平衡压缩率和速度
    }
  })

  return zipBuffer
}
