'use client';

import { useState } from 'react';
import Link from 'next/link';

interface RitualItem {
  id:               string;
  personId:         string | null;
  personName:       string | null;
  personSlug:       string | null;
  type:             string;
  icon:             string;
  message:          string;
  actionSuggestion: string | null;
  priority:         number;
  createdAt:        string;
}

export default function RitualsList({ suggestions }: { suggestions: RitualItem[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  async function handleDismiss(id: string) {
    setDismissed(prev => new Set(prev).add(id));
    await fetch('/api/rituals/dismiss', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    });
  }

  const active = suggestions.filter(s => !dismissed.has(s.id));

  const priorityColor = (p: number) => p >= 9 ? '#f87171' : p >= 7 ? '#fbbf24' : '#818cf8';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {active.map(s => (
        <div key={s.id} style={{
          background: '#1a1d27', border: `1px solid ${priorityColor(s.priority)}33`,
          borderRadius: 12, padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#e2e8f0', fontWeight: 600, margin: '0 0 4px', fontSize: 14, lineHeight: 1.4 }}>
                {s.message}
              </p>
              {s.actionSuggestion && (
                <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 10px' }}>
                  💡 {s.actionSuggestion}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                {s.personSlug && (
                  <Link href={`/red/${s.personSlug}`} style={{
                    padding: '5px 12px', background: '#6366f1',
                    color: '#fff', borderRadius: 6, fontSize: 12,
                    fontWeight: 600, textDecoration: 'none',
                  }}>
                    Actuar →
                  </Link>
                )}
                <button
                  onClick={() => void handleDismiss(s.id)}
                  style={{
                    padding: '5px 12px', background: 'transparent',
                    border: '1px solid #2a2d3e', color: '#475569',
                    borderRadius: 6, fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Descartar
                </button>
              </div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: priorityColor(s.priority),
              background: priorityColor(s.priority) + '1a',
              borderRadius: 4, padding: '2px 6px', flexShrink: 0,
            }}>
              P{s.priority}
            </span>
          </div>
        </div>
      ))}

      {active.length === 0 && (
        <div style={{
          background: '#1a1d27', border: '1px dashed #2a2d3e',
          borderRadius: 12, padding: '24px', textAlign: 'center',
          color: '#334155', fontSize: 13,
        }}>
          Todos los rituales descartados. ¡Bien hecho!
        </div>
      )}
    </div>
  );
}
