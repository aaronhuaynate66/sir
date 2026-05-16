import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import type { DbSignal } from '@sir/db';
import type { AdvisorSuggestion } from '@/app/api/advisor/route';

export const dynamic = 'force-dynamic';

function scoreColor(v: number) {
  return v >= 70 ? '#34d399' : v >= 40 ? '#fbbf24' : '#f87171';
}

const STAGE_LABEL: Record<string, string> = {
  active: 'Activa', strategic: 'Estratégica', prospect: 'Prospecto', dormant: 'Dormida',
};
const URGENCY_COLOR = { high: '#ef4444', medium: '#fbbf24', low: '#34d399' };
const URGENCY_LABEL = { high: 'Urgente', medium: 'Pronto', low: 'Cuando puedas' };
const SIGNAL_COLORS: Record<string, string> = {
  interaction: '#818cf8', emotion: '#f472b6', location: '#34d399',
  relationship: '#60a5fa', task: '#fbbf24', insight: '#a78bfa', external: '#94a3b8',
};

const OPP_COLORS: Record<string, string> = {
  promotion: '#34d399', job_change: '#818cf8', travel: '#60a5fa',
  birthday: '#f472b6', publication: '#a78bfa', life_event: '#fcd34d',
  health_event: '#94a3b8', achievement: '#fbbf24', loss: '#6b7280',
};
const OPP_LABELS: Record<string, string> = {
  promotion: 'Promoción', job_change: 'Cambio de rol', travel: 'Viaje',
  birthday: 'Cumpleaños', publication: 'Publicación', life_event: 'Evento vital',
  health_event: 'Salud', achievement: 'Logro', loss: 'Pérdida',
};

const REL_BREAKDOWN_COLORS: Record<string, string> = {
  strategic: '#a855f7', professional: '#3b82f6', personal: '#22c55e',
  family: '#f97316', networking: '#94a3b8', developing: '#eab308',
};
const REL_BREAKDOWN_LABELS: Record<string, string> = {
  strategic: '🎯 Estratégico', professional: '👔 Profesional', personal: '❤️ Personal',
  family: '👨‍👩‍👧 Familia', networking: '🤝 Networking', developing: '🌱 Por desarrollar',
};
const REL_TYPE_ORDER = ['strategic', 'professional', 'personal', 'family', 'networking', 'developing'];

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] ?? '#6366f1'; }
function initials(name: string) { return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase(); }

