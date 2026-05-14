import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseConfig } from './types';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(config?: SupabaseConfig): SupabaseClient {
  if (_client) return _client;

  const url = config?.url ?? process.env['SUPABASE_URL'];
  const key = config?.anonKey ?? process.env['SUPABASE_ANON_KEY'];

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  _client = createClient(url, key);
  return _client;
}
