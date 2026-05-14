import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getUserId } from '../lib/auth-store';
import type { DbPersonMobile } from '../lib/api';

export function usePeople() {
  const [allPeople, setAllPeople] = useState<DbPersonMobile[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const userId = getUserId();
    if (!userId) { setLoading(false); return; }

    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from('people')
      .select('*')
      .eq('user_id', userId)
      .order('name')
      .limit(200);

    if (err) setError(err.message);
    else setAllPeople((data ?? []) as DbPersonMobile[]);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  return { allPeople, loading, error, refresh: fetchAll };
}
