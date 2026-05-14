import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getUserId } from '../lib/auth-store';
import type { HumanStateLog } from '../lib/api';

export function useHumanState() {
  const [todayState, setTodayState] = useState<HumanStateLog | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTodayState = useCallback(async () => {
    const userId = getUserId();
    if (!userId) { setLoading(false); return; }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('human_state_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setTodayState((data ?? null) as HumanStateLog | null);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchTodayState(); }, [fetchTodayState]);

  return { todayState, loading, refresh: fetchTodayState };
}
