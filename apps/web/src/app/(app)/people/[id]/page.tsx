import { redirect, notFound } from 'next/navigation';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import BriefingButton, { type BriefingRecord } from '@/components/BriefingButton';
import { trackServerEvent, EVENTS } from '@sir/analytics';
import InteractionForm from './InteractionForm';
import RelationshipTypeEditor from './RelationshipTypeEditor';
import ScreenshotAnalyzer from './ScreenshotAnalyzer';
import PersonProfileCards from './PersonProfileCards';
import type { DbPerson, DbRelationship, PersonRelationshipType } from '@sir/db';

export const dynamic = 'force-dynamic';

const STAGE_LABEL: Record<string, string> = {
  active:    'Activa',
  strategic: 'Estratégica',
  prospect:  'Prospecto',
  dormant:   'Dormida',
};
const STAGE_COLOR: Record<string, string> = {
  active:    '#86efac',
  strategic: '#fcd34d',
  prospect:  '#93c5fd',
  dormant:   '#d1d5db',
};

const LAYER_COLORS: Record<string, string> = {
  episodic:   '#6366f1',
  semantic:   '#8b5cf6',
  emotional:  '#ec4899',
  procedural: '#f59e0b',
  social:     '#10b981',
  prophetic:  '#06b6d4',
};

function scoreColor(v: number) {
  return v >= 70 ? '#34d399' : v >= 40 ? '#fbbf24' : '#f87171';
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: scoreColor(value) }}>{value}</span>
      </div>
      <div style={{ background: '#2a2d3e', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: 6, background: scoreColor(value), borderRadius: 4 }} />
      </div>
    </div>
  );
}

// ─── Smart Summary helpers ────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7)  return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} semanas`;
  return `hace ${Math.floor(days / 30)} meses`;
}

