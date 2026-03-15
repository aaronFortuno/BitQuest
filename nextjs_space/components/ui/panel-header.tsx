'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PanelHeaderProps {
  icon: LucideIcon;
  title: string;
  iconColor?: string;
  count?: number;
  action?: React.ReactNode;
  className?: string;
}

export function PanelHeader({ icon: Icon, title, iconColor = 'text-violet-500', count, action, className }: PanelHeaderProps) {
  return (
    <div className={cn('flex items-center gap-2 mb-4', className)}>
      <Icon className={cn('w-5 h-5', iconColor)} />
      <h2 className="font-semibold text-heading">{title}</h2>
      {count !== undefined && count > 0 && (
        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:text-amber-400 rounded-full text-xs">
          {count}
        </span>
      )}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}
