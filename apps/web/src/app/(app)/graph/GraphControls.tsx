'use client';

import type { RelationshipType } from '@sir/db';

interface Props {
  filterType: RelationshipType | 'all';
  minStrength: number;
  onFilterType: (v: RelationshipType | 'all') => void;
  onMinStrength: (v: number) => void;
}

const TYPE_OPTIONS: { value: RelationshipType | 'all'; label: string }[] = [
  { value: 'all',          label: 'Todos' },
  { value: 'professional', label: 'Profesional' },
  { value: 'personal',     label: 'Personal' },
  { value: 'family',       label: 'Familia' },
];

export default function GraphControls({ filterType, minStrength, onFilterType, onMinStrength }: Props) {
  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, zIndex: 10,
      display: 'flex', gap: 12, alignItems: 'center',
      background: '#1a1d27', border: '1px solid #2a2d3e',
      borderRadius: 8, padding: '8px 14px',
    }}>
      <select
        value={filterType}
        onChange={e => onFilterType(e.target.value as RelationshipType | 'all')}
        style={{
          background: '#12141f', border: '1px solid #2a2d3e', borderRadius: 6,
          color: '#e2e8f0', fontSize: 12, padding: '4px 8px', cursor: 'pointer', outline: 'none',
        }}
      >
        {TYPE_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

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
