import { redirect } from 'next/navigation';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import ExecutiveBriefingWidget from './ExecutiveBriefingWidget';

export const dynamic = 'force-dynamic';

const SCORE_COLOR = (v: number) => v >= 70 ? '#34d399' : v >= 40 ? '#fbbf24' : '#f87171';
const STAGE_LABELS: Record<string, string> = { active: 'Activa', strategic: 'Estratégica', prospect: 'Prospecto', dormant: 'Dormida' };
const SIGNAL_COLORS: Record<string, string> = {
  promotion: '#34d399', job_change: '#818cf8', travel: '#60a5fa', birthday: '#f472b6',
  publication: '#a78bfa', life_event: '#fcd34d', health_event: '#94a3b8', achievement: '#fbbf24', loss: '#6b7280',
};

function avatarColor(name: string) {
  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  return COLORS[name.charCodeAt(0) % COLORS.length] ?? '#6366f1';
}
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
}

async function getExecutiveData(userId: string) {
  const db = getServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [relsRes, stateRes, signalsRes, oppsRes] = await Promise.all([
    db.from('relationships').select('id, person_id, strength, reciprocity, trust_score, last_contact_at, stage').eq('user_id', userId).order('strength', { ascending: false }).limit(5),
    db.from('human_state_logs').select('mood_score, energy_score, created_at').eq('user_id', userId).gte('created_at', weekAgo).order('created_at', { ascending: true }).limit(7),
    db.from('signals').select('signal_type').eq('user_id', userId).gte('created_at', weekAgo).not('signal_type', 'is', null).limit(200),
    db.from('signals').select('id, signal_type, opportunity_score, action_recommendation, person_id, created_at').eq('user_id', userId).not('signal_type', 'is', null).not('opportunity_score', 'is', null).order('opportunity_score', { ascending: false }).limit(5),
  ]);

  type RelRow = { id: string; person_id: string; strength: number; reciprocity: number; trust_score: number; last_contact_at: string | null; stage: string };
  const rels = (relsRes.data ?? []) as RelRow[];
  const personIds = rels.map(r => r.person_id);
  const oppPersonIds = [...new Set(((oppsRes.data ?? []) as Array<{ person_id: string | null }>).filter(o => o.person_id).map(o => o.person_id as string))];
  const allPersonIds = [...new Set([...personIds, ...oppPersonIds])];

  let peopleMap = new Map<string, { id: string; name: string; organization: string | null }>();
  if (allPersonIds.length > 0) {
    const { data } = await db.from('people').select('id, name, organization').in('id', allPersonIds);
    peopleMap = new Map(((data ?? []) as Array<{ id: string; name: string; organization: string | null }>).map(p => [p.id, p]));
  }

  const topRelations = rels.map(r => {
    const p = peopleMap.get(r.person_id);
    const score = Math.round(r.strength * 0.4 + r.reciprocity * 0.3 + r.trust_score * 100 * 0.3);
    return { id: r.person_id, name: p?.name ?? 'Desconocido', org: p?.organization ?? null, score, stage: r.stage, lastContact: r.last_contact_at };
  });

  type SignalTypeRow = { signal_type: string | null };
  const signalCounts: Record<string, number> = {};
  for (const s of (signalsRes.data ?? []) as SignalTypeRow[]) {
    if (s.signal_type) signalCounts[s.signal_type] = (signalCounts[s.signal_type] ?? 0) + 1;
  }

  type StateRow = { mood_score: number; energy_score: number; created_at: string };
  const stateTrend = ((stateRes.data ?? []) as StateRow[]).map(s => ({
    mood: s.mood_score,
    energy: s.energy_score,
    date: new Date(s.created_at).toLocaleDateString('es-ES', { weekday: 'short' }),
  }));

  type OppRow = { id: string; signal_type: string | null; opportunity_score: number; action_recommendation: string | null; person_id: string | null; created_at: string };
  const opportunities = ((oppsRes.data ?? []) as OppRow[]).map(o => ({
    ...o,
    person: o.person_id ? (peopleMap.get(o.person_id) ?? null) : null,
  }));

  return { topRelations, signalCounts, stateTrend, opportunities };
}

