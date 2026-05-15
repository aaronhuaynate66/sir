import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function scoreColor(v: number) { return v >= 70 ? '#34d399' : v >= 40 ? '#fbbf24' : '#f87171'; }
const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
function avatarColor(n: string) { return AVATAR_COLORS[n.charCodeAt(0) % AVATAR_COLORS.length] ?? '#6366f1'; }
function initials(n: string) { return n.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase(); }

export default async function CapitalPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const db = getServiceClient();
  const monthAgo    = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const weekAgo     = new Date(Date.now() -  7 * 86_400_000).toISOString();
  const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();

  const [relsRes, peopleRes, interactionsRes, thisWeekRes, prevWeekRes, unattendedRes, oppsRes] = await Promise.all([
    db.from('relationships').select('person_id, strength, reciprocity, trust_score, stage').eq('user_id', user.id),
    db.from('people').select('id, name, organization, role, relationship_type, slug').eq('user_id', user.id),
    db.from('signals').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'interaction').gte('created_at', monthAgo),
    db.from('signals').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', weekAgo),
    db.from('signals').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', twoWeeksAgo).lt('created_at', weekAgo),
    db.from('signals').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('processed', false).not('opportunity_score', 'is', null).gte('opportunity_score', 60),
    db.from('signals').select('id, signal_type, opportunity_score, action_recommendation, person_id').eq('user_id', user.id).not('signal_type', 'is', null).eq('processed', false).order('opportunity_score', { ascending: false }).limit(3),
  ]);

  type RelRow = { person_id: string; strength: number; reciprocity: number; trust_score: number; stage: string };
  type PersonRow = { id: string; name: string; organization: string | null; role: string | null; relationship_type: string; slug: string | null };

  const rels    = (relsRes.data   ?? []) as RelRow[];
  const people  = (peopleRes.data ?? []) as PersonRow[];
  const peopleMap = new Map(people.map(p => [p.id, p]));

  const strategicCount = rels.filter(r => peopleMap.get(r.person_id)?.relationship_type === 'strategic').length;
  const totalRels      = rels.length;
  const avgStrength    = totalRels > 0 ? rels.reduce((s, r) => s + r.strength, 0) / totalRels : 0;
  const interactionsM  = interactionsRes.count ?? 0;
  const unattended     = unattendedRes.count ?? 0;

  const strategicScore   = Math.min(100, strategicCount * 10) * 0.40;
  const strengthScore    = avgStrength * 0.30;
  const interactionScore = Math.min(100, interactionsM * 5) * 0.20;
  const penalty          = Math.min(30, unattended * 5) * 0.10;
  const totalScore = Math.max(0, Math.min(100, Math.round(strategicScore + strengthScore + interactionScore - penalty)));

  const components = [
    { label: 'Relaciones estratégicas', pts: Math.round(strategicScore),   raw: `${strategicCount} relaciones`, weight: '40%', neg: false },
    { label: 'Fuerza promedio',         pts: Math.round(strengthScore),    raw: `${Math.round(avgStrength)}/100`, weight: '30%', neg: false },
    { label: 'Interacciones mes',       pts: Math.round(interactionScore), raw: `${interactionsM} señales`,   weight: '20%', neg: false },
    { label: 'Sin atender (penaliz.)',  pts: -Math.round(penalty),         raw: `${unattended} pendientes`,   weight: '-10%', neg: true },
  ];

  const topRels = rels
    .map(r => {
      const p = peopleMap.get(r.person_id);
      if (!p) return null;
      const relScore = Math.round(r.strength * 0.4 + r.reciprocity * 0.3 + r.trust_score * 100 * 0.3);
      const isStrategic = p.relationship_type === 'strategic';
      return { person: p, relScore, value: Math.round(relScore * (isStrategic ? 1.5 : 1)), isStrategic };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  type OppRow = { id: string; signal_type: string | null; opportunity_score: number; action_recommendation: string | null; person_id: string | null };
  const opps = (oppsRes.data ?? []) as OppRow[];
  const oppIds = [...new Set(opps.filter(o => o.person_id).map(o => o.person_id as string))];
  let oppMap = new Map<string, PersonRow>();
  if (oppIds.length > 0) {
    const { data } = await db.from('people').select('id, name, organization, role, relationship_type, slug').in('id', oppIds);
    oppMap = new Map(((data ?? []) as PersonRow[]).map(p => [p.id, p]));
  }

  const thisW = thisWeekRes.count ?? 0;
  const prevW = prevWeekRes.count ?? 0;
  const diff  = thisW - prevW;

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: '0 0 4px' }}>Capital Social</h1>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Score 0–100 de tu red de relaciones</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 24, marginBottom: 28 }}>
        {/* Big score */}
        <div style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 14, padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', border: `4px solid ${scoreColor(totalScore)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 32, fontWeight: 900, color: scoreColor(totalScore) }}>{totalScore}</span>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: '#64748b', textAlign: 'center' as const }}>Capital Social</p>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: diff >= 0 ? '#34d399' : '#f87171' }}>{diff >= 0 ? '↑' : '↓'}{Math.abs(diff)}</span>
            <span style={{ fontSize: 11, color: '#334155' }}>señales vs sem ant.</span>
          </div>
        </div>

        {/* Breakdown */}
        <div style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 14, padding: '18px 22px' }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>Desglose de componentes</p>
          {components.map(c => (
            <div key={c.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{c.label}</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#334155' }}>{c.raw}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.neg ? '#f87171' : '#e2e8f0', width: 50, textAlign: 'right' as const }}>
                    {c.neg ? '' : '+'}{c.pts} pts
                  </span>
                  <span style={{ fontSize: 10, color: '#475569', width: 36 }}>{c.weight}</span>
                </div>
              </div>
              <div style={{ background: '#2a2d3e', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, Math.abs(c.pts))}%`, height: '100%', background: c.neg ? '#f87171' : '#818cf8', borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Top 5 relations */}
        <section>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: '0 0 12px' }}>Top 5 relaciones más valiosas</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topRels.length === 0 && <p style={{ color: '#475569', fontSize: 13 }}>Sin relaciones registradas.</p>}
            {topRels.map((r, i) => (
              <Link key={r.person.id} href={`/red/${r.person.slug ?? r.person.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 10, textDecoration: 'none' }}>
                <span style={{ fontSize: 11, color: '#334155', width: 16 }}>#{i + 1}</span>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(r.person.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{initials(r.person.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.person.name}</p>
                  {r.person.organization && <p style={{ margin: 0, fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.person.organization}</p>}
                </div>
                {r.isStrategic && <span style={{ fontSize: 9, background: '#a855f722', color: '#a855f7', border: '1px solid #a855f744', borderRadius: 5, padding: '1px 5px', flexShrink: 0 }}>Estratégico</span>}
                <span style={{ fontSize: 14, fontWeight: 800, color: scoreColor(r.relScore), flexShrink: 0 }}>{r.value}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Top 3 opportunities */}
        <section>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: '0 0 12px' }}>Top 3 oportunidades sin atender</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {opps.length === 0 && <div style={{ background: '#1a1d27', border: '1px dashed #2a2d3e', borderRadius: 10, padding: 16, textAlign: 'center' as const }}><p style={{ color: '#34d399', fontSize: 13, margin: 0 }}>¡Sin pendientes! Estás al día.</p></div>}
            {opps.map(opp => {
              const person = opp.person_id ? oppMap.get(opp.person_id) : null;
              return (
                <div key={opp.id} style={{ padding: '12px 14px', background: '#1a1d27', border: '1px solid #2a2d3e', borderLeft: '3px solid #818cf8', borderRadius: '0 10px 10px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#818cf822', color: '#818cf8', border: '1px solid #818cf844', borderRadius: 5, padding: '1px 6px' }}>{opp.signal_type}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 800, color: scoreColor(opp.opportunity_score) }}>{opp.opportunity_score}</span>
                  </div>
                  {person && <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{person.name}</p>}
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{opp.action_recommendation}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
