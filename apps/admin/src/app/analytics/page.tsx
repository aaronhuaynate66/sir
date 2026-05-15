export const dynamic = 'force-dynamic';

import { getAdminClient } from '@/lib/supabase-server';

interface EventRow {
  user_id:    string;
  event_name: string;
  properties: Record<string, unknown>;
  created_at: string;
}

const EVENT_COLOR: Record<string, string> = {
  person_viewed:          '#6366f1',
  person_created:         '#8b5cf6',
  briefing_generated:     '#3b82f6',
  signal_created:         '#10b981',
  screenshot_saved:       '#f59e0b',
  state_logged:           '#ec4899',
  graph_viewed:           '#06b6d4',
  interaction_registered: '#34d399',
};

function dayKey(iso: string): string { return iso.slice(0, 10); }

function last14Days(): string[] {
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dayKey(d.toISOString()));
  }
  return days;
}

function relTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1)   return 'ahora';
  if (mins < 60)  return `hace ${mins}m`;
  if (mins < 1440) return `hace ${Math.floor(mins / 60)}h`;
  return `hace ${Math.floor(mins / 1440)}d`;
}

async function getAnalyticsData() {
  const db = getAdminClient();
  const now = new Date();
  const cutoff30  = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const cutoff7   = new Date(now.getTime() -  7 * 86_400_000).toISOString();
  const todayStr  = dayKey(now.toISOString());
  const weekAgo   = dayKey(new Date(now.getTime() - 6 * 86_400_000).toISOString());

  const { data } = await db
    .from('analytics_events')
    .select('user_id, event_name, properties, created_at')
    .gte('created_at', cutoff30)
    .order('created_at', { ascending: false });

  const events = (data ?? []) as EventRow[];

  // Daily bar chart (last 14 days)
  const days = last14Days();
  const perDay = new Map<string, number>(days.map(d => [d, 0]));
  for (const e of events) {
    const k = dayKey(e.created_at);
    if (perDay.has(k)) perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const dailyMax = Math.max(1, ...perDay.values());

  // Top 10 events (last 7 days)
  const events7 = events.filter(e => e.created_at >= cutoff7);
  const topMap = new Map<string, number>();
  for (const e of events7) topMap.set(e.event_name, (topMap.get(e.event_name) ?? 0) + 1);
  const topEvents = [...topMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topMax = Math.max(1, topEvents[0]?.[1] ?? 1);

  // DAU / WAU
  const dauSet = new Set(events.filter(e => dayKey(e.created_at) === todayStr).map(e => e.user_id));
  const wauSet = new Set(events.filter(e => dayKey(e.created_at) >= weekAgo).map(e => e.user_id));

  // Briefings today + cost
  const briefingsToday = events.filter(
    e => e.event_name === 'briefing_generated' && dayKey(e.created_at) === todayStr
  );
  const costToday = briefingsToday.reduce((sum, e) => {
    const c = Number((e.properties)?.['cost_usd'] ?? 0);
    return sum + (isNaN(c) ? 0 : c);
  }, 0);

  // Screenshots today
  const screenshotsToday = events.filter(
    e => e.event_name === 'screenshot_saved' && dayKey(e.created_at) === todayStr
  ).length;

  // Recent 20 events
  const recentEvents = events.slice(0, 20);

  return {
    days, perDay, dailyMax,
    topEvents, topMax,
    dau: dauSet.size, wau: wauSet.size, total: events.length,
    briefingsToday: briefingsToday.length, costToday,
    screenshotsToday,
    recentEvents,
  };
}

export default async function AnalyticsPage() {
  const d = await getAnalyticsData();

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>Analytics</h1>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>Últimos 30 días</span>
      </div>

      {/* KPI row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
        <KpiCard label="Eventos totales"  value={d.total}         color="#6366f1" />
        <KpiCard label="Usuarios activos hoy"   value={d.dau}    color="#10b981" sub="DAU" />
        <KpiCard label="Usuarios activos 7d"    value={d.wau}    color="#3b82f6" sub="WAU" />
      </div>

      {/* KPI row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        <KpiCard label="Briefings hoy"    value={d.briefingsToday}    color="#8b5cf6" />
        <KpiCard label="Costo briefings hoy" value={`$${d.costToday.toFixed(4)}`} color="#f59e0b" raw />
        <KpiCard label="Screenshots hoy"  value={d.screenshotsToday} color="#ec4899" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Daily events bar chart */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: '0 0 18px' }}>
            Eventos por día (últimos 14 días)
          </h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 120 }}>
            {d.days.map(day => {
              const count = d.perDay.get(day) ?? 0;
              const pct   = count / d.dailyMax;
              return (
                <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 9, color: '#6b7280' }}>{count > 0 ? count : ''}</span>
                  <div style={{
                    width: '100%',
                    height: Math.max(4, Math.round(pct * 90)),
                    background: count > 0 ? '#6366f1' : '#e5e7eb',
                    borderRadius: '3px 3px 0 0',
                  }} />
                  <span style={{ fontSize: 8, color: '#9ca3af', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 22 }}>
                    {day.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 10 events (last 7 days) */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: '0 0 14px' }}>
            Top 10 eventos — última semana
          </h2>
          {d.topEvents.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin datos aún</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {d.topEvents.map(([name, count]) => {
                const pct   = Math.round((count / d.topMax) * 100);
                const color = EVENT_COLOR[name] ?? '#6366f1';
                return (
                  <div key={name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>{count}</span>
                    </div>
                    <div style={{ background: '#f3f4f6', borderRadius: 4, height: 5 }}>
                      <div style={{ width: `${pct}%`, height: 5, background: color, borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent events table */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: '0 0 16px' }}>
          Eventos recientes
        </h2>
        {d.recentEvents.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13 }}>Sin eventos aún</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                {['Evento', 'Usuario', 'Hace', 'Propiedades'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.recentEvents.map((e, i) => {
                const color = EVENT_COLOR[e.event_name] ?? '#6366f1';
                const props = Object.entries(e.properties ?? {})
                  .filter(([, v]) => v !== null && v !== undefined)
                  .slice(0, 3)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join(' · ');
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, background: color + '18', color, borderRadius: 4, padding: '2px 7px' }}>
                        {e.event_name}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#374151', fontFamily: 'monospace' }}>
                      {e.user_id.slice(0, 8)}…
                    </td>
                    <td style={{ padding: '8px 10px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {relTime(e.created_at)}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#6b7280', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {props || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, sub, raw }: {
  label: string;
  value: number | string;
  color: string;
  sub?: string;
  raw?: boolean;
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.07)', borderTop: `3px solid ${color}` }}>
      <p style={{ color: '#6b7280', fontSize: 11, fontWeight: 600, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <p style={{ color, fontSize: raw ? 24 : 32, fontWeight: 800, margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ color: '#9ca3af', fontSize: 11, margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}
