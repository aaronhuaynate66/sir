import { redirect } from 'next/navigation';
import { getAuthUser, getServiceClient } from '@/lib/supabase-server';
import ExecutiveNavTabs from './ExecutiveNavTabs';

function Paywall() {
  return (
    <div style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center' as const, padding: '0 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3, color: '#818cf8' }}>◈</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', margin: '0 0 10px' }}>
        Executive Intelligence Mode
      </h2>
      <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 28px', lineHeight: 1.7 }}>
        Análisis ejecutivo completo de tu red de relaciones estratégicas.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 32, textAlign: 'left' as const }}>
        {([
          ['◎ Stakeholder Map', 'Grafo de relaciones estratégicas y profesionales con ranking por importancia'],
          ['⬛ Relationship Pipeline', 'Kanban con drag & drop para gestionar el pipeline de relaciones'],
          ['◆ Capital Social Score', 'Score 0-100 calculado con 4 métricas ponderadas de tu red'],
          ['◉ Reporte Semanal IA', 'Informe ejecutivo generado con Claude, exportable a PDF'],
        ] as [string, string][]).map(([title, desc]) => (
          <div key={title} style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 10, padding: '14px 16px' }}>
            <p style={{ margin: '0 0 5px', fontSize: 12, fontWeight: 700, color: '#818cf8' }}>{title}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#475569', lineHeight: 1.5 }}>{desc}</p>
          </div>
        ))}
      </div>
      <a href="/settings?upgrade=1" style={{
        display: 'inline-block', padding: '11px 28px',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: '#fff', borderRadius: 10, textDecoration: 'none',
        fontSize: 14, fontWeight: 700,
      }}>
        Actualizar a PRO →
      </a>
    </div>
  );
}

export default async function ExecutiveLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const db = getServiceClient();
  const { data } = await db.from('users').select('subscription_status').eq('id', user.id).single();
  const status = (data as { subscription_status?: string } | null)?.subscription_status ?? 'free';
  const isPaid = status === 'pro' || status === 'enterprise';

  if (!isPaid) return <Paywall />;

  return (
    <div>
      <ExecutiveNavTabs />
      {children}
    </div>
  );
}
