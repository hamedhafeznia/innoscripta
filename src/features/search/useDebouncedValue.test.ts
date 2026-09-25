import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('holds the new value back until the delay has passed', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 350), {
      initialProps: { value: 'c' },
    });

    rerender({ value: 'cl' });
    act(() => void vi.advanceTimersByTime(300));
    expect(result.current).toBe('c');

    act(() => void vi.advanceTimersByTime(50));
    expect(result.current).toBe('cl');
  });

  it('emits once for a burst of keystrokes, not once per keystroke', () => {
    // At three sources a keystroke costs three requests, against a 100/day budget.
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 350), {
      initialProps: { value: '' },
    });

    for (const value of ['c', 'cl', 'cli', 'clim', 'clima', 'climate']) {
      rerender({ value });
      act(() => void vi.advanceTimersByTime(50));
    }

    expect(result.current).toBe('');

    act(() => void vi.advanceTimersByTime(350));
    expect(result.current).toBe('climate');
  });
});
