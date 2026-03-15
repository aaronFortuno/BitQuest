import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeedback } from './use-feedback';

describe('useFeedback', () => {
  it('starts with null feedback', () => {
    const { result } = renderHook(() => useFeedback());
    expect(result.current.feedback).toBeNull();
  });

  it('showSuccess sets feedback with success type', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => result.current.showSuccess('Done!'));
    expect(result.current.feedback).toEqual({ type: 'success', message: 'Done!' });
  });

  it('showError sets feedback with error type', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => result.current.showError('Failed'));
    expect(result.current.feedback).toEqual({ type: 'error', message: 'Failed' });
  });

  it('clearFeedback resets to null', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => result.current.showWarning('Warning'));
    act(() => result.current.clearFeedback());
    expect(result.current.feedback).toBeNull();
  });

  it('auto-clears after duration', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useFeedback(3000));
    act(() => result.current.showInfo('Info'));
    expect(result.current.feedback).not.toBeNull();
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.feedback).toBeNull();
    vi.useRealTimers();
  });
});
