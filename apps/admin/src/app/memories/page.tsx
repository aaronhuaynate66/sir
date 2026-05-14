export const dynamic = 'force-dynamic';

import { getAdminClient } from '@/lib/supabase-server';

const LAYERS = [
  { value: '',           label: 'Todas' },
  { value: 'episodic',   label: 'Episódica' },
  { value: 'semantic',   label: 'Semántica' },
  { value: 'procedural', label: 'Procedural' },
  { value: 'emotional',  label: 'Emocional' },
  { value: 'prophetic',  label: 'Profética' },
] as const;

const LAYER_COLOR: Record<string, string> = {
  episodic:   '#dcfce7',
  semantic:   '#ede9fe',
  procedural: '#fce7f3',
  emotional:  '#ffedd5',
  prophetic:  '#f0fdf4',
};
const LAYER_TEXT: Record<string, string> = {
  episodic:   '#15803d',
  semantic:   '#6d28d9',
  procedural: '#be185d',
  emotional:  '#d97706',
  prophetic:  '#166534',
};

interface MemoryRow {
  id: string;
  user_id: string;
  layer: string;
  content: string;
  importance: number;
  created_at: string;
}

async function getMemories(layer: string) {
  const db = getAdminClient();
  let q = db
    .from('memories')
    .select('id, user_id, layer, content, importance, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (layer) q = q.eq('layer', layer);

  const { data } = await q;
  return (data ?? []) as MemoryRow[];
}

export default async function MemoriesPage({
  searchParams,
}: {
  searchParams: { layer?: string };
}) {
  const layer = searchParams.layer ?? '';
  const memories = await getMemories(layer);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: 0 }}>Memorias</h1>
        <span style={{ fontSize: 13, color: '#6b7280' }}>{memories.length} resultado{memories.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Layer filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {LAYERS.map(({ value, label }) => {
          const active = layer === value;
          return (
            <a
              key={value}
              href={value ? `/memories?layer=${value}` : '/memories'}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                textDecoration: 'none', border: '1.5px solid',
                background: active ? '#1e1b4b' : '#fff',
                color:      active ? '#fff'    : '#6b7280',
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
              {['Capa', 'Contenido', 'Usuario', 'Importancia', 'Fecha'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {memories.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                  Sin memorias{layer ? ` en capa "${layer}"` : ''}
                </td>
              </tr>
            ) : memories.map((m, i) => (
              <tr key={m.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{
                    background: LAYER_COLOR[m.layer] ?? '#f3f4f6',
                    color:      LAYER_TEXT[m.layer]  ?? '#374151',
                    borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 700,
                  }}>
                    {m.layer}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', maxWidth: 380 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.content}
                  </p>
                </td>
                <td style={{ padding: '10px 16px', fontSize: 11, fontFamily: 'monospace', color: '#9ca3af' }}>
                  {m.user_id.slice(0, 8)}…
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <ImportanceBar value={m.importance} />
                </td>
                <td style={{ padding: '10px 16px', fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                  {new Date(m.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportanceBar({ value }: { value: number }) {
  const pct   = Math.round(value * 100);
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#e5e7eb';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 60, background: '#f3f4f6', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: 6, background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 11, color: '#9ca3af' }}>{pct}</span>
    </div>
  );
}
