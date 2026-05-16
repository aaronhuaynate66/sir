import { createServerSupabase, getServiceClient } from '@/lib/supabase-server';
import { getValidToken, type GoogleIntegration } from '../../google/_lib';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface GmailMessage {
  id: string;
  threadId: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
}

interface ContactStats {
  email:     string;
  name:      string;
  personId:  string;
  sent:      number;
  received:  number;
  subjects:  string[];
  timestamps: number[];
  userResponseTimes: number[];
}

function parseHeader(msg: GmailMessage, name: string): string {
  return msg.payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function parseEmail(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] ?? raw : raw).toLowerCase().trim();
}

function parseName(raw: string): string {
  const m = raw.match(/^([^<]+)</);
  return m ? (m[1] ?? raw).trim().replace(/^"|"$/g, '') : raw;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(): Promise<Response> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();
  const { data: intRow } = await db
    .from('google_integrations')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!intRow) return Response.json({ error: 'Not connected to Google' }, { status: 400 });
  const integration = intRow as GoogleIntegration;

  if (!integration.scopes.includes('gmail.readonly')) {
    return Response.json({ error: 'Gmail not authorized — connect Gmail first' }, { status: 403 });
  }

  let token: string;
  try {
    token = await getValidToken(integration, user.id);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 401 });
  }

  // Get user's own Gmail address
  const profileRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const profile = await profileRes.json() as { emailAddress?: string };
  const userEmail = profile.emailAddress?.toLowerCase() ?? '';

  // Pre-load people for matching — email-exact first, name fallback second
  const { data: people } = await db
    .from('people')
    .select('id, name, email')
    .eq('user_id', user.id);

  type PersonEntry = { id: string; name: string; hasEmail: boolean };
  const emailToPersonId = new Map<string, PersonEntry>();
  const nameToPersonId  = new Map<string, PersonEntry>();

  for (const p of (people ?? []) as Array<{ id: string; name: string; email: string | null }>) {
    const entry: PersonEntry = { id: p.id, name: p.name, hasEmail: !!p.email };
    if (p.email) emailToPersonId.set(p.email.toLowerCase(), entry);
    nameToPersonId.set(p.name.toLowerCase().trim(), entry);
  }

  console.log('[gmail-sync] Total people loaded:', (people ?? []).length);
  console.log('[gmail-sync] People with email:', emailToPersonId.size);
  console.log('[gmail-sync] People with name:', nameToPersonId.size);
  console.log('[gmail-sync] Sample people emails:', Array.from(emailToPersonId.keys()).slice(0, 5));

  // Track email updates needed for name-matched people without email in DB
  const emailUpdates = new Map<string, string>(); // personId → email
  const senderEmails = new Set<string>(); // collected for debug

  // List messages from last 6 months (max 200)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const afterDate = Math.floor(sixMonthsAgo.getTime() / 1000);

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=200&q=after:${afterDate}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!listRes.ok) return Response.json({ error: 'Failed to list Gmail messages' }, { status: 502 });

  const listData = await listRes.json() as { messages?: Array<{ id: string }> };
  const msgIds = (listData.messages ?? []).map(m => m.id);

  if (msgIds.length === 0) {
    return Response.json({ emails_processed: 0, contacts_analyzed: 0 });
  }

  // Batch-fetch message metadata (20 at a time)
  const contactMap = new Map<string, ContactStats>();
  const batches = chunk(msgIds, 20);

  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map(id =>
        fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From,To,Date,Subject`,
          { headers: { Authorization: `Bearer ${token}` } }
        ).then(r => r.json() as Promise<GmailMessage>)
      )
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const msg = result.value;

      const from    = parseHeader(msg, 'From');
      const to      = parseHeader(msg, 'To');
      const subject = parseHeader(msg, 'Subject');
      const date    = parseHeader(msg, 'Date');
      const ts      = date ? new Date(date).getTime() : 0;

      const fromEmail = parseEmail(from);
      const toEmail   = parseEmail(to);

      const isSent     = fromEmail === userEmail;
      const contactRaw = isSent ? to   : from;
      const cEmail     = isSent ? toEmail : fromEmail;
      const cName      = parseName(contactRaw);

      if (!cEmail || cEmail === userEmail) continue;
      senderEmails.add(cEmail);

      // Match by email first, then fall back to name
      const personEntry = emailToPersonId.get(cEmail)
        ?? nameToPersonId.get(cName.toLowerCase().trim());
      if (!personEntry) continue;

      // If matched by name and person has no email yet, queue an update
      if (!personEntry.hasEmail && !emailUpdates.has(personEntry.id)) {
        emailUpdates.set(personEntry.id, cEmail);
        // Also register in email map so subsequent messages hit this person too
        emailToPersonId.set(cEmail, { ...personEntry, hasEmail: true });
      }

      if (!contactMap.has(cEmail)) {
        contactMap.set(cEmail, {
          email:     cEmail,
          name:      personEntry.name,
          personId:  personEntry.id,
          sent:      0,
          received:  0,
          subjects:  [],
          timestamps: [],
          userResponseTimes: [],
        });
      }

      const stats = contactMap.get(cEmail)!;
      if (isSent) { stats.sent++; } else { stats.received++; }
      if (subject && !stats.subjects.includes(subject)) stats.subjects.push(subject);
      if (ts) stats.timestamps.push(ts);
      void cName; // name already resolved from DB
    }
  }

  console.log('[gmail-sync] Unique sender emails in messages:', senderEmails.size);
  console.log('[gmail-sync] Sample sender emails:', Array.from(senderEmails).slice(0, 5));
  console.log('[gmail-sync] Matched contacts:', contactMap.size);

  // Backfill emails for name-matched people that had no email in DB
  if (emailUpdates.size > 0) {
    await Promise.allSettled(
      Array.from(emailUpdates.entries()).map(([personId, email]) =>
        db.from('people').update({ email }).eq('id', personId).eq('user_id', user.id)
      )
    );
  }

  if (contactMap.size === 0) {
    return Response.json({ emails_processed: msgIds.length, contacts_analyzed: 0, email_backfills: emailUpdates.size });
  }

  // Claude Haiku analysis for all matched contacts in one call
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  let analysisMap: Map<string, { topics: string[]; tone: string; insight: string }> = new Map();

  if (apiKey) {
    const contactsBlock = Array.from(contactMap.values())
      .map(s => {
        const total = s.sent + s.received;
        const topSubjects = s.subjects.slice(0, 8).join(', ');
        const initiates = s.sent > s.received ? 'usuario inicia más' : s.received > s.sent ? 'contacto inicia más' : 'equilibrado';
        return `CONTACTO: ${s.email}\n- Emails: ${total} total (${s.sent} enviados, ${s.received} recibidos)\n- Inicia: ${initiates}\n- Asuntos: ${topSubjects || '(sin asuntos)'}`;
      })
      .join('\n\n');

    const prompt = `Analiza los patrones de email de estos contactos y responde SOLO con JSON válido. Array de objetos con: email, topics (array de 2-3 strings con temas clave), tone ("cálido"|"neutral"|"formal"|"tenso"), insight (1 frase concisa en español sobre la dinámica de comunicación).\n\n${contactsBlock}`;

    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const claude = new Anthropic({ apiKey });
      const resp = await claude.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages:   [{ role: 'user', content: prompt }],
      });
      const raw = resp.content[0]?.type === 'text' ? resp.content[0].text.trim() : '[]';
      const parsed = JSON.parse(raw.replace(/^```json\s*/,'').replace(/\s*```$/,'')) as Array<{
        email: string; topics: string[]; tone: string; insight: string;
      }>;
      for (const item of parsed) {
        analysisMap.set(item.email, { topics: item.topics ?? [], tone: item.tone ?? 'neutral', insight: item.insight ?? '' });
      }
    } catch {
      // Continue without analysis if Claude fails
    }
  }

  // Store memories and update relationship strength
  let contactsAnalyzed = 0;
  for (const stats of contactMap.values()) {
    const analysis = analysisMap.get(stats.email);
    const total    = stats.sent + stats.received;

    const memoryContent = [
      `Análisis de email con ${stats.name}: ${total} emails en 6 meses (${stats.sent} enviados, ${stats.received} recibidos).`,
      stats.sent > stats.received
        ? `El usuario inicia la comunicación con más frecuencia.`
        : stats.received > stats.sent
          ? `${stats.name} inicia la comunicación con más frecuencia.`
          : `La comunicación es equilibrada.`,
      analysis?.topics?.length
        ? `Temas recurrentes: ${analysis.topics.join(', ')}.`
        : '',
      analysis?.tone ? `Tono general: ${analysis.tone}.` : '',
      analysis?.insight ? analysis.insight : '',
    ].filter(Boolean).join(' ');

    await db.from('memories').insert({
      user_id:    user.id,
      person_id:  stats.personId,
      layer:      'semantic',
      content:    memoryContent,
      importance: Math.min(10, Math.ceil(total / 5)),
      metadata:   {
        source: 'gmail_sync',
        sent:       stats.sent,
        received:   stats.received,
        tone:       analysis?.tone ?? null,
        topics:     analysis?.topics ?? [],
      },
    });

    // Update relationship strength based on email frequency
    const strengthBonus = Math.min(20, Math.floor(total / 3));
    const { data: rel } = await db
      .from('relationships')
      .select('id, strength')
      .eq('user_id', user.id)
      .eq('person_id', stats.personId)
      .single();

    if (rel) {
      const r = rel as { id: string; strength: number };
      await db.from('relationships').update({
        strength: Math.min(100, (r.strength ?? 0) + strengthBonus),
      }).eq('id', r.id);
    }

    contactsAnalyzed++;
  }

  await db.from('google_integrations').update({
    emails_synced:       msgIds.length,
    gmail_last_sync_at:  new Date().toISOString(),
  }).eq('user_id', user.id);

  return Response.json({ emails_processed: msgIds.length, contacts_analyzed: contactsAnalyzed, email_backfills: emailUpdates.size });
}
