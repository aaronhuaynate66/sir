'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerInteractionAction } from '../../actions';

const QUALITY_OPTIONS = [
  { value: 1, emoji: '💔', label: 'Muy mala' },
  { value: 2, emoji: '😐', label: 'Mala' },
  { value: 3, emoji: '🙂', label: 'Normal' },
  { value: 4, emoji: '😊', label: 'Buena' },
  { value: 5, emoji: '❤️', label: 'Excelente' },
];

interface Props {
  personId: string;
  personName: string;
}

export default function InteractionForm({ personId, personName }: Props) {
  const [quality, setQuality] = useState(3);
  const [notes, setNotes]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const router                = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    const result = await registerInteractionAction(personId, personName, quality, notes);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setNotes('');
      setQuality(3);
      router.refresh();
    }
  }

  return (
    <div style={container}>
      <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
        Registrar interacción
      </h3>
      <form onSubmit={handleSubmit}>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#94a3b8' }}>Calidad de la interacción</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {QUALITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setQuality(opt.value)}
              title={opt.label}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 8,
                border: `2px solid ${quality === opt.value ? '#6366f1' : '#2a2d3e'}`,
                background: quality === opt.value ? '#2a2d3e' : 'transparent',
                fontSize: 20,
                cursor: 'pointer',
              }}
            >
              {opt.emoji}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="¿Qué se habló? ¿Cómo estuvo?"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 12px',
              background: '#0f1117',
              border: '1px solid #2a2d3e',
              borderRadius: 8,
              color: '#e2e8f0',
              fontSize: 13,
              outline: 'none',
              resize: 'vertical',
              minHeight: 72,
            }}
          />
        </div>

        {error   && <p style={{ color: '#f87171',  fontSize: 13, marginBottom: 10 }}>{error}</p>}
        {success && <p style={{ color: '#34d399', fontSize: 13, marginBottom: 10 }}>✓ Interacción registrada</p>}

        <button type="submit" disabled={saving} style={{
          width: '100%', padding: '10px',
          background: saving ? '#3730a3' : '#6366f1',
          color: '#fff', border: 'none', borderRadius: 8,
          fontSize: 14, fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1,
        }}>
          {saving ? 'Guardando…' : 'Registrar'}
        </button>
      </form>
    </div>
  );
}

const container: React.CSSProperties = {
  background: '#1a1d27',
  border: '1px solid #2a2d3e',
  borderRadius: 14,
  padding: 20,
};
