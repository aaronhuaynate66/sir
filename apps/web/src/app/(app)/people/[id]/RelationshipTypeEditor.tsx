'use client';

import { useState, useTransition } from 'react';
import { updatePersonRelationshipTypeAction } from '../../actions';
import type { PersonRelationshipType } from '@sir/db';

const REL_TYPES: { value: PersonRelationshipType; label: string }[] = [
  { value: 'networking',   label: '🤝 Networking' },
  { value: 'professional', label: '👔 Profesional' },
  { value: 'strategic',    label: '🎯 Estratégico' },
  { value: 'personal',     label: '❤️ Personal' },
  { value: 'family',       label: '👨‍👩‍👧 Familia' },
  { value: 'developing',   label: '🌱 Por desarrollar' },
];

export const REL_TYPE_COLORS: Record<PersonRelationshipType, string> = {
  strategic:    '#a855f7',
  professional: '#3b82f6',
  personal:     '#22c55e',
  family:       '#f97316',
  networking:   '#94a3b8',
  developing:   '#eab308',
};

export const REL_TYPE_LABELS: Record<PersonRelationshipType, string> = {
  networking:   '🤝 Networking',
  professional: '👔 Profesional',
  strategic:    '🎯 Estratégico',
  personal:     '❤️ Personal',
  family:       '👨‍👩‍👧 Familia',
  developing:   '🌱 Por desarrollar',
};

export default function RelationshipTypeEditor({
  personId,
  current,
}: {
  personId: string;
  current: PersonRelationshipType;
}) {
  const [value, setValue]     = useState<PersonRelationshipType>(current);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const color = REL_TYPE_COLORS[value];

  function handleChange(next: PersonRelationshipType) {
    setValue(next);
    setEditing(false);
    startTransition(async () => {
      await updatePersonRelationshipTypeAction(personId, next);
    });
  }

  if (editing) {
    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <select
          autoFocus
          value={value}
          onChange={e => handleChange(e.target.value as PersonRelationshipType)}
          onBlur={() => setEditing(false)}
          style={{
            padding: '4px 10px',
            background: '#0f1117',
            border: `1px solid ${color}`,
            borderRadius: 8,
            color: '#e2e8f0',
            fontSize: 13,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {REL_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      disabled={pending}
      title="Haz clic para editar el tipo de relación"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px',
        background: color + '22',
        border: `1px solid ${color}55`,
        borderRadius: 8,
        color,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        opacity: pending ? 0.7 : 1,
      }}
    >
      {REL_TYPE_LABELS[value]}
      <span style={{ fontSize: 10, opacity: 0.6 }}>✎</span>
    </button>
  );
}
