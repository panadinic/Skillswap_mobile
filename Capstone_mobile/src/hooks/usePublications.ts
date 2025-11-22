import { useCallback, useEffect, useRef, useState } from 'react';
import { publicationsApi, Publication } from '../services/api';

export function usePublications() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (silent = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      silent ? setRefreshing(true) : setLoading(true);
      try {
        const data = await publicationsApi.list(controller.signal);
        setPublications(data);
        setError(null);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setError(err?.message || 'No se pudo cargar el feed.');
      } finally {
        silent ? setRefreshing(false) : setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(false);
    return () => abortRef.current?.abort();
  }, [load]);

  return {
    publications,
    loading,
    refreshing,
    error,
    reload: () => load(true),
    retry: () => load(false),
  };
}
