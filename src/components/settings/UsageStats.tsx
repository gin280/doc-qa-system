'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

interface UserUsage {
  documentCount: number
  documentLimit: number
  storageUsed: number
  storageLimit: number
  queryCount: number
  queryLimit: number
  queryResetDate: string
}

/**
 * UsageStats - 使用量统计组件
 * 
 * 功能:
 * - 显示文档数量使用情况
 * - 显示存储空间使用情况
 * - 显示查询次数使用情况
 */
export function UsageStats() {
  const [usage, setUsage] = useState<UserUsage | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchUserUsage()
  }, [])

  const fetchUserUsage = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/user/usage')
      if (!res.ok) throw new Error('Failed to fetch usage')
      const data = await res.json()
      setUsage(data)
    } catch (error) {
      toast.error('加载使用量统计失败')
    } finally {
      setIsLoading(false)
    }
  }

  const getUsagePercentage = (current: number, limit: number) => {
    return Math.round((current / limit) * 100)
  }

  const formatStorageSize = (bytes: number) => {
    if (bytes === 0) return '0 MB'
    const mb = bytes / (1024 * 1024)
    if (mb < 1024) return `${Math.round(mb)} MB`
    const gb = mb / 1024
    return `${gb.toFixed(2)} GB`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (isLoading || !usage) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>使用量统计</CardTitle>
        <CardDescription>查看您的存储和查询使用情况</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 文档数量 */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">文档数量</span>
            <span className="text-sm text-muted-foreground">
              {usage.documentCount} / {usage.documentLimit}
            </span>
          </div>
          <Progress 
            value={getUsagePercentage(usage.documentCount, usage.documentLimit)}
          />
        </div>

        {/* 存储空间 */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">存储空间</span>
            <span className="text-sm text-muted-foreground">
              {formatStorageSize(usage.storageUsed)} / {formatStorageSize(usage.storageLimit)}
            </span>
          </div>
          <Progress 
            value={getUsagePercentage(usage.storageUsed, usage.storageLimit)}
          />
        </div>

        {/* 查询次数 */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">查询次数(本月)</span>
            <span className="text-sm text-muted-foreground">
              {usage.queryCount} / {usage.queryLimit}
            </span>
          </div>
          <Progress 
            value={getUsagePercentage(usage.queryCount, usage.queryLimit)}
          />
          <p className="text-xs text-muted-foreground mt-2">
            重置日期: {formatDate(usage.queryResetDate)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

