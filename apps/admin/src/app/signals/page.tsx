export const dynamic = 'force-dynamic';

import { getAdminClient } from '@/lib/supabase-server';

const SIGNAL_TYPES = [
  { value: '',             label: 'Todos' },
  { value: 'interaction',  label: 'Interacción' },
  { value: 'emotion',      label: 'Emoción' },
  { value: 'relationship', label: 'Relación' },
  { value: 'task',         label: 'Tarea' },
  { value: 'insight',      label: 'Insight' },
  { value: 'location',     label: 'Ubicación' },
  { value: 'external',     label: 'Externo' },
] as const;

const TYPE_COLOR: Record<string, string> = {
  interaction:  '#ede9fe',
  emotion:      '#ffedd5',
  relationship: '#dcfce7',
  task:         '#dbeafe',
  insight:      '#fce7f3',
  location:     '#e0f2fe',
  external:     '#f3f4f6',
};
const TYPE_TEXT: Record<string, string> = {
  interaction:  '#6d28d9',
  emotion:      '#d97706',
  relationship: '#15803d',
  task:         '#1d4ed8',
  insight:      '#be185d',
  location:     '#0369a1',
  external:     '#374151',
};

interface SignalRow {
  id: string;
  type: string;
  user_id: string;
  processed: boolean;
  created_at: string;
}

const PAGE_SIZE = 40;

async function getSignals(type: string, page: number) {
  const db     = getAdminClient();
  const offset = (page - 1) * PAGE_SIZE;

  let q = db
    .from('signals')
    .select('id, type, user_id, processed, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (type) q = q.eq('type', type);

  const { data, count } = await q;
  return { signals: (data ?? []) as SignalRow[], total: count ?? 0 };
}

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: { type?: string; page?: string };
}) {
  const type    = searchParams.type ?? '';
  const page    = Math.max(1, parseInt(searchParams.page ?? '1', 10));
  const { signals, total } = await getSignals(type, page);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (type)  params.set('type', type);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/signals${qs ? `?${qs}` : ''}`;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>Señales</h1>
        <span style={{ fontSize: 13, color: '#6b7280' }}>{total.toLocaleString('es')} total</span>
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {SIGNAL_TYPES.map(({ value, label }) => {
          const active = type === value;
          return (
            <a
              key={value}
              href={value ? `/signals?type=${value}` : '/signals'}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                textDecoration: 'none', border: '1.5px solid',
                background:  active ? '#1e1b4b' : '#fff',
                color:       active ? '#fff'    : '#6b7280',
                borderColor: active ? '#1e1b4b' : '#e5e7eb',
              }}
            >
              {label}
            </a>
          );
        })}
      </div>

      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Tipo', 'Usuario', 'Estado', 'ID', 'Fecha'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {signals.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                  Sin señales{type ? ` de tipo "${type}"` : ''}
                </td>
              </tr>
            ) : signals.map((s, i) => (
              <tr key={s.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{
                    background: TYPE_COLOR[s.type] ?? '#f3f4f6',
                    color:      TYPE_TEXT[s.type]  ?? '#374151',
                    borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 600,
                  }}>
                    {s.type}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', fontSize: 11, fontFamily: 'monospace', color: '#6b7280' }}>
                  {s.user_id.slice(0, 12)}…
                </td>
                <td style={{ padding: '10px 16px' }}>
                  {s.processed ? (
                    <span style={{ color: '#10b981', fontSize: 13, fontWeight: 700 }}>✓ Procesado</span>
                  ) : (
                    <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 700 }}>⏳ Pendiente</span>
                  )}
                </td>
                <td style={{ padding: '10px 16px', fontSize: 11, fontFamily: 'monospace', color: '#9ca3af' }}>
                  {s.id.slice(0, 8)}…
                </td>
                <td style={{ padding: '10px 16px', fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                  {new Date(s.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
          {page > 1 && (
            <a href={pageUrl(page - 1)} style={paginationStyle(false)}>← Anterior</a>
          )}
          <span style={{ fontSize: 13, color: '#6b7280', padding: '0 8px' }}>
            Página {page} de {totalPages}
          </span>
          {page < totalPages && (
            <a href={pageUrl(page + 1)} style={paginationStyle(false)}>Siguiente →</a>
          )}
        </div>
      )}
    </div>
  );
}

function paginationStyle(_active: boolean): React.CSSProperties {
  return {
    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    textDecoration: 'none', border: '1.5px solid #e5e7eb',
    background: '#fff', color: '#374151',
  };
}
