import { useState, useEffect, useCallback } from 'react';
import { getAdvisor, type AdvisorResponse } from '../lib/api';

export function useAdvisor() {
  const [data,    setData]    = useState<AdvisorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdvisor();
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetch(); }, [fetch]);

  return { data, loading, error, refresh: fetch };
}
