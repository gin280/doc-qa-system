'use client'

import { useDropzone } from 'react-dropzone'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
}

export function FileDropzone({ onFilesSelected, disabled }: FileDropzoneProps) {
  const handleDrop = (acceptedFiles: File[], rejectedFiles: any[]) => {
    console.log('[FileDropzone] Files dropped:', { 
      accepted: acceptedFiles.length, 
      rejected: rejectedFiles.length,
      acceptedFiles: acceptedFiles.map(f => ({ name: f.name, size: f.size, type: f.type })),
      rejectedFiles: rejectedFiles.map(r => ({ 
        file: r.file.name, 
        errors: r.errors.map((e: any) => e.message) 
      }))
    })
    
    if (rejectedFiles.length > 0) {
      console.warn('[FileDropzone] Some files were rejected:', rejectedFiles)
    }
    
    if (acceptedFiles.length > 0) {
      console.log('[FileDropzone] Calling onFilesSelected with accepted files')
      onFilesSelected(acceptedFiles)
    }
  }

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop: handleDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/markdown': ['.md'],
      'text/plain': ['.txt']
    },
    maxSize: 50 * 1024 * 1024,  // 50MB
    maxFiles: 10,
    disabled,
    multiple: true
  })

  // 使用主题系统颜色(来自Story 1.8)
  const borderColor = isDragActive 
    ? 'border-primary' 
    : isDragReject 
    ? 'border-destructive' 
    : 'border-muted-foreground/40'

  const rootProps = getRootProps()
  
  return (
    <div
      {...rootProps}
      className={cn(
        'relative border-2 border-dashed rounded-lg p-12 transition-all duration-200',
        'cursor-pointer hover:border-primary/60 hover:scale-[1.02] active:scale-[0.98]',
        borderColor,
        disabled && 'opacity-50 cursor-not-allowed hover:scale-100 active:scale-100'
      )}
    >
      <input {...getInputProps()} aria-label="文件上传区域" />
      
      <div className="flex flex-col items-center gap-4 text-center">
        <Upload className="h-12 w-12 text-muted-foreground" />
        
        {isDragActive ? (
          <p className="text-lg font-medium text-foreground">
            松开以上传文件
          </p>
        ) : (
          <>
            <div>
              <p className="text-lg font-medium text-foreground">
                拖拽文件到这里，或点击选择
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                支持 PDF、Word、Markdown、TXT 格式
              </p>
              <p className="text-sm text-muted-foreground">
                单文件最大 50MB，最多 10 个文件
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

