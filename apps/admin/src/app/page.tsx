export const dynamic = 'force-dynamic';

import { getAdminClient } from '@/lib/supabase-server';
import type { MemoryLayer } from '@sir/db';

const LAYERS: Array<{ layer: MemoryLayer; label: string; color: string }> = [
  { layer: 'episodic',   label: 'Episódica',   color: '#dcfce7' },
  { layer: 'semantic',   label: 'Semántica',   color: '#ede9fe' },
  { layer: 'procedural', label: 'Procedural',  color: '#fce7f3' },
  { layer: 'emotional',  label: 'Emocional',   color: '#ffedd5' },
  { layer: 'prophetic',  label: 'Profética',   color: '#f0fdf4' },
];

const SIGNAL_TYPE_COLOR: Record<string, string> = {
  interaction:  '#ede9fe',
  emotion:      '#ffedd5',
  relationship: '#dcfce7',
  task:         '#dbeafe',
  insight:      '#fce7f3',
  location:     '#e0f2fe',
  external:     '#f3f4f6',
};
const SIGNAL_TYPE_TEXT: Record<string, string> = {
  interaction:  '#6d28d9',
  emotion:      '#d97706',
  relationship: '#15803d',
  task:         '#1d4ed8',
  insight:      '#be185d',
  location:     '#0369a1',
  external:     '#374151',
};

async function getDashboardData() {
  const db  = getAdminClient();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [
    layerCounts,
    totalSignals,
    totalUsers,
    pendingSignals,
    todaySignals,
    totalMemories,
    totalPeople,
    totalRelationships,
    todayHumanStates,
    recentSignals,
  ] = await Promise.all([
    Promise.all(
      LAYERS.map(async ({ layer }) => {
        const { count } = await db
          .from('memories')
          .select('*', { count: 'exact', head: true })
          .eq('layer', layer);
        return { layer, count: count ?? 0 };
      })
    ),
    db.from('signals').select('*', { count: 'exact', head: true }),
    db.from('users').select('*', { count: 'exact', head: true }),
    db.from('signals').select('*', { count: 'exact', head: true }).eq('processed', false),
    db.from('signals').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
    db.from('memories').select('*', { count: 'exact', head: true }),
    db.from('people').select('*', { count: 'exact', head: true }),
    db.from('relationships').select('*', { count: 'exact', head: true }),
    db.from('human_state_logs').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
    db.from('signals')
      .select('id, type, user_id, created_at, processed')
      .order('created_at', { ascending: false })
      .limit(12),
  ]);

  return {
    layerCounts,
    totalSignals:       totalSignals.count       ?? 0,
    totalUsers:         totalUsers.count         ?? 0,
    pendingSignals:     pendingSignals.count      ?? 0,
    todaySignals:       todaySignals.count        ?? 0,
    totalMemories:      totalMemories.count       ?? 0,
    totalPeople:        totalPeople.count         ?? 0,
    totalRelationships: totalRelationships.count  ?? 0,
    todayHumanStates:   todayHumanStates.count    ?? 0,
    recentSignals:      (recentSignals.data ?? []) as Array<{
      id: string; type: string; user_id: string; created_at: string; processed: boolean;
    }>,
  };
}

function KpiCard({ label, value, color, sub }: { label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,.07)', borderTop: `3px solid ${color}` }}>
      <p style={{ color: '#6b7280', fontSize: 12, fontWeight: 600, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ color, fontSize: 34, fontWeight: 800, margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ color: '#9ca3af', fontSize: 12, margin: '6px 0 0' }}>{sub}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const d = await getDashboardData();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>Dashboard</h1>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>Actualizado: {new Date().toLocaleTimeString('es')}</span>
      </div>

      {/* KPIs — row 1: usuarios / señales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
        <KpiCard label="Usuarios"           value={d.totalUsers}         color="#6366f1" />
        <KpiCard label="Señales totales"    value={d.totalSignals}       color="#10b981" />
        <KpiCard label="Señales hoy"        value={d.todaySignals}       color="#3b82f6" />
        <KpiCard label="Pendientes"         value={d.pendingSignals}     color="#f59e0b" sub="por procesar" />
      </div>

      {/* KPIs — row 2: datos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
        <KpiCard label="Memorias"           value={d.totalMemories}      color="#8b5cf6" />
        <KpiCard label="Personas"           value={d.totalPeople}        color="#ec4899" />
        <KpiCard label="Relaciones"         value={d.totalRelationships} color="#14b8a6" />
        <KpiCard label="Estados hoy"        value={d.todayHumanStates}   color="#f97316" sub="human state logs" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Capas de memoria */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: '#1f2937' }}>Memorias por capa</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {LAYERS.map(({ layer, label, color }) => {
              const count = d.layerCounts.find((l) => l.layer === layer)?.count ?? 0;
              const pct   = d.totalMemories > 0 ? Math.round((count / d.totalMemories) * 100) : 0;
              return (
                <div key={layer} style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{count}</span>
                  </div>
                  <div style={{ background: '#f3f4f6', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: 6, background: color.replace('fe', '99').replace('f4', '99'), borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })}
            <div style={{ background: '#e0f2fe', borderRadius: 10, padding: '12px 16px' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0369a1' }}>Social (Neo4j)</span>
              <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>— graph store</span>
            </div>
          </div>
        </div>

        {/* Señales recientes */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#1f2937' }}>Señales recientes</h2>
            <a href="/signals" style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none' }}>Ver todas →</a>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,.07)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Tipo', 'Usuario', 'Estado', 'Fecha'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.recentSignals.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Sin señales</td></tr>
                ) : d.recentSignals.map(s => (
                  <tr key={s.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ background: SIGNAL_TYPE_COLOR[s.type] ?? '#f3f4f6', color: SIGNAL_TYPE_TEXT[s.type] ?? '#374151', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{s.type}</span>
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 11, fontFamily: 'monospace', color: '#6b7280' }}>{s.user_id.slice(0, 8)}…</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ color: s.processed ? '#10b981' : '#f59e0b', fontSize: 16 }}>{s.processed ? '✓' : '⏳'}</span>
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 11, color: '#9ca3af' }}>
                      {new Date(s.created_at).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