export default async function ExecutivePage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');
  const data = await getExecutiveData(user.id);
  const totalSignals = Object.values(data.signalCounts).reduce((a, b) => a + b, 0);
  const weekStr = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Executive Mode</h1>
          <span style={{ background: '#6366f133', color: '#818cf8', border: '1px solid #6366f144', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>PRO</span>
        </div>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Vista semanal · {weekStr}</p>
      </div>

      {/* AI Executive Briefing */}
      <ExecutiveBriefingWidget />

      {/* Top 5 Active Relations */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', margin: '0 0 14px' }}>Top relaciones activas</h2>
        {data.topRelations.length === 0 ? (
          <div style={emptyCard}>
            <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>Sin relaciones registradas aún.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.topRelations.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(r.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {initials(r.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, color: '#e2e8f0', fontWeight: 600 }}>{r.name}</p>
                  {r.org && <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{r.org}</p>}
                </div>
                <span style={{ fontSize: 11, color: '#64748b', background: '#2a2d3e', borderRadius: 6, padding: '3px 8px' }}>
                  {STAGE_LABELS[r.stage] ?? r.stage}
                </span>
                <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: SCORE_COLOR(r.score), lineHeight: 1 }}>{r.score}</p>
                  <p style={{ margin: 0, fontSize: 10, color: '#475569' }}>score</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mood/Energy Trend + Signal Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
        {/* State Trend */}
        <section>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', margin: '0 0 14px' }}>Estado esta semana</h2>
          <div style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 12, padding: 16 }}>
            {data.stateTrend.length === 0 ? (
              <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>Sin registros esta semana.</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                {data.stateTrend.map((s, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    {/* Energy bar */}
                    <div style={{ width: '100%', background: '#2a2d3e', borderRadius: 3, overflow: 'hidden', height: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <div style={{ height: `${(s.energy / 10) * 100}%`, background: '#818cf8', borderRadius: 3, transition: 'height 0.3s' }} />
                    </div>
                    {/* Mood dot */}
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: SCORE_COLOR(s.mood * 20), flexShrink: 0 }} />
                    <p style={{ fontSize: 9, color: '#475569', margin: 0, textAlign: 'center' as const }}>{s.date}</p>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
              <span style={{ fontSize: 11, color: '#818cf8' }}>■ Energía</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>● Mood</span>
            </div>
          </div>
        </section>

        {/* Signal Distribution */}
        <section>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', margin: '0 0 14px' }}>Señales ({totalSignals})</h2>
          <div style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 12, padding: 16 }}>
            {Object.keys(data.signalCounts).length === 0 ? (
              <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>Sin señales esta semana.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(data.signalCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([type, count]) => {
                    const color = SIGNAL_COLORS[type] ?? '#94a3b8';
                    const pct = totalSignals > 0 ? Math.round((count / totalSignals) * 100) : 0;
                    return (
                      <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8', width: 90, flexShrink: 0 }}>{type}</span>
                        <div style={{ flex: 1, background: '#2a2d3e', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#64748b', width: 28, textAlign: 'right' as const }}>{count}</span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Opportunity Inbox */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', margin: '0 0 14px' }}>Inbox de oportunidades</h2>
        {data.opportunities.length === 0 ? (
          <div style={emptyCard}>
            <p style={{ color: '#475569', fontSize: 14, margin: 0 }}>Sin oportunidades identificadas aún.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.opportunities.map(opp => {
              const color = SIGNAL_COLORS[opp.signal_type ?? ''] ?? '#94a3b8';
              return (
                <div key={opp.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: '#1a1d27', border: '1px solid #2a2d3e', borderLeft: `3px solid ${color}`, borderRadius: '0 10px 10px 0' }}>
                  <div style={{ textAlign: 'center' as const, flexShrink: 0 }}>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: SCORE_COLOR(opp.opportunity_score), lineHeight: 1 }}>{opp.opportunity_score}</p>
                    <p style={{ margin: 0, fontSize: 9, color: '#475569' }}>score</p>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {opp.person && <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{opp.person.name}</p>}
                    <p style={{ margin: 0, fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opp.action_recommendation ?? opp.signal_type}
                    </p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 6, flexShrink: 0 }}>
                    {opp.signal_type}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const emptyCard: React.CSSProperties = {
  background: '#1a1d27', border: '1px dashed #2a2d3e', borderRadius: 10, padding: 20,
};
