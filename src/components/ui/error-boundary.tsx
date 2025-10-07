'use client'

import React, { Component, ReactNode } from 'react'
import { AlertCircle, Download } from 'lucide-react'
import { Button } from './button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  onReset?: () => void
  resetKeys?: Array<string | number>
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * 错误边界组件
 * 捕获子组件渲染错误，显示降级UI
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  componentDidUpdate(prevProps: Props) {
    // 如果resetKeys变化，重置错误状态
    if (
      this.state.hasError &&
      this.props.resetKeys &&
      prevProps.resetKeys &&
      this.props.resetKeys.some((key, i) => key !== prevProps.resetKeys?.[i])
    ) {
      this.reset()
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback
      }

      // 默认错误UI
      return (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">渲染出错</h3>
          <p className="text-sm text-muted-foreground text-center mb-4">
            {this.state.error?.message || '内容无法显示'}
          </p>
          <Button onClick={this.reset} variant="outline" size="sm">
            重试
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * 文档预览错误边界 - 带下载备选方案
 */
interface PreviewErrorBoundaryProps {
  children: ReactNode
  onDownload?: () => void
}

export function PreviewErrorBoundary({ 
  children, 
  onDownload
}: PreviewErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">无法预览此文档</h3>
          <p className="text-sm text-muted-foreground text-center mb-4">
            文档格式可能不支持在线预览，或文件可能已损坏
          </p>
          {onDownload && (
            <Button onClick={onDownload} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              下载查看
            </Button>
          )}
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
