import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

interface AtRiskPerson   { id: string; name: string; slug: string; daysWithout: number; strength: number }
interface UnbalancedPerson { id: string; name: string; slug: string; userSent: number; received: number }
interface PendingPerson  { id: string; name: string; slug: string; pendingCount: number }
interface ActivePerson   { id: string; name: string; slug: string; count: number; strength: number }

interface BehaviorData {
  at_risk:           AtRiskPerson[];
  unbalanced:        UnbalancedPerson[];
  pending_attention: PendingPerson[];
  most_active:       ActivePerson[];
  at_risk_count:     number;
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, color: '#e2e8f0', margin: '0 0 4px' }}>{title}</h2>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>{description}</p>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{
      background: '#1a1d27', border: '1px dashed #2a2d3e',
      borderRadius: 10, padding: '20px 24px',
      color: '#334155', fontSize: 13, textAlign: 'center',
    }}>
      {msg}
    </div>
  );
}

function PersonRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#1a1d27', border: '1px solid #2a2d3e',
      borderRadius: 10, padding: '12px 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

export default async function PatronesPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const db = getServiceClient();

  // Get behavior data (reuse same logic as the API, but server-side)
  const now = Date.now();
  const [peopleRes, relsRes, signalsRes] = await Promise.all([
    db.from('people').select('id, name, slug').eq('user_id', user.id),
    db.from('relationships').select('id, person_id, strength, stage, last_contact_at, contact_frequency_days').eq('user_id', user.id),
    db.from('signals').select('person_id, type, payload, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1000),
  ]);

  type PersonRow = { id: string; name: string; slug: string };
  type RelRow = { id: string; person_id: string; strength: number; stage: string; last_contact_at: string | null; contact_frequency_days: number | null };
  type SigRow = { person_id: string | null; type: string; payload: Record<string, unknown>; created_at: string };

  const people  = (peopleRes.data  ?? []) as PersonRow[];
  const rels    = (relsRes.data    ?? []) as RelRow[];
  const signals = (signalsRes.data ?? []) as SigRow[];

  const personMap = new Map(people.map(p => [p.id, p]));

  const interactionSent     = new Map<string, number>();
  const interactionReceived = new Map<string, number>();
  for (const s of signals) {
    if (s.type !== 'interaction' || !s.person_id) continue;
    const initiated = s.payload['initiated_by'] === 'user';
    if (initiated) interactionSent.set(s.person_id, (interactionSent.get(s.person_id) ?? 0) + 1);
    else interactionReceived.set(s.person_id, (interactionReceived.get(s.person_id) ?? 0) + 1);
  }

  const sevenDaysAgo = new Date(now - 7 * 86_400_000).toISOString();
  const monthAgo     = new Date(now - 30 * 86_400_000).toISOString();

  const pendingByPerson = new Map<string, number>();
  for (const s of signals) {
    if (s.created_at >= sevenDaysAgo || !s.person_id || s.type === 'interaction') continue;
    pendingByPerson.set(s.person_id, (pendingByPerson.get(s.person_id) ?? 0) + 1);
  }

  const monthlyInteractions = new Map<string, number>();
  for (const s of signals) {
    if (s.created_at < monthAgo || !s.person_id) continue;
    monthlyInteractions.set(s.person_id, (monthlyInteractions.get(s.person_id) ?? 0) + 1);
  }

  const atRisk:      BehaviorData['at_risk']      = [];
  const unbalanced:  BehaviorData['unbalanced']   = [];

  for (const rel of rels) {
    const person = personMap.get(rel.person_id);
    if (!person) continue;

    if (rel.last_contact_at) {
      const daysWithout = Math.floor((now - new Date(rel.last_contact_at).getTime()) / 86_400_000);
      if (daysWithout >= 30 && rel.strength > 20) {
        atRisk.push({ id: person.id, name: person.name, slug: person.slug, daysWithout, strength: rel.strength });
      }
    } else if (rel.strength > 20) {
      atRisk.push({ id: person.id, name: person.name, slug: person.slug, daysWithout: 999, strength: rel.strength });
    }

    const sent     = interactionSent.get(rel.person_id)     ?? 0;
    const received = interactionReceived.get(rel.person_id) ?? 0;
    if (sent >= 3 && sent > received * 2) {
      unbalanced.push({ id: person.id, name: person.name, slug: person.slug, userSent: sent, received });
    }
  }

  const pendingAttention = Array.from(pendingByPerson.entries())
    .map(([pid, count]) => { const p = personMap.get(pid); return p ? { ...p, pendingCount: count } : null; })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.pendingCount - a.pendingCount);

  const mostActive = [...monthlyInteractions.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([pid, count]) => { const p = personMap.get(pid); return p ? { ...p, count } : null; })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  atRisk.sort((a, b) => b.daysWithout - a.daysWithout);

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <Link href="/red" style={{ color: '#6366f1', fontSize: 13, textDecoration: 'none' }}>← Volver a Red</Link>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e2e8f0', margin: '8px 0 6px' }}>Patrones de comportamiento</h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
          Análisis de tus dinámicas relacionales basado en interacciones registradas.
        </p>
      </div>

      <Section title="En riesgo de enfriarse" description="Sin contacto en más de 30 días con relaciones activas">
        {atRisk.length === 0 ? (
          <EmptyState msg="Todas tus relaciones activas han tenido contacto reciente." />
        ) : (
          atRisk.map(p => (
            <PersonRow key={p.id}>
              <div>
                <Link href={`/red/${p.slug}`} style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
                  {p.name}
                </Link>
                <p style={{ color: '#64748b', fontSize: 12, margin: '2px 0 0' }}>
                  {p.daysWithout >= 999 ? 'Sin contacto registrado' : `${p.daysWithout} días sin contacto`}
                </p>
              </div>
              <div style={{ textAlign: 'right' as const }}>
                <span style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>🔴 En riesgo</span>
                <p style={{ color: '#475569', fontSize: 11, margin: '2px 0 0' }}>Fuerza: {p.strength}/100</p>
              </div>
            </PersonRow>
          ))
        )}
      </Section>

      <Section title="Relaciones desbalanceadas" description="Tú inicias el contacto con mucha más frecuencia que el otro">
        {unbalanced.length === 0 ? (
          <EmptyState msg="No hay relaciones con desequilibrio notable de iniciativa." />
        ) : (
          unbalanced.map(p => (
            <PersonRow key={p.id}>
              <div>
                <Link href={`/red/${p.slug}`} style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
                  {p.name}
                </Link>
                <p style={{ color: '#64748b', fontSize: 12, margin: '2px 0 0' }}>
                  Tú iniciaste {p.userSent} vs {p.received} del otro
                </p>
              </div>
              <span style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600 }}>↑ Siempre tú</span>
            </PersonRow>
          ))
        )}
      </Section>

      <Section title="Pendientes de atención" description="Señales sin atender en más de 7 días">
        {pendingAttention.length === 0 ? (
          <EmptyState msg="No hay señales pendientes de atención." />
        ) : (
          pendingAttention.map(p => (
            <PersonRow key={p.id}>
              <div>
                <Link href={`/red/${p.slug}`} style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
                  {p.name}
                </Link>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, background: '#fbbf2433',
                color: '#fbbf24', borderRadius: 20, padding: '2px 8px',
              }}>
                {p.pendingCount} señal{p.pendingCount !== 1 ? 'es' : ''} pendiente{p.pendingCount !== 1 ? 's' : ''}
              </span>
            </PersonRow>
          ))
        )}
      </Section>

      <Section title="Más activas este mes" description="Top 5 relaciones con más interacciones en los últimos 30 días">
        {mostActive.length === 0 ? (
          <EmptyState msg="Sin interacciones registradas en los últimos 30 días." />
        ) : (
          mostActive.map((p, i) => (
            <PersonRow key={p.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#6366f1', fontWeight: 700, fontSize: 16, width: 20 }}>#{i+1}</span>
                <Link href={`/red/${p.slug}`} style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
                  {p.name}
                </Link>
              </div>
              <span style={{ color: '#86efac', fontSize: 13, fontWeight: 600 }}>{p.count} interacciones</span>
            </PersonRow>
          ))
        )}
      </Section>
    </div>
  );
}
