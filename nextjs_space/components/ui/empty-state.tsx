'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  message: string;
  icon?: LucideIcon;
  iconColor?: string;
  className?: string;
}

export function EmptyState({ message, icon: Icon, iconColor = 'text-gray-400', className }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-4', className)}>
      {Icon && <Icon className={cn('w-10 h-10 mx-auto mb-2', iconColor)} />}
      <p className="text-muted text-sm">{message}</p>
    </div>
  );
}
