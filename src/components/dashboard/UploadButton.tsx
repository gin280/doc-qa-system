'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { DocumentUploadModal } from '@/components/documents/DocumentUploadModal'
import { Upload, ArrowRight } from 'lucide-react'

export function UploadButton() {
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  return (
    <>
      <Card 
        className="p-6 hover:shadow-lg transition-all hover:border-primary cursor-pointer group"
        onClick={() => setUploadModalOpen(true)}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-foreground">上传文档</h3>
            <p className="text-sm text-muted-foreground">
              快速上传新文档
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </Card>

      <DocumentUploadModal 
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
      />
    </>
  )
}
