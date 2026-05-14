import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cliente con service role — bypass RLS para operaciones server-side
let _serviceClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient;

  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  _serviceClient = createClient(url, key, {
    auth: { persistSession: false },
  });

  return _serviceClient;
}