function daysUntilAnnual(s: string): number {
  const d = new Date(s + 'T00:00:00');
  let next = new Date(new Date().getFullYear(), d.getMonth(), d.getDate());
  if (next.getTime() < Date.now() - 86_400_000)
    next = new Date(next.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.ceil((next.getTime() - Date.now()) / 86_400_000);
}

function buildSummaryLines(
  person: DbPerson,
  rel: DbRelationship | null,
  lastSignalType: string | null,
): string[] {
  const lines: string[] = [];

  // Cycle phase
  if (person.cycle_data?.last_period_start) {
    const start = new Date(person.cycle_data.last_period_start + 'T00:00:00');
    const raw = Math.floor((Date.now() - start.getTime()) / 86_400_000) + 1;
    if (raw >= 1) {
      const day = ((raw - 1) % 28) + 1;
      const phase = day <= 5 ? 'Menstrual' : day <= 13 ? 'Folicular' : day <= 17 ? 'Ovulación' : 'Lútea';
      lines.push(`🌸 En fase ${phase} (día ${day}), próximo período en ~${29 - day} días`);
    }
  }

  // Upcoming dates within 30 days
  const upcoming: string[] = [];
  if (person.birthday) {
    const d = daysUntilAnnual(person.birthday);
    if (d <= 30) upcoming.push(d === 0 ? '🎂 ¡Cumpleaños hoy!' : `🎂 Cumpleaños en ${d} días`);
  }
  if (person.anniversary) {
    const d = daysUntilAnnual(person.anniversary);
    if (d <= 30) upcoming.push(d === 0 ? '💑 ¡Aniversario hoy!' : `💑 Aniversario en ${d} días`);
  }
  if (upcoming.length) lines.push(upcoming.join(' · '));

  // Last interaction
  if (rel?.last_contact_at) {
    lines.push(`💬 Última interacción: ${relativeDate(rel.last_contact_at)}`);
  } else {
    lines.push('💬 Sin interacciones registradas aún');
  }

  // Recent signal (only if room)
  if (lastSignalType && lines.length < 3) {
    lines.push(`📡 Señal reciente: ${lastSignalType}`);
  }

  return lines.slice(0, 3);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PersonPage({ params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const db = getServiceClient();

  const [{ data: personData }, { data: relData }, { data: memoriesData }, { data: briefingsData }, { data: signalData }] = await Promise.all([
    db.from('people')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle(),
    db.from('relationships')
      .select('*')
      .eq('person_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle(),
    db.from('memories')
      .select('id, layer, content, importance, created_at')
      .eq('user_id', user.id)
      .not('layer', 'in', '("sensory","working")')
      .is('expires_at', null)
      .order('created_at', { ascending: false })
      .limit(40),
    db.from('briefings')
      .select('id, content, input_tokens, output_tokens, cost_usd, created_at')
      .eq('person_id', params.id)
      .order('created_at', { ascending: false })
      .limit(5),
    db.from('signals')
      .select('type, created_at')
      .eq('user_id', user.id)
      .contains('payload', { person_id: params.id })
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  if (!personData) notFound();

  const person   = personData  as DbPerson;
  const rel      = relData     as DbRelationship | null;
  const briefings = (briefingsData ?? []) as BriefingRecord[];
  const lastSignalType = (signalData?.[0] as { type: string } | undefined)?.type ?? null;

  const relScore = rel
    ? Math.round(rel.strength * 0.4 + rel.reciprocity * 0.3 + rel.trust_score * 100 * 0.3)
    : null;

  const nameLower = person.name.toLowerCase();
  const allMemories = (memoriesData ?? []) as Array<{ id: string; layer: string; content: string; importance: number; created_at: string }>;
  const personMemories = allMemories
    .filter(m => m.content.toLowerCase().includes(nameLower))
    .slice(0, 12);

  trackServerEvent(user.id, EVENTS.PERSON_VIEWED, {
    person_id:      params.id,
    has_cycle_data: !!person.cycle_data?.detected,
    has_briefing:   briefings.length > 0,
  });

  const summaryLines = buildSummaryLines(person, rel, lastSignalType);

  const avatarColors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  const avatarBg = avatarColors[person.name.charCodeAt(0) % avatarColors.length] ?? '#6366f1';
  const avatarInitials = person.name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
          background: avatarBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 24, fontWeight: 700,
        }}>
          {avatarInitials}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', margin: '0 0 6px' }}>{person.name}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
            <RelationshipTypeEditor
              personId={person.id}
              current={(person.relationship_type ?? 'networking') as PersonRelationshipType}
            />
            {rel?.stage && (
              <span style={{
                fontSize: 11, fontWeight: 600,
                background: STAGE_COLOR[rel.stage] ?? '#d1d5db',
                color: '#111', borderRadius: 10, padding: '2px 8px',
              }}>
                {STAGE_LABEL[rel.stage] ?? rel.stage}
              </span>
            )}
          </div>
          {(person.role || person.organization) && (
            <span style={{ color: '#64748b', fontSize: 13 }}>
              {[person.role, person.organization].filter(Boolean).join(' · ')}
            </span>
          )}
          {person.email && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>{person.email}</p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <BriefingButton personName={person.name} personId={person.id} history={briefings} />
          <ScreenshotAnalyzer
            personId={person.id}
            personName={person.name}
            existingValues={{
              role:          person.role          ?? null,
              organization:  person.organization  ?? null,
              location:      person.location      ?? null,
              education:     person.education     ?? null,
              linkedin_url:  person.linkedin_url  ?? null,
              instagram_url: person.instagram_url ?? null,
              birthday:      person.birthday      ?? null,
              anniversary:   person.anniversary   ?? null,
              notes:         person.notes         ?? null,
            }}
          />
        </div>
      </div>

      {/* Smart Summary */}
      <div style={{
        background: '#1a1d27',
        border: '1px solid #2a2d3e',
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        {summaryLines.map((line, i) => (
          <p key={i} style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
            {line}
          </p>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Relationship score */}
          {rel && relScore !== null && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>Relación</h3>
                <span style={{ fontSize: 28, fontWeight: 800, color: scoreColor(relScore) }}>{relScore}</span>
              </div>
              <ScoreBar label="Fuerza"      value={rel.strength} />
              <ScoreBar label="Reciprocidad" value={rel.reciprocity} />
              <ScoreBar label="Confianza"   value={Math.round(rel.trust_score * 100)} />
              {rel.last_contact_at && (
                <p style={{ margin: '12px 0 0', fontSize: 12, color: '#475569' }}>
                  Último contacto: {new Date(rel.last_contact_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          )}

          {/* Structured profile cards */}
          <PersonProfileCards
            person={{
              id:            person.id,
              role:          person.role          ?? null,
              organization:  person.organization  ?? null,
              location:      person.location      ?? null,
              education:     person.education     ?? null,
              linkedin_url:  person.linkedin_url  ?? null,
              instagram_url: person.instagram_url ?? null,
              birthday:      person.birthday      ?? null,
              anniversary:   person.anniversary   ?? null,
              notes:         person.notes         ?? null,
              work_history:  person.work_history  ?? null,
              cycle_data:            person.cycle_data            ?? null,
              sensitive_context:     person.sensitive_context     ?? null,
              emotional_state:       person.emotional_state       ?? null,
              love_language:         person.love_language         ?? null,
              relationship_patterns: person.relationship_patterns ?? null,
              notes_professional:    person.notes_professional    ?? null,
              notes_social:          person.notes_social          ?? null,
              notes_personal:        person.notes_personal        ?? null,
              relationship_type: person.relationship_type,
            }}
          />

          {/* Register interaction */}
          <InteractionForm personId={person.id} personName={person.name} />
        </div>

        {/* Right column: memories */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: '0 0 14px' }}>
            Memorias asociadas ({personMemories.length})
          </h2>
          {personMemories.length === 0 ? (
            <div style={emptyCard}>
              <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>
                Sin memorias que mencionan a {person.name}.<br />
                <span style={{ fontSize: 12 }}>Se crean automáticamente al enviar señales.</span>
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {personMemories.map(mem => (
                <div key={mem.id} style={{
                  background: '#1a1d27',
                  border: '1px solid #2a2d3e',
                  borderLeft: `3px solid ${LAYER_COLORS[mem.layer] ?? '#475569'}`,
                  borderRadius: '0 10px 10px 0',
                  padding: '10px 14px',
                }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: LAYER_COLORS[mem.layer] ?? '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {mem.layer}
                    </span>
                    <span style={{ color: '#334155', fontSize: 11, marginLeft: 'auto' }}>
                      {new Date(mem.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
                    {mem.content.slice(0, 140)}{mem.content.length > 140 ? '…' : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#1a1d27',
  border: '1px solid #2a2d3e',
  borderRadius: 14,
  padding: 18,
};
const emptyCard: React.CSSProperties = {
  background: '#1a1d27',
  border: '1px dashed #2a2d3e',
  borderRadius: 12,
  padding: 20,
};
