'use client';

import type { FeedbackState } from '@/hooks/use-feedback';
import { cn } from '@/lib/utils';

const styles: Record<FeedbackState['type'], string> = {
  success: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  error: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400',
  warning: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
  info: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400',
};

interface FeedbackAlertProps {
  feedback: FeedbackState | null;
  className?: string;
}

export function FeedbackAlert({ feedback, className }: FeedbackAlertProps) {
  if (!feedback) return null;
  return (
    <div className={cn('p-3 rounded-lg text-sm', styles[feedback.type], className)}>
      {feedback.message}
    </div>
  );
}
