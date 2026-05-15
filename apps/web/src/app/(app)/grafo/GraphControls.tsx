'use client';

const CHIPS: { value: string; label: string; color: string }[] = [
  { value: 'all',          label: 'Todos',        color: '#e2e8f0' },
  { value: 'professional', label: 'Profesional',  color: '#818cf8' },
  { value: 'networking',   label: 'Networking',   color: '#60a5fa' },
  { value: 'family',       label: 'Familia',      color: '#ec4899' },
  { value: 'personal',     label: 'Personal',     color: '#34d399' },
  { value: 'strategic',    label: 'Estratégico',  color: '#fbbf24' },
  { value: 'developing',   label: 'Desarrollo',   color: '#94a3b8' },
];

interface Props {
  filterType: string;
  minStrength: number;
  onFilterType: (v: string) => void;
  onMinStrength: (v: number) => void;
}

export default function GraphControls({ filterType, minStrength, onFilterType, onMinStrength }: Props) {
  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, zIndex: 10,
      display: 'flex', flexDirection: 'column', gap: 10,
      background: '#1a1d27', border: '1px solid #2a2d3e',
      borderRadius: 10, padding: '10px 14px',
    }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CHIPS.map(c => {
          const active = filterType === c.value;
          return (
            <button
              key={c.value}
              onClick={() => onFilterType(c.value)}
              style={{
                fontSize: 11, fontWeight: active ? 700 : 500,
                padding: '3px 9px', borderRadius: 20, cursor: 'pointer',
                border: `1px solid ${active ? c.color : '#2a2d3e'}`,
                background: active ? `${c.color}22` : 'transparent',
                color: active ? c.color : '#64748b',
                transition: 'all 0.15s',
                outline: 'none',
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8', userSelect: 'none' }}>
        Fuerza mín.
        <input
          type="range"
          min={0}
          max={90}
          step={10}
          value={minStrength}
          onChange={e => onMinStrength(Number(e.target.value))}
          style={{ width: 80, accentColor: '#6366f1', cursor: 'pointer' }}
        />
        <span style={{ color: '#e2e8f0', minWidth: 22, fontWeight: 600 }}>{minStrength}</span>
      </label>
    </div>
  );
}
