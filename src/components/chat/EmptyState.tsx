'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, ArrowRight, FileText, MessageSquare, Loader2 } from 'lucide-react';

interface EmptyStateProps {
  selectedDocument?: { id: string; name: string } | null;
  onExampleClick?: (example: string) => void;
  onUploadClick?: () => void;
}

/**
 * EmptyState - 对话为空状态
 * 
 * 根据用户的文档状态显示不同的引导:
 * 1. 无文档: 显示上传引导
 * 2. 有文档但未选择: 显示选择引导
 * 3. 已选择文档: 显示示例问题
 */
export function EmptyState({ selectedDocument, onExampleClick, onUploadClick }: EmptyStateProps) {
  const [documentStatus, setDocumentStatus] = useState<{
    hasAny: boolean;
    hasReady: boolean;
    hasProcessing: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 检查用户的文档状态
  useEffect(() => {
    async function checkDocuments() {
      try {
        const res = await fetch('/api/documents?page=1&limit=100'); // 获取足够多的文档来检查状态
        if (res.ok) {
          const data = await res.json();
          const docs = data.documents || [];
          setDocumentStatus({
            hasAny: docs.length > 0,
            hasReady: docs.some((d: any) => d.status === 'READY'),
            hasProcessing: docs.some((d: any) => 
              ['PENDING', 'PARSING', 'EMBEDDING'].includes(d.status)
            )
          });
        } else {
          setDocumentStatus({ hasAny: true, hasReady: true, hasProcessing: false }); // 默认显示示例问题
        }
      } catch (error) {
        console.error('Failed to check documents:', error);
        setDocumentStatus({ hasAny: true, hasReady: true, hasProcessing: false }); // 错误时默认显示示例问题
      } finally {
        setIsLoading(false);
      }
    }
    checkDocuments();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // 场景 1: 用户没有任何文档 - 显示上传引导
  if (documentStatus && !documentStatus.hasAny) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Card className="max-w-2xl w-full border-2 border-dashed">
          <CardContent className="pt-12 pb-12">
            <div className="text-center space-y-6">
              {/* 图标 */}
              <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-10 w-10 text-primary" />
              </div>

              {/* 标题和描述 */}
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">
                  欢迎使用 DocQA! 👋
                </h2>
                <p className="text-muted-foreground text-lg">
                  开始之前，请先上传您的文档
                </p>
              </div>

              {/* 上传按钮 */}
              <Button 
                size="lg" 
                className="gap-2 text-lg px-8 py-6"
                onClick={onUploadClick}
              >
                <Upload className="h-5 w-5" />
                上传文档
              </Button>

              {/* 说明信息 */}
              <div className="pt-4 space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-3 justify-center">
                  <ArrowRight className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span className="text-left">支持 PDF、Word、Markdown 等多种格式</span>
                </div>
                <div className="flex items-start gap-3 justify-center">
                  <ArrowRight className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span className="text-left">单个文件最大 10MB</span>
                </div>
                <div className="flex items-start gap-3 justify-center">
                  <ArrowRight className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span className="text-left">上传后即可开始智能问答</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 场景 2: 有文档但都在处理中 - 显示处理中提示
  if (documentStatus && documentStatus.hasProcessing && !documentStatus.hasReady && !selectedDocument) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Card className="max-w-md w-full">
          <CardContent className="pt-12 pb-12">
            <div className="text-center space-y-6">
              {/* 动画图标 */}
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>

              {/* 标题和描述 */}
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">文档处理中...</h3>
                <p className="text-muted-foreground">
                  您的文档正在向量化处理，通常需要几分钟时间
                </p>
                <p className="text-sm text-muted-foreground">
                  处理完成后即可开始提问
                </p>
              </div>

              {/* 或者上传新文档 */}
              <div className="pt-2">
                <Button 
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={onUploadClick}
                >
                  <Upload className="h-4 w-4" />
                  或上传更多文档
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 场景 3: 有可用文档但未选择 - 显示选择引导
  if (documentStatus && documentStatus.hasReady && !selectedDocument) {
  return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Card className="max-w-md w-full">
          <CardContent className="pt-12 pb-12">
            <div className="text-center space-y-6">
      {/* 图标 */}
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-8 w-8 text-primary" />
              </div>

              {/* 标题和描述 */}
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">选择一个文档</h3>
                <p className="text-muted-foreground">
                  从左侧边栏选择一个文档，即可开始提问
                </p>
              </div>

              {/* 或者上传新文档 */}
              <div className="pt-2">
                <Button 
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={onUploadClick}
                >
                  <Upload className="h-4 w-4" />
                  或上传新文档
                </Button>
              </div>
        </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 场景 3: 已选择文档 - 显示示例问题
  const exampleQuestions = [
    {
      title: '📄 总结文档',
      question: '请总结这个文档的主要内容',
    },
    {
      title: '🔍 查找信息',
      question: '这个文档中关于XXX的内容是什么？',
    },
    {
      title: '💡 深度分析',
      question: '文档中提到的主要观点有哪些？',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="max-w-3xl w-full space-y-8">
        {/* 欢迎信息 */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">向文档提问</h2>
          <p className="text-muted-foreground">
            已选择: <span className="font-medium text-foreground">{selectedDocument.name}</span>
          </p>
        </div>

        {/* 示例问题卡片 */}
        <div className="grid gap-4 sm:grid-cols-3">
          {exampleQuestions.map((example, index) => (
            <Card
              key={index}
              className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50 group"
              onClick={() => onExampleClick?.(example.question)}
            >
              <CardContent className="pt-6 pb-6">
                <div className="space-y-2">
                  <div className="text-lg font-medium group-hover:text-primary transition-colors">
                    {example.title}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {example.question}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 提示信息 */}
        <div className="text-center text-sm text-muted-foreground">
          <p>提示: 您可以直接在下方输入框中输入问题</p>
      </div>
      </div>
    </div>
  );
}
