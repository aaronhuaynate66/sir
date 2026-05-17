import { createServerSupabase, getServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ParsedMessage {
  ts:     Date;
  sender: string;
  text:   string;
}

interface ConversationStats {
  personId:      string;
  personName:    string;
  contactName:   string;
  totalMessages: number;
  userMessages:  number;
  contactMessages: number;
  firstDate:     Date;
  lastDate:      Date;
  subjects:      string[];
  silencePeriods: number; // days without messages
}

// Strip accents + emoji for fuzzy name matching
function normalizeContactName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Returns true if senderNorm looks like any of the user name variants.
// Uses word-overlap: requires >=2 words in common (length >2) to avoid false positives.
function isUserSender(senderNorm: string, userNorms: string[]): boolean {
  if (senderNorm === 'you') return true;
  const sWords = new Set(senderNorm.split(' ').filter(w => w.length > 2));
  for (const u of userNorms) {
    if (!u) continue;
    // Exact match
    if (senderNorm === u) return true;
    // Word overlap: >=2 words in common → same person
    const uWords = u.split(' ').filter(w => w.length > 2);
    const overlap = uWords.filter(w => sWords.has(w));
    if (overlap.length >= 2) return true;
    // One side fully contained in the other (handles nicknames)
    if (u.length >= 4 && (senderNorm.startsWith(u) || u.startsWith(senderNorm))) return true;
  }
  return false;
}

function parseWhatsAppExport(content: string, userNorms: string[]): Map<string, ParsedMessage[]> {
  // Strip BOM and normalize line endings
  const text = content
    .replace(/^﻿/, '')   // UTF-8 BOM
    .replace(/^￾/, '')   // UTF-16 LE BOM (if survived decoding)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Format A: [DD/MM/YY, HH:MM:SS] Name: message  (bracket, iOS + new Android)
  const reBracket = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s+(.+?):\s(.*)$/i;
  // Format B: DD/MM/YY, HH:MM - Name: message     (dash, old Android)
  const reDash    = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s+[-–]\s+(.+?):\s(.*)$/i;

  const msgsByContact = new Map<string, ParsedMessage[]>();

  let pendingSender = '';
  let pendingTs: Date | null = null;
  let pendingText  = '';

  function flush() {
    if (!pendingSender || !pendingTs) return;
    const msgs = msgsByContact.get(pendingSender) ?? [];
    msgs.push({ ts: pendingTs, sender: pendingSender, text: pendingText.slice(0, 200) });
    msgsByContact.set(pendingSender, msgs);
    pendingSender = ''; pendingTs = null; pendingText = '';
  }

  for (const line of text.split('\n')) {
    const m = reBracket.exec(line) ?? reDash.exec(line);
    if (!m) {
      // Continuation line — append to current message
      if (pendingSender && line.trim()) pendingText = (pendingText + ' ' + line.trim()).slice(0, 200);
      continue;
    }
    flush();

    const [, datePart, timePart, sender, msgText] = m;
    if (!datePart || !timePart || !sender || msgText === undefined) continue;

    const senderTrim = sender.trim();
    const senderNorm = normalizeContactName(senderTrim);
    if (isUserSender(senderNorm, userNorms)) continue;

    // Parse date DD/MM/YY[YY] — handle 2-digit years
    const parts = datePart.split('/');
    const d  = Number(parts[0]);
    const mo = Number(parts[1]);
    let   y  = Number(parts[2]);
    if (y < 100) y += 2000;

    // Normalize time: "8:50:12" → "08:50:12"
    const timeNorm = timePart.trim().replace(/^(\d):/, '0$1:').replace(/\s+/g, '');
    const ts = new Date(`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}T${timeNorm}`);
    if (isNaN(ts.getTime())) continue;

    pendingSender = senderTrim;
    pendingTs     = ts;
    pendingText   = msgText.trim();
  }
  flush();

  return msgsByContact;
}

function extractKeywords(texts: string[]): string[] {
  const stopWords = new Set(['que', 'de', 'el', 'la', 'los', 'las', 'en', 'un', 'una', 'y', 'a', 'es', 'por', 'con', 'me', 'te', 'se', 'no', 'sí', 'pero', 'si', 'lo', 'le', 'ya', 'ok', 'okay', 'jaja', 'jeje', 'the', 'and', 'for', 'are', 'you', 'this', 'that', 'with']);
  const freq = new Map<string, number>();
  for (const t of texts) {
    for (const word of t.toLowerCase().match(/\b[a-záéíóúüñ]{4,}\b/g) ?? []) {
      if (!stopWords.has(word)) freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}

export async function POST(req: Request): Promise<Response> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();

  let body: { content?: string; storage_path?: string; userDisplayName?: string };
  try {
    body = await req.json() as { content?: string; storage_path?: string; userDisplayName?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { content: rawContent, storage_path, userDisplayName = '' } = body;

  let content: string;

  if (storage_path) {
    // Download from Supabase Storage (service role bypasses RLS)
    const { data: blob, error: dlError } = await db.storage
      .from('whatsapp-exports')
      .download(storage_path);

    if (dlError || !blob) {
      return Response.json({ error: `Storage download failed: ${dlError?.message ?? 'unknown'}` }, { status: 500 });
    }

    content = await blob.text();

    // Clean up immediately after download
    await db.storage.from('whatsapp-exports').remove([storage_path]);

    console.log('[whatsapp-import] Downloaded from storage:', storage_path, content.length, 'chars');
  } else if (rawContent && typeof rawContent === 'string') {
    content = rawContent;
  } else {
    return Response.json({ error: 'storage_path or content required' }, { status: 400 });
  }

  console.log('[whatsapp-import] Processing:', content.length, 'chars');
  console.log('[whatsapp-import] First 150 chars:', JSON.stringify(content.substring(0, 150)));

  // Build user name variants for exclusion: form field + DB profile name
  const { data: userProfile } = await db
    .from('users')
    .select('name')
    .eq('id', user.id)
    .single();

  const userNorms = [
    normalizeContactName(userDisplayName),
    normalizeContactName(userProfile?.name ?? ''),
  ].filter(Boolean);

  console.log('[whatsapp-import] User name variants for exclusion:', userNorms);

  // Pre-load people
  const { data: people } = await db
    .from('people')
    .select('id, name')
    .eq('user_id', user.id);

  const nameToPersonId = new Map<string, { id: string; name: string }>();
  for (const p of (people ?? []) as Array<{ id: string; name: string }>) {
    nameToPersonId.set(normalizeContactName(p.name), { id: p.id, name: p.name });
  }

  // Parse WhatsApp export
  const msgsByContact = parseWhatsAppExport(content, userNorms);

  console.log('[whatsapp-import] Parsed contacts:', msgsByContact.size);
  console.log('[whatsapp-import] Contact names found:', Array.from(msgsByContact.keys()).slice(0, 5));
  console.log('[whatsapp-import] People in DB:', nameToPersonId.size);

  const results: Array<{ contact: string; person: string; messages: number }> = [];
  const statsList: ConversationStats[] = [];

  for (const [contactName, msgs] of msgsByContact.entries()) {
    // Match by normalized name (strips accents + emoji)
    let personEntry: { id: string; name: string } | undefined;
    const cNorm = normalizeContactName(contactName);
    for (const [key, val] of nameToPersonId.entries()) {
      if (key.includes(cNorm) || cNorm.includes(key)) { personEntry = val; break; }
    }
    if (!personEntry) continue;

    // Compute stats
    const sorted     = msgs.sort((a, b) => a.ts.getTime() - b.ts.getTime());
    const userMsgs   = sorted.filter(m => m.sender !== contactName);
    const contactMsgs = sorted.filter(m => m.sender === contactName);

    // Count silence periods (gaps > 3 days)
    let silencePeriods = 0;
    for (let i = 1; i < sorted.length; i++) {
      const gap = (sorted[i]!.ts.getTime() - sorted[i-1]!.ts.getTime()) / 86_400_000;
      if (gap > 3) silencePeriods++;
    }

    statsList.push({
      personId:        personEntry.id,
      personName:      personEntry.name,
      contactName,
      totalMessages:   msgs.length,
      userMessages:    userMsgs.length,
      contactMessages: contactMsgs.length,
      firstDate:       sorted[0]!.ts,
      lastDate:        sorted[sorted.length - 1]!.ts,
      subjects:        extractKeywords(msgs.map(m => m.text)),
      silencePeriods,
    });

    results.push({ contact: contactName, person: personEntry.name, messages: msgs.length });
  }

  if (statsList.length === 0) {
    const firstLines = content.split('\n').slice(0, 5).join('\n');
    return Response.json({
      processed: 0, matched: 0,
      message: 'No se encontraron coincidencias con personas en tu red',
      debug: {
        parsed_contacts: msgsByContact.size,
        people_in_db: nameToPersonId.size,
        first_lines: firstLines,
        contact_names_found: Array.from(msgsByContact.keys()).slice(0, 10),
      },
    });
  }

  // Claude Haiku analysis
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  let analysisMap = new Map<string, { tone: string; insights: string[]; signals: string[] }>();

  if (apiKey) {
    const block = statsList.map(s => {
      const initiates = s.userMessages > s.contactMessages ? 'usuario inicia más' : s.contactMessages > s.userMessages ? 'contacto inicia más' : 'equilibrado';
      const daySpan = Math.ceil((s.lastDate.getTime() - s.firstDate.getTime()) / 86_400_000) || 1;
      const weeklyRate = ((s.totalMessages / daySpan) * 7).toFixed(1);
      return `CONTACTO: ${s.contactName}\n- ${s.totalMessages} mensajes en ${daySpan} días (~${weeklyRate}/semana)\n- Inicia: ${initiates}\n- Silencias: ${s.silencePeriods} períodos >3 días\n- Palabras clave: ${s.subjects.join(', ')}`;
    }).join('\n\n');

    const prompt = `Analiza estas conversaciones de WhatsApp. Responde SOLO con JSON válido: array de objetos con: contacto (nombre), tone ("cálido"|"neutral"|"formal"|"tenso"), insights (array de 2 strings con observaciones relacionales en español), signals (array de 0-2 strings con señales accionables importantes como cambios de trabajo, viajes, eventos).\n\n${block}`;

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
        contacto: string; tone: string; insights: string[]; signals: string[];
      }>;
      for (const item of parsed) {
        analysisMap.set(item.contacto, {
          tone:     item.tone ?? 'neutral',
          insights: item.insights ?? [],
          signals:  item.signals ?? [],
        });
      }
    } catch {
      // Continue without analysis
    }
  }

  // Store memories, signals, and update relationships
  for (const stats of statsList) {
    const analysis = analysisMap.get(stats.contactName);
    const daySpan = Math.ceil((stats.lastDate.getTime() - stats.firstDate.getTime()) / 86_400_000) || 1;
    const weeklyRate = ((stats.totalMessages / daySpan) * 7).toFixed(1);
    const initiates = stats.userMessages > stats.contactMessages ? 'el usuario inicia más' : stats.contactMessages > stats.userMessages ? `${stats.contactName} inicia más` : 'equilibrado';

    const memContent = [
      `Análisis WhatsApp con ${stats.personName}: ${stats.totalMessages} mensajes en ${daySpan} días (~${weeklyRate}/semana).`,
      `Dinámica: ${initiates}.`,
      stats.silencePeriods > 0 ? `${stats.silencePeriods} períodos de silencio de más de 3 días.` : '',
      analysis?.insights?.join(' ') ?? '',
      analysis?.tone ? `Tono: ${analysis.tone}.` : '',
    ].filter(Boolean).join(' ');

    await db.from('memories').insert({
      user_id:    user.id,
      person_id:  stats.personId,
      layer:      'semantic',
      content:    memContent,
      importance: Math.min(10, Math.ceil(stats.totalMessages / 10)),
      metadata:   {
        source:         'whatsapp_import',
        total_messages: stats.totalMessages,
        tone:           analysis?.tone ?? null,
        weekly_rate:    weeklyRate,
      },
    });

    // Create signals for detected important events
    for (const signal of (analysis?.signals ?? [])) {
      await db.from('signals').insert({
        user_id:    user.id,
        person_id:  stats.personId,
        type:       'insight',
        payload:    { source: 'whatsapp_import', summary: signal },
        created_at: new Date().toISOString(),
      });
    }

    // Update relationship strength
    const bonus = Math.min(15, Math.floor(stats.totalMessages / 20));
    const { data: rel } = await db
      .from('relationships')
      .select('id, strength, contact_frequency_days')
      .eq('user_id', user.id)
      .eq('person_id', stats.personId)
      .single();

    if (rel) {
      const r = rel as { id: string; strength: number; contact_frequency_days: number | null };
      const avgDaysBetweenMsgs = daySpan / Math.max(1, stats.totalMessages);
      await db.from('relationships').update({
        strength:               Math.min(100, (r.strength ?? 0) + bonus),
        last_contact_at:        stats.lastDate.toISOString(),
        contact_frequency_days: r.contact_frequency_days ?? Math.ceil(avgDaysBetweenMsgs),
      }).eq('id', r.id);
    }
  }

  return Response.json({
    processed: Array.from(msgsByContact.values()).reduce((s, m) => s + m.length, 0),
    matched:   statsList.length,
    contacts:  results,
  });
}
