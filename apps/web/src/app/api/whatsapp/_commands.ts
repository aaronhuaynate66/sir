import { getServiceClient } from '@/lib/supabase-server';
import { sendText } from './_lib';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });

// ─── Helpers ────────────────────────────────────────────────────────────────

function days(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  return `hace ${d} días`;
}

async function aiText(system: string, user: string, maxTokens = 600): Promise<string> {
  try {
    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });
    return msg.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');
  } catch {
    return '';
  }
}

// ─── BIENVENIDA ──────────────────────────────────────────────────────────────

export async function cmdWelcome(to: string): Promise<void> {
  await sendText(to,
    '👋 Hola, soy *SIR* — tu asistente de inteligencia relacional.\n\n' +
    'Para vincular tu WhatsApp con tu cuenta, visita:\n' +
    '*sir.marlabinc.com/vincular-whatsapp*\n\n' +
    'Cuando tengas el código de 6 dígitos, envíamelo aquí.\n\n' +
    'Escribe *ayuda* para ver todos los comandos.'
  );
}

// ─── AYUDA ───────────────────────────────────────────────────────────────────

export async function cmdHelp(to: string): Promise<void> {
  await sendText(to,
    '*Comandos disponibles:*\n\n' +
    '• *briefing [nombre]* — Briefing ejecutivo de un contacto\n' +
    '• *señal [texto]* — Guardar una señal o nota\n' +
    '• *estado* — Tus 3 rituales sugeridos para hoy\n' +
    '• *red* — Tus top 5 contactos por fortaleza relacional\n' +
    '• *ayuda* — Esta lista de comandos\n\n' +
    '💡 También puedes escribir cualquier texto y te respondo con inteligencia relacional.'
  );
}

// ─── BRIEFING ────────────────────────────────────────────────────────────────

export async function cmdBriefing(userId: string, to: string, name: string): Promise<void> {
  if (!name.trim()) {
    await sendText(to, '¿De quién quieres el briefing? Ejemplo: *briefing Diana*');
    return;
  }

  await sendText(to, `⏳ Generando briefing de *${name}*...`);

  const db = getServiceClient();

  // Find person by name (case-insensitive, partial)
  const { data: people } = await db
    .from('people')
    .select('id, name, organization, role, email, notes, relationship_type, created_at')
    .eq('user_id', userId)
    .ilike('name', `%${name}%`)
    .limit(5);

  if (!people || (people as unknown[]).length === 0) {
    await sendText(to, `❌ No encontré a nadie llamado "${name}" en tu red.`);
    return;
  }

  type PersonRow = { id: string; name: string; organization: string | null; role: string | null; email: string | null; notes: string | null; relationship_type: string | null; created_at: string };
  const person = (people as PersonRow[])[0]!;

  // Fetch relationship + recent memories
  const [relRes, memoriesRes, signalsRes] = await Promise.all([
    db.from('relationships').select('strength, reciprocity, trust_score, stage, last_contact_at').eq('user_id', userId).eq('person_id', person.id).maybeSingle(),
    db.from('memories').select('layer, content, importance').eq('person_id', person.id).order('importance', { ascending: false }).limit(8),
    db.from('signals').select('type, payload, created_at').eq('user_id', userId).eq('person_id', person.id).order('created_at', { ascending: false }).limit(5),
  ]);

  type RelRow = { strength: number; reciprocity: number; trust_score: number; stage: string; last_contact_at: string | null };
  type MemRow = { layer: string; content: string; importance: number };
  type SigRow = { type: string; payload: Record<string, unknown>; created_at: string };

  const rel      = relRes.data as RelRow | null;
  const memories = (memoriesRes.data ?? []) as MemRow[];
  const signals  = (signalsRes.data  ?? []) as SigRow[];

  const memoriesBlock = memories.map(m => `• [${m.layer}] ${m.content}`).join('\n') || 'Sin memorias.';
  const signalsBlock  = signals.map(s => `• ${s.type} — ${days(s.created_at)}`).join('\n') || 'Sin señales.';
  const relBlock = rel
    ? `Etapa: ${rel.stage} | Fuerza: ${rel.strength}/100 | Reciprocidad: ${rel.reciprocity}/100 | Último contacto: ${rel.last_contact_at ? days(rel.last_contact_at) : 'nunca'}`
    : '(sin datos de relación)';

  const prompt = `Genera un briefing ejecutivo CONCISO (máximo 350 palabras) sobre esta persona. Usa estas 6 secciones con emojis: 1⃣ Quién es, 2⃣ Estado actual, 3⃣ Dinámica relacional, 4⃣ Señales, 5⃣ Timing, 6⃣ 3 openers. SIN markdown pesado, usa texto plano con saltos de línea.

PERSONA: ${person.name} | ${person.role ?? '?'} en ${person.organization ?? '?'} | ${person.relationship_type ?? 'networking'}
RELACIÓN: ${relBlock}
MEMORIAS:\n${memoriesBlock}
SEÑALES:\n${signalsBlock}`;

  const text = await aiText(
    'Eres un asistente de inteligencia relacional. Genera briefings concisos y accionables en español para WhatsApp. Sin formato markdown, usa emojis y saltos de línea.',
    prompt,
    700
  );

  if (!text) {
    await sendText(to,
      `📋 *${person.name}*\n` +
      `${person.role ?? ''} ${person.organization ? `en ${person.organization}` : ''}\n\n` +
      `${relBlock}\n\n` +
      `_Activa ANTHROPIC_API_KEY para briefings con IA._`
    );
    return;
  }

  await sendText(to, `📋 *Briefing: ${person.name}*\n\n${text}`);
}

