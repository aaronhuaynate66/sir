import { redirect } from 'next/navigation';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import WeeklyReportWidget from './WeeklyReportWidget';

export const dynamic = 'force-dynamic';

export default async function ReportePage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const db = getServiceClient();
  const weekAgo   = new Date(Date.now() - 7  * 86_400_000).toISOString();
  const thirtyAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [interactionsRes, signalsRes, briefingsRes, staleRelsRes, relsRes] = await Promise.all([
    db.from('signals').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', 'interaction').gte('created_at', weekAgo),
    db.from('signals').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', weekAgo),
    db.from('briefings').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', weekAgo),
    db.from('relationships').select('person_id').eq('user_id', user.id).lt('last_contact_at', thirtyAgo),
    db.from('relationships').select('person_id').eq('user_id', user.id).is('last_contact_at', null),
  ]);

  const interactions    = interactionsRes.count   ?? 0;
  const newSignals      = signalsRes.count         ?? 0;
  const briefings       = briefingsRes.count       ?? 0;
  const staleCount      = (staleRelsRes.data?.length ?? 0) + (relsRes.data?.length ?? 0);
  const weekStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  const stats = [
    { label: 'Interacciones registradas', value: interactions, color: '#818cf8', icon: '💬' },
    { label: 'Señales nuevas',            value: newSignals,   color: '#34d399', icon: '◆' },
    { label: 'Briefings generados',       value: briefings,    color: '#fbbf24', icon: '◈' },
    { label: 'Relaciones > 30 días sin contacto', value: staleCount, color: '#f87171', icon: '⚠' },
  ];

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: '0 0 4px' }}>Reporte Semanal</h1>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0, textTransform: 'capitalize' }}>{weekStr}</p>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderTop: `3px solid ${s.color}`, borderRadius: 12, padding: '16px 16px' }}>
            <p style={{ margin: '0 0 6px', fontSize: 20 }}>{s.icon}</p>
            <p style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* AI Report widget */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', margin: '0 0 14px' }}>
          Informe ejecutivo con IA
        </h2>
        <p style={{ color: '#475569', fontSize: 13, margin: '0 0 16px', lineHeight: 1.6 }}>
          Genera un informe ejecutivo personalizado basado en los datos de esta semana.
          Incluye análisis de tu red, señales más importantes y las 3 acciones prioritarias recomendadas.
        </p>
        <WeeklyReportWidget />
      </section>
    </div>
  );
}
