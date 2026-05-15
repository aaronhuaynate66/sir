'use client';

import { useRef, useState, useTransition } from 'react';
import { confirmScreenshotAction } from '@/app/(app)/actions';
import type { AnalysisResult } from '@/app/api/people/[id]/analyze-screenshot/route';

const PLATFORM_LABELS: Record<AnalysisResult['type'], string> = {
  linkedin:  'LinkedIn',
  instagram: 'Instagram',
  whatsapp:  'WhatsApp',
  unknown:   'Desconocido',
};
const PLATFORM_COLORS: Record<AnalysisResult['type'], string> = {
  linkedin:  '#0077b5',
  instagram: '#e1306c',
  whatsapp:  '#25d366',
  unknown:   '#64748b',
};

interface Props {
  personId:   string;
  personName: string;
}

export default function ScreenshotAnalyzer({ personId, personName }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [analyzing, setAnalyzing]     = useState(false);
  const [analyzeErr, setAnalyzeErr]   = useState<string | null>(null);
  const [result, setResult]           = useState<AnalysisResult | null>(null);
  const [confirmed, setConfirmed]     = useState<AnalysisResult['data'] | null>(null);
  const [saved, setSaved]             = useState(false);
  const [isPending, startTransition]  = useTransition();

  function openPicker() {
    setAnalyzeErr(null);
    setResult(null);
    setSaved(false);
    fileRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset picker so same file can be re-selected
    e.target.value = '';

    setAnalyzing(true);
    setAnalyzeErr(null);
    setResult(null);

    try {
      const base64 = await toBase64(file);
      const res = await fetch(`/api/people/${personId}/analyze-screenshot`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: base64, mimeType: file.type }),
      });
      const json = await res.json() as AnalysisResult | { error: string };
      if ('error' in json) throw new Error(json.error);
      setResult(json);
      setConfirmed({ ...json.data });
    } catch (err) {
      setAnalyzeErr(err instanceof Error ? err.message : 'Error al analizar');
    } finally {
      setAnalyzing(false);
    }
  }

  function handleConfirm() {
    if (!result || !confirmed) return;
    startTransition(async () => {
      const res = await confirmScreenshotAction(personId, personName, result, confirmed);
      if (res.error) {
        setAnalyzeErr(res.error);
      } else {
        setSaved(true);
        setResult(null);
      }
    });
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      <button
        onClick={openPicker}
        disabled={analyzing}
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          6,
          padding:      '6px 14px',
          borderRadius: 8,
          border:       '1px solid #2a2d3e',
          background:   analyzing ? '#1a1d27' : '#1e2130',
          color:        analyzing ? '#475569' : '#94a3b8',
          fontSize:     13,
          fontWeight:   600,
          cursor:       analyzing ? 'wait' : 'pointer',
          transition:   'all 0.15s',
        }}
      >
        {analyzing ? '🔍 Analizando…' : '📷 Analizar screenshot'}
      </button>

      {saved && (
        <p style={{ fontSize: 12, color: '#34d399', margin: '6px 0 0' }}>
          ✓ Datos guardados correctamente
        </p>
      )}
      {analyzeErr && (
        <p style={{ fontSize: 12, color: '#f87171', margin: '6px 0 0' }}>{analyzeErr}</p>
      )}

      {/* Confirmation modal */}
      {result && confirmed && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{
                padding:      '3px 10px',
                borderRadius: 6,
                fontSize:     12,
                fontWeight:   700,
                background:   PLATFORM_COLORS[result.type] + '22',
                color:        PLATFORM_COLORS[result.type],
                border:       `1px solid ${PLATFORM_COLORS[result.type]}44`,
              }}>
                {PLATFORM_LABELS[result.type]}
              </span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>
                Confirmar datos extraídos
              </h3>
            </div>

            {result.data.raw_summary && (
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                {result.data.raw_summary}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {(
                [
                  ['name',          'Nombre',       'text'  ],
                  ['role',          'Cargo',         'text'  ],
                  ['organization',  'Empresa',       'text'  ],
                  ['email',         'Email',         'email' ],
                  ['phone',         'Teléfono',      'tel'   ],
                  ['linkedin_url',  'LinkedIn URL',  'url'   ],
                  ['instagram_url', 'Instagram URL', 'url'   ],
                  ['birthday',      'Cumpleaños',    'date'  ],
                  ['anniversary',   'Aniversario',   'date'  ],
                  ['notes',         'Notas',         'text'  ],
                ] as [keyof AnalysisResult['data'], string, string][]
              ).map(([key, label, type]) => {
                const val = confirmed[key] ?? '';
                if (!val && key === 'notes') return null;
                return (
                  <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {label}
                    </span>
                    <input
                      type={type}
                      value={val}
                      onChange={ev => setConfirmed(prev => ({ ...prev!, [key]: ev.target.value || null }))}
                      style={fieldStyle}
                    />
                  </label>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setResult(null)}
                style={{ ...btnBase, background: '#1a1d27', color: '#64748b', border: '1px solid #2a2d3e' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                style={{ ...btnBase, background: '#6366f1', color: '#fff', border: 'none' }}
              >
                {isPending ? 'Guardando…' : 'Guardar datos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const overlay: React.CSSProperties = {
  position:        'fixed',
  inset:           0,
  background:      'rgba(0,0,0,0.7)',
  zIndex:          1000,
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
  padding:         20,
};
const modal: React.CSSProperties = {
  background:   '#13151f',
  border:       '1px solid #2a2d3e',
  borderRadius: 16,
  padding:      28,
  width:        '100%',
  maxWidth:     480,
  maxHeight:    '90vh',
  overflowY:    'auto',
};
const fieldStyle: React.CSSProperties = {
  background:   '#1a1d27',
  border:       '1px solid #2a2d3e',
  borderRadius: 8,
  padding:      '7px 12px',
  color:        '#e2e8f0',
  fontSize:     13,
  outline:      'none',
  width:        '100%',
};
const btnBase: React.CSSProperties = {
  padding:      '8px 20px',
  borderRadius: 8,
  fontSize:     13,
  fontWeight:   600,
  cursor:       'pointer',
};
