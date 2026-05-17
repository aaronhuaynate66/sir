// WhatsApp Cloud API helpers (Meta Graph API v19)

const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

function phoneId(): string {
  return process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? '';
}

function token(): string {
  return process.env['WHATSAPP_TOKEN'] ?? '';
}

export async function sendText(to: string, body: string): Promise<void> {
  const id = phoneId();
  const tk = token();
  if (!id || !tk) {
    console.warn('[whatsapp] WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_TOKEN not set');
    return;
  }

  const res = await fetch(`${GRAPH_BASE}/${id}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tk}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: body.slice(0, 4096) }, // WhatsApp text limit
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.error('[whatsapp] send failed:', res.status, err);
  }
}

// Mark incoming message as read
export async function markRead(messageId: string): Promise<void> {
  const id = phoneId();
  const tk = token();
  if (!id || !tk) return;

  await fetch(`${GRAPH_BASE}/${id}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tk}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  }).catch(() => undefined);
}

// ─── Webhook payload types ─────────────────────────────────────────────────

export interface WAMessage {
  id: string;
  from: string;  // phone number (E.164 without +)
  type: string;
  text?: { body: string };
  timestamp: string;
}

export interface WAWebhookPayload {
  object: string;
  entry: Array<{
    changes: Array<{
      value: {
        messages?: WAMessage[];
        statuses?: unknown[];
        metadata?: { phone_number_id: string };
      };
    }>;
  }>;
}
