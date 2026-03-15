'use client';

import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  color: 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'violet' | 'emerald';
  label: string;
  className?: string;
}

const colorMap: Record<StatusBadgeProps['color'], string> = {
  green: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  gray: 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-400',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
};

export function StatusBadge({ color, label, className }: StatusBadgeProps) {
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', colorMap[color], className)}>
      {label}
    </span>
  );
}
