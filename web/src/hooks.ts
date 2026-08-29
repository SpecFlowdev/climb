import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);

  const reload = useCallback(() => {
    if (!path) return;
    const current = ++version.current;
    setLoading(true);
    api
      .get<T>(path)
      .then((result) => {
        if (current === version.current) {
          setData(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (current === version.current) setError(err.message);
      })
      .finally(() => {
        if (current === version.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(reload, [reload, ...deps]);

  return { data, loading, error, reload, setData };
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage can be unavailable, the app still works */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
