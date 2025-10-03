import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card rounded-lg shadow p-6">
          {/* 顶部导航栏 Skeleton */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b">
            <div className="flex items-center gap-4">
              {/* 头像 Skeleton */}
              <Skeleton className="h-12 w-12 rounded-full" />
              
              {/* 用户信息 Skeleton */}
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            
            {/* 退出按钮 Skeleton */}
            <Skeleton className="h-10 w-24" />
          </div>

          {/* 主要内容区域 Skeleton */}
          <div className="space-y-4">
            <Skeleton className="h-5 w-96" />
            
            {/* 用户详细信息卡片 Skeleton */}
            <div className="mt-4 p-4 bg-primary/10 rounded-lg">
              <Skeleton className="h-4 w-20 mb-3" />
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-full max-w-xs" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

