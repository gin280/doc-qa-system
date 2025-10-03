import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  href?: string;
}

const sizeMap = {
  sm: {
    icon: 'h-6 w-6',
    text: 'text-lg',
  },
  md: {
    icon: 'h-8 w-8',
    text: 'text-2xl',
  },
  lg: {
    icon: 'h-12 w-12',
    text: 'text-4xl',
  },
};

export function Logo({ 
  className, 
  size = 'md', 
  showText = true,
  href = '/'
}: LogoProps) {
  const logoContent = (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Logo图标 - 使用primary色 */}
      <div className="relative">
        <FileQuestion 
          className={cn(
            sizeMap[size].icon,
            'text-primary transition-transform duration-200 hover:scale-110'
          )} 
        />
      </div>
      
      {/* Logo文字 */}
      {showText && (
        <span className={cn(
          sizeMap[size].text,
          'font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent'
        )}>
          DocQA
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}

