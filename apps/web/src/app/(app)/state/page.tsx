'use client';

import { useState } from 'react';
import { submitStateAction } from '../actions';

const MOOD = ['😔', '😐', '🙂', '😊', '🤩'];
const PHYSICAL_TAGS = ['descansado', 'activo', 'cansado', 'enfermo'];
const EMOTIONAL_TAGS = ['tranquilo', 'motivado', 'feliz', 'ansioso', 'estresado'];

const ENERGY_COLORS: Record<number, string> = {
  1: '#ef4444', 2: '#f87171', 3: '#f97316', 4: '#fb923c', 5: '#fbbf24',
  6: '#facc15', 7: '#a3e635', 8: '#4ade80', 9: '#34d399', 10: '#10b981',
};

function scoreColor(v: number) {
  return v >= 70 ? '#34d399' : v >= 40 ? '#fbbf24' : '#f87171';
}

interface Scores {
  composite_score: number;
  availability_score: number;
  interaction_risk: number;
}

export default function StatePage() {
  const [mood,     setMood]     = useState(3);
  const [energy,   setEnergy]   = useState(5);
  const [physTags, setPhysTags] = useState<string[]>([]);
  const [emotTags, setEmotTags] = useState<string[]>([]);
  const [notes,    setNotes]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [scores,   setScores]   = useState<Scores | null>(null);

  function toggleTag(tag: string, set: string[], setter: (v: string[]) => void) {
    setter(set.includes(tag) ? set.filter(t => t !== tag) : [...set, tag]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const result = await submitStateAction(mood, energy, physTags, emotTags, notes);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else if (result.scores) {
      setScores(result.scores);
    }
  }

  if (scores) {
    return (
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e2e8f0', margin: '0 0 28px' }}>Estado registrado</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 560 }}>
          <ScoreCard label="Compuesto"     value={scores.composite_score}    />
          <ScoreCard label="Disponibilidad" value={scores.availability_score} />
          <ScoreCard label="Riesgo"         value={scores.interaction_risk} invert />
        </div>
        <p style={{ marginTop: 24, fontSize: 14, color: '#64748b' }}>
          {scores.availability_score >= 60
            ? '✓ Buen momento para conectar con personas importantes.'
            : scores.interaction_risk >= 60
            ? '⚠ Hoy mejor limitar interacciones exigentes.'
            : 'Día neutral — gestiona tu energía.'}
        </p>
        <button
          onClick={() => { setScores(null); setNotes(''); setPhysTags([]); setEmotTags([]); }}
          style={secondaryBtn}
        >
          Registrar otro estado
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e2e8f0', margin: '0 0 6px' }}>Estado del día</h1>
      <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 32px' }}>
        Tu estado influye en las sugerencias de contacto y en la memoria emocional.
      </p>

      <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
        {/* Mood */}
        <Section label="¿Cómo te sientes?">
          <div style={{ display: 'flex', gap: 10 }}>
            {MOOD.map((emoji, i) => {
              const v = i + 1;
              return (
                <button key={v} type="button" onClick={() => setMood(v)} style={{
                  flex: 1, padding: '12px 0', fontSize: 28, border: '2px solid',
                  borderColor: mood === v ? '#6366f1' : '#2a2d3e',
                  background:  mood === v ? '#2a2d3e' : 'transparent',
                  borderRadius: 10, cursor: 'pointer',
                }}>
                  {emoji}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Energy */}
        <Section label={`Energía — ${energy}/10`}>
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(v => (
              <button key={v} type="button" onClick={() => setEnergy(v)} style={{
                flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 700,
                border: '2px solid',
                borderColor: energy >= v ? (ENERGY_COLORS[v] ?? '#6366f1') : '#2a2d3e',
                background:  energy >= v ? (ENERGY_COLORS[v] ?? '#6366f1') + '33' : 'transparent',
                color:       energy >= v ? (ENERGY_COLORS[v] ?? '#6366f1') : '#475569',
                borderRadius: 7, cursor: 'pointer',
              }}>
                {v}
              </button>
            ))}
          </div>
        </Section>

        {/* Physical tags */}
        <Section label="Estado físico">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PHYSICAL_TAGS.map(tag => (
              <TagChip
                key={tag} tag={tag}
                active={physTags.includes(tag)}
                onToggle={() => toggleTag(tag, physTags, setPhysTags)}
              />
            ))}
          </div>
        </Section>

        {/* Emotional tags */}
        <Section label="Estado emocional">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {EMOTIONAL_TAGS.map(tag => (
              <TagChip
                key={tag} tag={tag}
                active={emotTags.includes(tag)}
                onToggle={() => toggleTag(tag, emotTags, setEmotTags)}
              />
            ))}
          </div>
        </Section>

        {/* Notes */}
        <Section label="Notas (opcional)">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="¿Algo importante hoy? ¿Cómo fue la mañana?"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 14px',
              background: '#1a1d27',
              border: '1px solid #2a2d3e',
              borderRadius: 8,
              color: '#e2e8f0',
              fontSize: 14,
              outline: 'none',
              resize: 'vertical',
              minHeight: 80,
            }}
          />
        </Section>

        {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button type="submit" disabled={saving} style={primaryBtn(saving)}>
          {saving ? 'Guardando…' : 'Guardar estado'}
        </button>
      </form>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function TagChip({ tag, active, onToggle }: { tag: string; active: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} style={{
      padding: '6px 14px', borderRadius: 20,
      border: `1.5px solid ${active ? '#6366f1' : '#2a2d3e'}`,
      background: active ? '#6366f1' : 'transparent',
      color: active ? '#fff' : '#64748b',
      fontSize: 13, fontWeight: 500, cursor: 'pointer',
    }}>
      {tag}
    </button>
  );
}

function ScoreCard({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const displayValue = invert ? 100 - value : value;
  const color = scoreColor(displayValue);
  return (
    <div style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 12, padding: '16px 18px', textAlign: 'center' }}>
      <p style={{ margin: '0 0 6px', fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color }}>{value}</p>
    </div>
  );
}

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  width: '100%', padding: '12px',
  background: disabled ? '#3730a3' : '#6366f1',
  color: '#fff', border: 'none', borderRadius: 8,
  fontSize: 15, fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.7 : 1,
});

const secondaryBtn: React.CSSProperties = {
  marginTop: 20, padding: '9px 20px',
  background: 'transparent',
  border: '1px solid #2a2d3e',
  borderRadius: 8, color: '#94a3b8',
  fontSize: 13, cursor: 'pointer',
};
