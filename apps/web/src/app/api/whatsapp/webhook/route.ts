import { type NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase-server';
import { markRead, type WAWebhookPayload } from '../_lib';
import {
  cmdWelcome, cmdHelp, cmdBriefing, cmdSignal,
  cmdEstado, cmdRed, cmdAI,
} from '../_commands';

export const dynamic = 'force-dynamic';

// ─── GET — Meta webhook verification ────────────────────────────────────────

export async function GET(req: NextRequest): Promise<Response> {
  const p = req.nextUrl.searchParams;
  const mode      = p.get('hub.mode');
  const token     = p.get('hub.verify_token');
  const challenge = p.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env['WHATSAPP_VERIFY_TOKEN']) {
    return new Response(challenge ?? '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// ─── POST — Receive messages ─────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  let body: WAWebhookPayload;
  try {
    body = await req.json() as WAWebhookPayload;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // Acknowledge immediately — Meta expects 200 within 5 s
  // We process synchronously (fast commands) or send "working…" first (AI)
  if (body.object !== 'whatsapp_business_account') {
    return new Response('OK', { status: 200 });
  }

  for (const entry of (body.entry ?? [])) {
    for (const change of (entry.changes ?? [])) {
      for (const msg of (change.value?.messages ?? [])) {
        if (msg.type !== 'text') continue;
        const text = msg.text?.body?.trim() ?? '';
        if (!text) continue;

        // Fire and forget — don't await here to ensure 200 is returned fast
        void processMessage(msg.from, msg.id, text);
      }
    }
  }

  return new Response('OK', { status: 200 });
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

async function processMessage(from: string, messageId: string, text: string): Promise<void> {
  const db = getServiceClient();

  // Mark message as read
  markRead(messageId).catch(() => undefined);

  // Check if this phone is linked to a user
  const { data: link } = await db
    .from('whatsapp_links')
    .select('user_id, verified')
    .eq('phone_number', from)
    .maybeSingle();

  type LinkRow = { user_id: string; verified: boolean };
  const linkRow = link as LinkRow | null;

  // ── Handle verification code (6 digits) ──────────────────────────────────
  if (/^\d{6}$/.test(text)) {
    const { data: pending } = await db
      .from('whatsapp_links')
      .select('id, user_id')
      .eq('verification_code', text)
      .eq('verified', false)
      .maybeSingle();

    type PendingRow = { id: string; user_id: string };
    if (pending) {
      const p = pending as PendingRow;
      // Link this phone to the user
      await db
        .from('whatsapp_links')
        .update({ phone_number: from, verified: true, verification_code: null })
        .eq('id', p.id);

      const { data: userData } = await db
        .from('users')
        .select('full_name, email')
        .eq('id', p.user_id)
        .maybeSingle();
      const name = (userData as { full_name?: string } | null)?.full_name ?? 'usuario';

      const { sendText } = await import('../_lib');
      await sendText(from,
        `✅ ¡Vinculado correctamente!\n\n` +
        `Hola *${name}*, tu WhatsApp ya está conectado con SIR.\n\n` +
        `Escribe *ayuda* para ver todos los comandos disponibles.`
      );
      return;
    }

    // Code not found → treat as unknown message
    const { sendText } = await import('../_lib');
    await sendText(from, '❌ Código inválido o expirado. Ve a *sir.marlabinc.com/vincular-whatsapp* para obtener uno nuevo.');
    return;
  }

  // ── Not linked yet ────────────────────────────────────────────────────────
  if (!linkRow?.verified) {
    if (/^hola/i.test(text) || /^hi\b/i.test(text)) {
      await cmdWelcome(from);
    } else {
      const { sendText } = await import('../_lib');
      await sendText(from,
        '🔗 Tu número aún no está vinculado a SIR.\n\n' +
        'Visita *sir.marlabinc.com/vincular-whatsapp* y sigue las instrucciones.'
      );
    }
    return;
  }

  const userId = linkRow.user_id;
  const lower  = text.toLowerCase();

  // ── Route commands ────────────────────────────────────────────────────────
  if (/^hola\b/i.test(lower)) {
    const { sendText } = await import('../_lib');
    await sendText(from, `👋 ¡Hola! Estoy aquí. Escribe *ayuda* para ver los comandos disponibles.`);
  } else if (lower === 'ayuda' || lower === 'help') {
    await cmdHelp(from);
  } else if (lower === 'estado') {
    await cmdEstado(userId, from);
  } else if (lower === 'red') {
    await cmdRed(userId, from);
  } else if (/^briefing\s+(.+)/i.test(lower)) {
    const match = lower.match(/^briefing\s+(.+)/i);
    await cmdBriefing(userId, from, match?.[1]?.trim() ?? '');
  } else if (/^se[ñn]al\s+(.*)/i.test(text)) {
    const match = text.match(/^se[ñn]al\s+(.*)/i);
    await cmdSignal(userId, from, match?.[1]?.trim() ?? '');
  } else {
    // Free-form message → AI response
    await cmdAI(userId, from, text);
  }
}