async function getDashboardData(userId: string) {
  const db = getServiceClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [
    memoriesRes,
    signalsRes,
    weekSignalsRes,
    peopleRes,
    stateRes,
    signalsRecent,
    relsRes,
    opportunitiesRes,
    userRes,
  ] = await Promise.all([
    db.from('memories').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('signals').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    db.from('signals').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', weekAgo),
    db.from('people').select('id, name, organization, role, relationship_type').eq('user_id', userId).order('name').limit(50),
    db.from('human_state_logs')
      .select('composite_score, availability_score, interaction_risk, mood_score')
      .eq('user_id', userId)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('signals')
      .select('id, type, payload, processed, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8),
    db.from('relationships')
      .select('id, person_id, strength, reciprocity, trust_score, stage, last_contact_at, contact_frequency_days')
      .eq('user_id', userId)
      .limit(50),
    db.from('signals')
      .select('id, signal_type, opportunity_score, action_recommendation, person_id, created_at')
      .eq('user_id', userId)
      .not('signal_type', 'is', null)
      .order('opportunity_score', { ascending: false })
      .limit(3),
    db.from('users')
      .select('onboarding_completed')
      .eq('id', userId)
      .single(),
  ]);

  // Build advisor suggestions locally (same algorithm as /api/advisor)
  const people = (peopleRes.data ?? []) as Array<{ id: string; name: string; organization: string | null; role: string | null; relationship_type: string }>;
  const rels = (relsRes.data ?? []) as Array<{
    id: string; person_id: string; strength: number; reciprocity: number;
    trust_score: number; stage: string; last_contact_at: string | null;
    contact_frequency_days: number | null;
  }>;
  const humanState = stateRes.data as { composite_score: number; availability_score: number; interaction_risk: number; mood_score: number } | null;

  const personMap = new Map(people.map(p => [p.id, p]));
  const MS_DAY = 86_400_000;
  const DEFAULT_FREQ = 30;

  const suggestions: AdvisorSuggestion[] = rels
    .map(rel => {
      const person = personMap.get(rel.person_id);
      if (!person) return null;

      const now       = Date.now();
      const lastMs    = rel.last_contact_at ? new Date(rel.last_contact_at).getTime() : null;
      const daysSince = lastMs !== null ? Math.floor((now - lastMs) / MS_DAY) : null;
      const freq      = rel.contact_frequency_days ?? DEFAULT_FREQ;

      const overdueScore = Math.min(100, (daysSince !== null ? daysSince / freq : 1.2) * 50);
      const relScore     = Math.round(rel.strength * 0.4 + rel.reciprocity * 0.3 + rel.trust_score * 100 * 0.3);
      const healthNeed   = 100 - relScore;
      const stageUrgency = ({ dormant: 80, prospect: 50, active: 20, strategic: 15 } as Record<string, number>)[rel.stage] ?? 30;
      const availBonus   = humanState ? (humanState.availability_score / 100) * 20 : 14;
      const contactScore = Math.round((overdueScore * 0.4 + healthNeed * 0.3 + stageUrgency * 0.3) * 0.8 + availBonus);

      const urgency: AdvisorSuggestion['urgency'] = contactScore >= 65 ? 'high' : contactScore >= 40 ? 'medium' : 'low';

      let reason: string;
      if (rel.stage === 'dormant') reason = 'Relación dormida — reactívala';
      else if (daysSince !== null && daysSince > freq * 1.5) reason = `Sin contacto hace ${daysSince} días`;
      else if (daysSince !== null && daysSince > freq) reason = `${daysSince - freq} días pasado el objetivo`;
      else if (relScore < 40) reason = 'La relación necesita más atención';
      else reason = 'Buen momento para contactar';

      return {
        person_id: person.id, person_name: person.name, person_org: person.organization,
        urgency, contact_score: contactScore, reason,
        last_contact_at: rel.last_contact_at, days_since_contact: daysSince,
        relationship_score: relScore,
      } satisfies AdvisorSuggestion;
    })
    .filter((s): s is AdvisorSuggestion => s !== null && s.contact_score > 20)
    .sort((a, b) => b.contact_score - a.contact_score)
    .slice(0, 5);

  // Build opportunities with person names
  type OppRow = { id: string; signal_type: string; opportunity_score: number; action_recommendation: string; person_id: string | null; created_at: string };
  const rawOpps = (opportunitiesRes.data ?? []) as OppRow[];
  const oppPersonIds = [...new Set(rawOpps.filter(o => o.person_id).map(o => o.person_id as string))];
  let oppPeopleMap = new Map<string, { id: string; name: string }>();
  if (oppPersonIds.length > 0) {
    const { data: oppPeople } = await db.from('people').select('id, name').in('id', oppPersonIds);
    oppPeopleMap = new Map(((oppPeople ?? []) as Array<{ id: string; name: string }>).map(p => [p.id, p]));
  }
  const opportunities = rawOpps.map(o => ({
    ...o,
    person: o.person_id ? (oppPeopleMap.get(o.person_id) ?? null) : null,
  }));

  // Breakdown by relationship_type
  const relTypeBreakdown: Record<string, number> = {};
  for (const p of people) {
    const t = p.relationship_type ?? 'networking';
    relTypeBreakdown[t] = (relTypeBreakdown[t] ?? 0) + 1;
  }

  const onboardingCompleted = (userRes.data as { onboarding_completed?: boolean } | null)?.onboarding_completed ?? true;

  // At-risk count: relationships with no contact in 30+ days and strength > 20
  const now = Date.now();
  type RelRow2 = { person_id: string; strength: number; last_contact_at: string | null };
  const atRiskCount = ((relsRes.data ?? []) as RelRow2[]).filter(r => {
    if (r.strength <= 20) return false;
    if (!r.last_contact_at) return true;
    return (now - new Date(r.last_contact_at).getTime()) / 86_400_000 >= 30;
  }).length;

  return {
    totalMemories:      memoriesRes.count  ?? 0,
    totalSignals:       signalsRes.count   ?? 0,
    signalsThisWeek:    weekSignalsRes.count ?? 0,
    totalPeople:        people.length,
    humanState,
    recentSignals:      (signalsRecent.data ?? []) as DbSignal[],
    suggestions,
    userAvailable:      humanState ? humanState.availability_score >= 50 : true,
    opportunities,
    relTypeBreakdown,
    onboardingCompleted,
    atRiskCount,
  };
}

export default async function DashboardPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const data = await getDashboardData(user.id);

  // Redirect new users to onboarding
  if (data.totalPeople === 0 && !data.onboardingCompleted) {
    redirect('/onboarding');
  }
  const todayStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e2e8f0', margin: '0 0 4px' }}>Dashboard</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0, textTransform: 'capitalize' }}>{todayStr}</p>
        </div>
        {data.humanState ? (
          <Link href="/estado" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px', background: '#1a1d27',
            border: '1px solid #2a2d3e', borderRadius: 12,
            textDecoration: 'none',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              border: `2.5px solid ${scoreColor(data.humanState.composite_score)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: scoreColor(data.humanState.composite_score) }}>
                {data.humanState.composite_score}
              </span>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Tu estado hoy</p>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
                Disponibilidad {data.humanState.availability_score}
              </p>
            </div>
          </Link>
        ) : (
          <Link href="/estado" style={{
            padding: '9px 16px', background: '#1a1d27',
            border: '1px dashed #2a2d3e', borderRadius: 10,
            textDecoration: 'none', fontSize: 13, color: '#818cf8',
            fontWeight: 600,
          }}>
            ¿Cómo estás hoy? →
          </Link>
        )}
      </div>

      {/* KPIs */}
      {data.atRiskCount > 0 && (
        <Link href="/red/patrones" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#7f1d1d33', border: '1px solid #ef444444',
          borderRadius: 10, padding: '10px 16px', textDecoration: 'none',
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 13, color: '#fca5a5' }}>
            ⚠ {data.atRiskCount} relación{data.atRiskCount !== 1 ? 'es' : ''} en riesgo de enfriarse
          </span>
          <span style={{ color: '#f87171', fontSize: 12 }}>Ver patrones →</span>
        </Link>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Memorias',     value: data.totalMemories,   color: '#818cf8' },
          { label: 'Señales',      value: data.totalSignals,    color: '#34d399' },
          { label: 'Esta semana',  value: data.signalsThisWeek, color: '#fbbf24' },
          { label: 'Personas',     value: data.totalPeople,     color: '#ec4899' },
        ].map(({ label, value, color }) => (
          <div key={label} style={kpiCard(color)}>
            <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
            <p style={{ color, fontSize: 32, fontWeight: 800, margin: 0, lineHeight: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Opportunities widget */}
      {data.opportunities.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Oportunidades</h2>
            <span style={{
              background: '#f59e0b33', color: '#fbbf24', borderRadius: 20,
              padding: '2px 8px', fontSize: 11, fontWeight: 700,
            }}>
              {data.opportunities.length}
            </span>
            <Link href="/senales" style={{ marginLeft: 'auto', fontSize: 12, color: '#818cf8', textDecoration: 'none' }}>
              Ver todas →
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {data.opportunities.map(opp => {
              const color = OPP_COLORS[opp.signal_type] ?? '#94a3b8';
              return (
                <div key={opp.id} style={{
                  background: '#1a1d27', border: '1px solid #2a2d3e',
                  borderLeft: `3px solid ${color}`,
                  borderRadius: '0 12px 12px 0', padding: '12px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                      background: color + '22', color, border: `1px solid ${color}44`,
                    }}>
                      {OPP_LABELS[opp.signal_type] ?? opp.signal_type}
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 800, color: scoreColor(opp.opportunity_score) }}>
                      {opp.opportunity_score}
                    </span>
                  </div>
                  {opp.person && (
                    <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                      {opp.person.name}
                    </p>
                  )}
                  <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b', lineHeight: 1.5,
                    display: '-webkit-box', overflow: 'hidden', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {opp.action_recommendation}
                  </p>
                  {opp.person && (
                    <Link href={`/red/${opp.person.id}`} style={{
                      fontSize: 11, fontWeight: 600, color,
                      textDecoration: 'none', padding: '4px 10px',
                      background: color + '15', border: `1px solid ${color}33`, borderRadius: 6,
                    }}>
                      Actuar →
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Advisor suggestions */}
      {data.suggestions.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
              Sugerencias de contacto
            </h2>
            {!data.userAvailable && (
              <span style={{ fontSize: 12, color: '#fbbf24' }}>⚠ Tu estado sugiere cautela hoy</span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {data.suggestions.map(s => {
              const uc = URGENCY_COLOR[s.urgency];
              return (
                <Link key={s.person_id} href={`/red/${s.person_id}`} style={{
                  display: 'block',
                  background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 12,
                  padding: 14, textDecoration: 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: avatarColor(s.person_name),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 11, fontWeight: 700,
                    }}>
                      {initials(s.person_name)}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px',
                      borderRadius: 6, border: `1px solid ${uc}`,
                      background: uc + '22', color: uc,
                    }}>
                      {URGENCY_LABEL[s.urgency]}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.person_name}
                  </p>
                  {s.person_org && (
                    <p style={{ margin: '0 0 4px', fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.person_org}
                    </p>
                  )}
                  <p style={{ margin: '0 0 6px', fontSize: 11, color: '#475569', lineHeight: 1.4, display: '-webkit-box', overflow: 'hidden', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {s.reason}
                  </p>
                  <span style={{ fontSize: 14, fontWeight: 800, color: scoreColor(s.relationship_score) }}>
                    {s.relationship_score}
                  </span>
                  <span style={{ fontSize: 10, color: '#475569' }}> rel</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Relationship type breakdown */}
      {data.totalPeople > 0 && Object.keys(data.relTypeBreakdown).length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Red por tipo</h2>
            <Link href="/red" style={{ fontSize: 12, color: '#818cf8', textDecoration: 'none' }}>Ver todas →</Link>
          </div>
          <div style={{
            background: '#1a1d27', border: '1px solid #2a2d3e',
            borderRadius: 14, padding: '14px 20px',
            display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center',
          }}>
            {REL_TYPE_ORDER.filter(t => data.relTypeBreakdown[t]).map(type => {
              const color = REL_BREAKDOWN_COLORS[type] ?? '#94a3b8';
              const count = data.relTypeBreakdown[type] ?? 0;
              return (
                <Link key={type} href={`/red?type=${type}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>{REL_BREAKDOWN_LABELS[type]}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color }}>{count}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Señales recientes */}
        <section>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', margin: '0 0 14px' }}>Señales recientes</h2>
          {data.recentSignals.length === 0 ? (
            <div style={emptyCard}>
              <p style={{ color: '#475569', fontSize: 13, margin: '0 0 10px' }}>Sin señales aún.</p>
              <Link href="/senales" style={{
                display: 'inline-block', padding: '7px 14px',
                background: '#1e2130', border: '1px solid #2a2d3e',
                borderRadius: 7, fontSize: 13, color: '#818cf8', textDecoration: 'none',
              }}>
                Registra tu primera señal →
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.recentSignals.map(signal => (
                <div key={signal.id} style={signalRow}>
                  <span style={{
                    background: SIGNAL_COLORS[signal.type] ?? '#94a3b8',
                    color: '#0f1117', borderRadius: 4, padding: '2px 8px',
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {signal.type}
                  </span>
                  <span style={{ color: '#64748b', fontSize: 11, marginLeft: 'auto' }}>
                    {new Date(signal.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span style={{ fontSize: 13, color: signal.processed ? '#34d399' : '#fbbf24' }}>
                    {signal.processed ? '✓' : '⏳'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* STAGE_LABEL quick stats */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Personas</h2>
            <Link href="/red" style={{ fontSize: 12, color: '#818cf8', textDecoration: 'none' }}>Ver todas →</Link>
          </div>
          {data.suggestions.length === 0 && data.totalPeople === 0 ? (
            <div style={emptyCard}>
              <p style={{ color: '#475569', fontSize: 13, margin: '0 0 10px' }}>
                No hay personas aún.
              </p>
              <Link href="/red" style={{
                display: 'inline-block', padding: '7px 14px',
                background: '#6366f1', border: 'none',
                borderRadius: 7, fontSize: 13, color: '#fff', textDecoration: 'none', fontWeight: 600,
              }}>
                Agrega tu primera persona →
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.suggestions.slice(0, 4).map(s => (
                <Link key={s.person_id} href={`/red/${s.person_id}`} style={contactRow}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: avatarColor(s.person_name),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>
                    {initials(s.person_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.person_name}
                    </p>
                    {s.person_org && (
                      <p style={{ margin: 0, fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.person_org}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(s.relationship_score) }}>
                    {s.relationship_score}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const kpiCard = (color: string): React.CSSProperties => ({
  background: '#1a1d27', border: '1px solid #2a2d3e',
  borderTop: `3px solid ${color}`,
  borderRadius: 12, padding: '18px 20px',
});
const emptyCard: React.CSSProperties = {
  background: '#1a1d27', border: '1px dashed #2a2d3e', borderRadius: 10, padding: 20,
};
const contactRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
  background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 10, textDecoration: 'none',
};
const signalRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
  background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8,
};
