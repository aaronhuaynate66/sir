import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface PersonHealth {
  id:     string;
  name:   string;
  slug:   string;
  score:  number;
  trend:  number;
  reason: string;
}

function healthColor(score: number) {
  return score >= 70 ? '#34d399' : score >= 40 ? '#fbbf24' : '#f87171';
}

function trendArrow(trend: number) {
  return trend > 5 ? '↑' : trend < -5 ? '↓' : '→';
}

export default async function SaludPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const db = getServiceClient();
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 86_400_000).toISOString();

  const [peopleRes, relsRes, signalsRes] = await Promise.all([
    db.from('people').select('id, name, slug').eq('user_id', user.id).order('name'),
    db.from('relationships').select('person_id, strength, reciprocity, trust_score, contact_frequency_days, last_contact_at').eq('user_id', user.id),
    db.from('signals').select('person_id, type, payload, created_at').eq('user_id', user.id).gte('created_at', thirtyDaysAgo),
  ]);

  type PersonRow = { id: string; name: string; slug: string };
  type RelRow    = { person_id: string; strength: number; reciprocity: number; trust_score: number; contact_frequency_days: number | null; last_contact_at: string | null };
  type SigRow    = { person_id: string | null; type: string; payload: Record<string, unknown>; created_at: string };

  const people  = (peopleRes.data  ?? []) as PersonRow[];
  const rels    = (relsRes.data    ?? []) as RelRow[];
  const signals = (signalsRes.data ?? []) as SigRow[];

  const relMap = new Map(rels.map(r => [r.person_id, r]));

  const sigByPerson = new Map<string, SigRow[]>();
  for (const s of signals) {
    if (!s.person_id) continue;
    const arr = sigByPerson.get(s.person_id) ?? [];
    arr.push(s);
    sigByPerson.set(s.person_id, arr);
  }

  function computeScore(personId: string): { score: number; trend: string; reason: string } {
    const rel = relMap.get(personId);
    const sigs = sigByPerson.get(personId) ?? [];
    const interactions = sigs.filter(s => s.type === 'interaction');
    const expectedFreq = rel?.contact_frequency_days ?? 30;

    let freqScore = 50;
    if (rel?.last_contact_at) {
      const daysSince = (now - new Date(rel.last_contact_at).getTime()) / 86_400_000;
      freqScore = Math.max(0, Math.min(100, 100 - (daysSince / expectedFreq) * 50));
    } else if (interactions.length === 0) {
      freqScore = 0;
    }

    const recip      = rel?.reciprocity ?? 50;
    const quality    = rel?.strength    ?? 50;
    const nonInt     = sigs.filter(s => s.type !== 'interaction');
    const acted      = nonInt.filter(s => s.payload['acted'] === true).length;
    const sigScore   = nonInt.length > 0 ? Math.min(100, (acted / nonInt.length) * 100) : 70;

    const score = Math.round(freqScore * 0.30 + recip * 0.25 + quality * 0.25 + sigScore * 0.20);

    let reason = '';
    if (freqScore < 40) reason = 'Sin contacto reciente';
    else if (recip < 40) reason = 'Comunicación desbalanceada';
    else if (quality < 40) reason = 'Baja calidad de interacciones';
    else if (score >= 70) reason = 'Relación saludable';
    else reason = 'Puede mejorar';

    const trend = rel?.last_contact_at && new Date(rel.last_contact_at).getTime() > now - 7 * 86_400_000 ? 'mejorando' : 'estable';

    return { score, trend, reason };
  }

  const healthData: PersonHealth[] = people
    .filter(p => relMap.has(p.id))
    .map(p => {
      const { score, trend: trendLabel, reason } = computeScore(p.id);
      return { id: p.id, name: p.name, slug: p.slug, score, trend: trendLabel === 'mejorando' ? 10 : 0, reason };
    })
    .sort((a, b) => a.score - b.score);

  const critical   = healthData.filter(p => p.score < 40);
  const warning    = healthData.filter(p => p.score >= 40 && p.score < 70);
  const healthy    = healthData.filter(p => p.score >= 70);

  function HealthRow({ p }: { p: PersonHealth }) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#1a1d27', border: `1px solid ${healthColor(p.score)}33`,
        borderRadius: 10, padding: '12px 16px', marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: healthColor(p.score), flexShrink: 0,
          }} />
          <div>
            <Link href={`/red/${p.slug}`} style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
              {p.name}
            </Link>
            <p style={{ color: '#64748b', fontSize: 12, margin: '2px 0 0' }}>{p.reason}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#475569', fontSize: 13 }}>{trendArrow(p.trend)}</span>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: healthColor(p.score),
          }}>
            {p.score}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <Link href="/red" style={{ color: '#6366f1', fontSize: 13, textDecoration: 'none' }}>← Volver a Red</Link>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e2e8f0', margin: '8px 0 6px' }}>Salud relacional</h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
          Score 0-100 por relación: frecuencia (30%), reciprocidad (25%), calidad (25%), señales atendidas (20%).
        </p>
      </div>

      {/* Heat map overview */}
      <div style={{
        background: '#1a1d27', border: '1px solid #2a2d3e',
        borderRadius: 12, padding: '16px 20px', marginBottom: 28,
        display: 'flex', gap: 8, flexWrap: 'wrap',
      }}>
        {healthData.map(p => (
          <Link key={p.id} href={`/red/${p.slug}`} title={`${p.name}: ${p.score}`} style={{
            width: 28, height: 28, borderRadius: 6,
            background: healthColor(p.score),
            display: 'inline-block',
            opacity: 0.7 + (p.score / 100) * 0.3,
            textDecoration: 'none',
          }} />
        ))}
        {healthData.length === 0 && (
          <p style={{ color: '#334155', fontSize: 13, margin: 0 }}>Sin relaciones registradas.</p>
        )}
      </div>

      {critical.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#f87171', margin: '0 0 12px' }}>
            Críticas (score &lt; 40) — {critical.length}
          </h2>
          {critical.map(p => <HealthRow key={p.id} p={p} />)}
        </div>
      )}

      {warning.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fbbf24', margin: '0 0 12px' }}>
            Atencion (40-69) — {warning.length}
          </h2>
          {warning.map(p => <HealthRow key={p.id} p={p} />)}
        </div>
      )}

      {healthy.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#34d399', margin: '0 0 12px' }}>
            Saludables (≥ 70) — {healthy.length}
          </h2>
          {healthy.map(p => <HealthRow key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
