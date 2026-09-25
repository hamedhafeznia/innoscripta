import { useEffect, useState } from 'react';

/**
 * Typing must not fan out a request per keystroke: at three sources a keystroke costs
 * three requests, and NewsAPI's free plan allows 100 a day in total.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
