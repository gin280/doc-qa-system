import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Clock, FileSearch, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

type Status = 'PENDING' | 'PARSING' | 'EMBEDDING' | 'READY' | 'FAILED'

interface Props {
  status: Status
}

const STATUS_CONFIG = {
  PENDING: {
    label: '待处理',
    icon: <Clock className="h-3.5 w-3.5" />,
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
  },
  PARSING: {
    label: '解析中',
    icon: <FileSearch className="h-3.5 w-3.5 animate-pulse" />,
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
  },
  EMBEDDING: {
    label: '向量化中',
    icon: <Sparkles className="h-3.5 w-3.5 animate-pulse" />,
    className: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20 hover:bg-purple-500/20'
  },
  READY: {
    label: '已就绪',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20'
  },
  FAILED: {
    label: '失败',
    icon: <XCircle className="h-3.5 w-3.5" />,
    className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 hover:bg-red-500/20'
  }
}

export function DocumentStatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status]
  
  return (
    <Badge 
      variant="outline"
      className={cn(
        'flex items-center gap-1.5 font-medium px-2.5 py-1 transition-all',
        config.className
      )}
    >
      {config.icon}
      {config.label}
    </Badge>
  )
}