// ─── SEÑAL ───────────────────────────────────────────────────────────────────

export async function cmdSignal(userId: string, to: string, text: string): Promise<void> {
  if (!text.trim()) {
    await sendText(to, '¿Qué señal quieres guardar? Ejemplo: *señal Diana aceptó la propuesta*');
    return;
  }

  const db = getServiceClient();

  const { data: signal } = await db.from('signals').insert({
    user_id: userId,
    type:    'insight',
    payload: { text, source: 'whatsapp_bot' },
  }).select('id').single();

  const id = (signal as { id: string } | null)?.id ?? '?';
  await sendText(to, `✅ Señal guardada\n\n"${text.slice(0, 120)}${text.length > 120 ? '…' : ''}"\n\n_ID: ${id.slice(0, 8)}_`);
}

// ─── ESTADO (rituales) ────────────────────────────────────────────────────────

export async function cmdEstado(userId: string, to: string): Promise<void> {
  const db = getServiceClient();
  const todayStr = new Date().toISOString().slice(0, 10);

  const { data: suggestions } = await db
    .from('ritual_suggestions')
    .select('type, message, action_suggestion, priority, person_id')
    .eq('user_id', userId)
    .gte('created_at', todayStr)
    .order('priority', { ascending: false })
    .limit(3);

  type SuggRow = { type: string; message: string; action_suggestion: string | null; priority: number; person_id: string | null };

  if (!suggestions || (suggestions as unknown[]).length === 0) {
    await sendText(to, '📅 No tienes rituales sugeridos para hoy.\n\nVuelve a intentarlo mañana o genera sugerencias desde la app.');
    return;
  }

  const rows = suggestions as SuggRow[];

  // Fetch person names
  const personIds = [...new Set(rows.filter(r => r.person_id).map(r => r.person_id!))];
  const { data: people } = personIds.length > 0
    ? await db.from('people').select('id, name').in('id', personIds)
    : { data: [] };
  const nameMap = new Map((people ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));

  const lines = rows.map((s, i) => {
    const personName = s.person_id ? nameMap.get(s.person_id) ?? '' : '';
    const who = personName ? ` — *${personName}*` : '';
    return `${i + 1}. ${s.message}${who}\n   ↳ ${s.action_suggestion ?? s.type}`;
  }).join('\n\n');

  await sendText(to, `📅 *Rituales para hoy:*\n\n${lines}`);
}

// ─── RED (top contactos) ──────────────────────────────────────────────────────

export async function cmdRed(userId: string, to: string): Promise<void> {
  const db = getServiceClient();

  const { data: rels } = await db
    .from('relationships')
    .select('person_id, strength, last_contact_at, stage')
    .eq('user_id', userId)
    .order('strength', { ascending: false })
    .limit(5);

  type RelRow = { person_id: string; strength: number; last_contact_at: string | null; stage: string };

  if (!rels || (rels as unknown[]).length === 0) {
    await sendText(to, '👥 Aún no tienes contactos en tu red.\n\nAgrégalos desde sir.marlabinc.com/red');
    return;
  }

  const rows = rels as RelRow[];
  const ids  = rows.map(r => r.person_id);
  const { data: people } = await db.from('people').select('id, name, organization').in('id', ids);
  const nameMap = new Map((people ?? []).map((p: { id: string; name: string; organization: string | null }) => [p.id, p]));

  const lines = rows.map((r, i) => {
    const p = nameMap.get(r.person_id);
    const name  = p?.name ?? 'Desconocido';
    const org   = p?.organization ? ` (${p.organization})` : '';
    const last  = r.last_contact_at ? days(r.last_contact_at) : 'nunca';
    return `${i + 1}. *${name}*${org}\n   💪 ${r.strength}/100 · último: ${last}`;
  }).join('\n\n');

  await sendText(to, `👥 *Tu red — Top ${rows.length}:*\n\n${lines}`);
}

// ─── RESPUESTA IA (unknown messages) ─────────────────────────────────────────

export async function cmdAI(userId: string, to: string, message: string): Promise<void> {
  await sendText(to, '🤔 Analizando...');

  const db = getServiceClient();

  // Light context: recent signals
  const { data: recentSignals } = await db
    .from('signals')
    .select('type, payload, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  type SigRow = { type: string; payload: Record<string, unknown>; created_at: string };
  const context = ((recentSignals ?? []) as SigRow[])
    .map(s => `[${s.type}] ${JSON.stringify(s.payload).slice(0, 80)}`)
    .join('\n') || '(sin contexto reciente)';

  const text = await aiText(
    'Eres SIR, un asistente de inteligencia relacional personal. Respondes en español, de forma concisa (máx 200 palabras) y accionable. Ayudas al usuario a gestionar mejor sus relaciones personales y profesionales.',
    `Contexto reciente del usuario:\n${context}\n\nMensaje del usuario: "${message}"\n\nResponde de forma concisa y útil.`,
    300
  );

  await sendText(to, text || '❓ No pude procesar tu mensaje. Intenta un comando: *ayuda*');
}
