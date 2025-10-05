'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Search, X } from 'lucide-react'

interface Props {
  value: string
  onSearch: (value: string) => void
  sortBy: string
  sortOrder: string
  onSortChange: (by: string, order: string) => void
}

export function DocumentSearchBar({
  value,
  onSearch,
  sortBy,
  sortOrder,
  onSortChange
}: Props) {
  const [searchValue, setSearchValue] = useState(value)

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(searchValue)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchValue, onSearch])

  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6">
      {/* 搜索框 */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="搜索文档..."
          className="pl-10 pr-10"
        />
        {searchValue && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
            onClick={() => {
              setSearchValue('')
              onSearch('')
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 排序选择器 */}
      <div className="flex gap-2">
        <Select
          value={sortBy}
          onValueChange={(value) => onSortChange(value, sortOrder)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="排序方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="uploadedAt">上传时间</SelectItem>
            <SelectItem value="filename">文件名</SelectItem>
            <SelectItem value="fileSize">文件大小</SelectItem>
            <SelectItem value="status">状态</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sortOrder}
          onValueChange={(value) => onSortChange(sortBy, value)}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="顺序" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">降序</SelectItem>
            <SelectItem value="asc">升序</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
