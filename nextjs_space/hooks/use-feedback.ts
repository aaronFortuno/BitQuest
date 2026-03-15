import { useState, useEffect, useCallback } from 'react';

export interface FeedbackState {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export function useFeedback(duration = 5000) {
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), duration);
      return () => clearTimeout(timer);
    }
  }, [feedback, duration]);

  const showSuccess = useCallback((message: string) => setFeedback({ type: 'success', message }), []);
  const showError = useCallback((message: string) => setFeedback({ type: 'error', message }), []);
  const showWarning = useCallback((message: string) => setFeedback({ type: 'warning', message }), []);
  const showInfo = useCallback((message: string) => setFeedback({ type: 'info', message }), []);
  const clearFeedback = useCallback(() => setFeedback(null), []);

  return { feedback, showSuccess, showError, showWarning, showInfo, clearFeedback };
}
