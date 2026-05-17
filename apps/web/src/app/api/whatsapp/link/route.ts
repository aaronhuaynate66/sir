import { type NextRequest } from 'next/server';
import { createServerSupabase, getServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// GET — Return current verification code (or create new one)
export async function GET(): Promise<Response> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();

  // Check if already verified
  const { data: existing } = await db
    .from('whatsapp_links')
    .select('id, phone_number, verified, verification_code')
    .eq('user_id', user.id)
    .maybeSingle();

  type LinkRow = { id: string; phone_number: string; verified: boolean; verification_code: string | null };
  const row = existing as LinkRow | null;

  if (row?.verified) {
    return Response.json({ verified: true, phone_number: row.phone_number });
  }

  // Return existing pending code or create a new one
  if (row?.verification_code) {
    return Response.json({ code: row.verification_code, verified: false });
  }

  const code = generateCode();
  if (row) {
    await db.from('whatsapp_links').update({ verification_code: code }).eq('id', row.id);
  } else {
    await db.from('whatsapp_links').insert({
      user_id:           user.id,
      phone_number:      'pending',
      verification_code: code,
      verified:          false,
    });
  }

  return Response.json({ code, verified: false });
}

// DELETE — Disconnect WhatsApp
export async function DELETE(): Promise<Response> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  await getServiceClient()
    .from('whatsapp_links')
    .delete()
    .eq('user_id', user.id);

  return Response.json({ ok: true });
}

// POST — Refresh code
export async function POST(_req: NextRequest): Promise<Response> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db   = getServiceClient();
  const code = generateCode();

  const { data: existing } = await db
    .from('whatsapp_links')
    .select('id, verified')
    .eq('user_id', user.id)
    .maybeSingle();

  type RowMin = { id: string; verified: boolean };
  const row = existing as RowMin | null;

  if (row?.verified) {
    return Response.json({ error: 'Already verified' }, { status: 400 });
  }

  if (row) {
    await db.from('whatsapp_links').update({ verification_code: code }).eq('id', row.id);
  } else {
    await db.from('whatsapp_links').insert({
      user_id:           user.id,
      phone_number:      'pending',
      verification_code: code,
      verified:          false,
    });
  }

  return Response.json({ code });
}
