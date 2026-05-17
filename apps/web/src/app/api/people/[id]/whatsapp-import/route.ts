import { createServerSupabase, getServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ParsedMessage {
  ts:     Date;
  sender: string;
  text:   string;
}

function normalizeContactName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAllMessages(content: string): ParsedMessage[] {
  const text = content
    .replace(/^﻿/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const reBracket = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s+(.+?):\s(.*)$/i;
  const reDash    = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s+[-–]\s+(.+?):\s(.*)$/i;

  const messages: ParsedMessage[] = [];
  let pendingSender = '';
  let pendingTs: Date | null = null;
  let pendingText  = '';

  function flush() {
    if (!pendingSender || !pendingTs) return;
    messages.push({ ts: pendingTs, sender: pendingSender, text: pendingText.slice(0, 200) });
    pendingSender = ''; pendingTs = null; pendingText = '';
  }

  for (const line of text.split('\n')) {
    const m = reBracket.exec(line) ?? reDash.exec(line);
    if (!m) {
      if (pendingSender && line.trim()) pendingText = (pendingText + ' ' + line.trim()).slice(0, 200);
      continue;
    }
    flush();

    const [, datePart, timePart, sender, msgText] = m;
    if (!datePart || !timePart || !sender || msgText === undefined) continue;

    const parts = datePart.split('/');
    const d  = Number(parts[0]);
    const mo = Number(parts[1]);
    let   y  = Number(parts[2]);
    if (y < 100) y += 2000;

    const timeNorm = timePart.trim().replace(/^(\d):/, '0$1:').replace(/\s+/g, '');
    const ts = new Date(`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}T${timeNorm}`);
    if (isNaN(ts.getTime())) continue;

    pendingSender = sender.trim();
    pendingTs     = ts;
    pendingText   = msgText.trim();
  }
  flush();

  return messages;
}

function extractKeywords(texts: string[]): string[] {
  const stopWords = new Set(['que', 'de', 'el', 'la', 'los', 'las', 'en', 'un', 'una', 'y', 'a', 'es', 'por', 'con', 'me', 'te', 'se', 'no', 'pero', 'si', 'lo', 'le', 'ya', 'ok', 'okay', 'jaja', 'jeje', 'the', 'and', 'for', 'are', 'you', 'this']);
  const freq = new Map<string, number>();
  for (const t of texts) {
    for (const word of t.toLowerCase().match(/\b[a-záéíóúüñ]{4,}\b/g) ?? []) {
      if (!stopWords.has(word)) freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServiceClient();
  const personId = params.id;

  // Verify person belongs to user
  const { data: person } = await db
    .from('people')
    .select('id, name')
    .eq('id', personId)
    .eq('user_id', user.id)
    .single();

  if (!person) return Response.json({ error: 'Person not found' }, { status: 404 });
  const personName = (person as { id: string; name: string }).name;

  let body: { storage_path?: string };
  try {
    body = await req.json() as { storage_path?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { storage_path } = body;
  if (!storage_path) return Response.json({ error: 'storage_path required' }, { status: 400 });

  // Download from Supabase Storage
  const { data: blob, error: dlError } = await db.storage
    .from('whatsapp-exports')
    .download(storage_path);

  if (dlError || !blob) {
    return Response.json({ error: `Storage download failed: ${dlError?.message ?? 'unknown'}` }, { status: 500 });
  }

  const content = await blob.text();
  await db.storage.from('whatsapp-exports').remove([storage_path]);

  console.log('[wa-person-import] person:', personName, '| chars:', content.length);

  // Parse all messages (no sender filtering — we know who the person is)
  const messages = parseAllMessages(content);

  if (messages.length === 0) {
    return Response.json({ error: 'No se pudieron leer mensajes del archivo. Verifica que sea un export de WhatsApp válido.' }, { status: 400 });
  }

  const sorted = messages.sort((a, b) => a.ts.getTime() - b.ts.getTime());
  const firstDate = sorted[0]!.ts;
  const lastDate  = sorted[sorted.length - 1]!.ts;
  const daySpan   = Math.ceil((lastDate.getTime() - firstDate.getTime()) / 86_400_000) || 1;
  const weeklyRate = ((messages.length / daySpan) * 7).toFixed(1);
  const keywords  = extractKeywords(messages.map(m => m.text));

  // Detect which sender is the contact (matches person name most closely)
  const senderCounts = new Map<string, number>();
  for (const msg of messages) {
    senderCounts.set(msg.sender, (senderCounts.get(msg.sender) ?? 0) + 1);
  }
  const personNorm = normalizeContactName(personName);
  let contactSender = '';
  let bestScore = 0;
  for (const [sender] of senderCounts) {
    const sNorm = normalizeContactName(sender);
    const sWords = new Set(sNorm.split(' ').filter(w => w.length > 2));
    const pWords = personNorm.split(' ').filter(w => w.length > 2);
    const overlap = pWords.filter(w => sWords.has(w)).length;
    if (overlap > bestScore) { bestScore = overlap; contactSender = sender; }
  }

  const contactMsgs = messages.filter(m => m.sender === contactSender).length;
  const userMsgs    = messages.length - contactMsgs;

  // Silence periods
  let silencePeriods = 0;
  for (let i = 1; i < sorted.length; i++) {
    if ((sorted[i]!.ts.getTime() - sorted[i-1]!.ts.getTime()) / 86_400_000 > 3) silencePeriods++;
  }

  console.log('[wa-person-import] total messages:', messages.length, '| contact sender:', contactSender, '| contact msgs:', contactMsgs);

  // Claude Haiku analysis
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  let analysis: { tone: string; insights: string[]; signals: string[] } = { tone: 'neutral', insights: [], signals: [] };

  if (apiKey) {
    const initiates = contactMsgs > userMsgs ? `${personName} inicia más` : userMsgs > contactMsgs ? 'usuario inicia más' : 'equilibrado';
    const prompt = `Analiza la conversación de WhatsApp con ${personName}: ${messages.length} mensajes en ${daySpan} días (~${weeklyRate}/semana). Inicia: ${initiates}. Silencias: ${silencePeriods} períodos >3 días. Palabras clave: ${keywords.join(', ')}.\n\nResponde SOLO con JSON: { "tone": "cálido"|"neutral"|"formal"|"tenso", "insights": [2 strings con observaciones relacionales en español], "signals": [0-2 strings con señales accionables importantes] }`;

    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const claude = new Anthropic({ apiKey });
      const resp = await claude.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });
      const raw = resp.content[0]?.type === 'text' ? resp.content[0].text.trim() : '{}';
      const parsed = JSON.parse(raw.replace(/^```json\s*/,'').replace(/\s*```$/,'')) as typeof analysis;
      analysis = {
        tone:     parsed.tone    ?? 'neutral',
        insights: parsed.insights ?? [],
        signals:  parsed.signals  ?? [],
      };
    } catch {
      // Continue without analysis
    }
  }

  // Save memory
  const initiatesText = contactMsgs > userMsgs ? `${personName} inicia más` : userMsgs > contactMsgs ? 'el usuario inicia más' : 'equilibrado';
  const memContent = [
    `Análisis WhatsApp con ${personName}: ${messages.length} mensajes en ${daySpan} días (~${weeklyRate}/semana).`,
    `Dinámica: ${initiatesText}.`,
    silencePeriods > 0 ? `${silencePeriods} períodos de silencio de más de 3 días.` : '',
    analysis.insights.join(' '),
    analysis.tone ? `Tono: ${analysis.tone}.` : '',
  ].filter(Boolean).join(' ');

  await db.from('memories').insert({
    user_id:    user.id,
    person_id:  personId,
    layer:      'semantic',
    content:    memContent,
    importance: Math.min(10, Math.ceil(messages.length / 10)),
    metadata:   {
      source:         'whatsapp_import',
      total_messages: messages.length,
      tone:           analysis.tone,
      weekly_rate:    weeklyRate,
    },
  });

  // Create signals for detected events
  let signalsCreated = 0;
  for (const signal of analysis.signals) {
    await db.from('signals').insert({
      user_id:    user.id,
      person_id:  personId,
      type:       'insight',
      payload:    { source: 'whatsapp_import', summary: signal },
      created_at: new Date().toISOString(),
    });
    signalsCreated++;
  }

  // Update relationship strength
  const bonus = Math.min(15, Math.floor(messages.length / 20));
  const { data: rel } = await db
    .from('relationships')
    .select('id, strength, contact_frequency_days')
    .eq('user_id', user.id)
    .eq('person_id', personId)
    .single();

  if (rel) {
    const r = rel as { id: string; strength: number; contact_frequency_days: number | null };
    const avgDays = daySpan / Math.max(1, messages.length);
    await db.from('relationships').update({
      strength:               Math.min(100, (r.strength ?? 0) + bonus),
      last_contact_at:        lastDate.toISOString(),
      contact_frequency_days: r.contact_frequency_days ?? Math.ceil(avgDays),
    }).eq('id', r.id);
  }

  return Response.json({
    messages_processed: messages.length,
    memories_created:   1,
    signals_created:    signalsCreated,
    tone:               analysis.tone,
    insights:           analysis.insights,
    day_span:           daySpan,
    weekly_rate:        weeklyRate,
  });
}
