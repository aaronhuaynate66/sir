'use client';

import { useRef, useState, useTransition } from 'react';
import { confirmScreenshotAction } from '@/app/(app)/actions';
import type { AnalysisResult } from '@/app/api/people/[id]/analyze-screenshot/route';

const PLATFORM_LABELS: Record<AnalysisResult['type'], string> = {
  linkedin:  'LinkedIn',
  instagram: 'Instagram',
  whatsapp:  'WhatsApp',
  facebook:  'Facebook',
  twitter:   'Twitter/X',
  unknown:   'Desconocido',
};
const PLATFORM_COLORS: Record<AnalysisResult['type'], string> = {
  linkedin:  '#0077b5',
  instagram: '#e1306c',
  whatsapp:  '#25d366',
  facebook:  '#1877f2',
  twitter:   '#1da1f2',
  unknown:   '#64748b',
};

// Fields rendered as editable inputs: [key, label, inputType]
const EDITABLE_FIELDS: [keyof AnalysisResult['data'], string, string][] = [
  ['name',          'Nombre',        'text' ],
  ['role',          'Cargo',         'text' ],
  ['organization',  'Empresa',       'text' ],
  ['email',         'Email',         'email'],
  ['phone',         'Teléfono',      'tel'  ],
  ['linkedin_url',  'LinkedIn URL',  'url'  ],
  ['instagram_url', 'Instagram URL', 'url'  ],
  ['facebook_url',  'Facebook URL',  'url'  ],
  ['twitter_url',   'Twitter/X URL', 'url'  ],
  ['birthday',      'Cumpleaños',    'date' ],
  ['anniversary',   'Aniversario',   'date' ],
  ['location',      'Ubicación',     'text' ],
  ['education',     'Educación',     'text' ],
  ['notes',         'Notas',         'text' ],
];

export interface ExistingPersonValues {
  role:          string | null;
  organization:  string | null;
  location:      string | null;
  education:     string | null;
  linkedin_url:  string | null;
  instagram_url: string | null;
  facebook_url:  string | null;
  twitter_url:   string | null;
  tiktok_url:    string | null;
  birthday:      string | null;
  anniversary:   string | null;
  notes:         string | null;
}

interface Props {
  personId:       string;
  personName:     string;
  existingValues: ExistingPersonValues;
}

// Fields where merge applies (skip name — always editable, not stored directly)
const MERGE_FIELDS = new Set<keyof AnalysisResult['data']>([
  'role', 'organization', 'location', 'education',
  'linkedin_url', 'instagram_url', 'facebook_url', 'twitter_url',
  'birthday', 'anniversary',
]);

export default function ScreenshotAnalyzer({ personId, personName, existingValues }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [analyzing, setAnalyzing]    = useState(false);
  const [analyzeErr, setAnalyzeErr]  = useState<string | null>(null);
  const [result, setResult]          = useState<AnalysisResult | null>(null);
  const [confirmed, setConfirmed]    = useState<AnalysisResult['data'] | null>(null);
  const [saved, setSaved]            = useState(false);
  const [isPending, startTransition] = useTransition();

  function openPicker() {
    setAnalyzeErr(null);
    setResult(null);
    setSaved(false);
    fileRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > 3_000_000) {
      setAnalyzeErr('Imagen demasiado grande. Recorta o comprime el screenshot antes de subirlo (máx 3 MB).');
      return;
    }

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

      let json: AnalysisResult | { error: string };
      try {
        json = await res.json() as typeof json;
      } catch {
        const statusText = res.status === 413
          ? 'Imagen demasiado grande para el servidor. Recorta o comprime el screenshot.'
          : `Error del servidor (${res.status})`;
        throw new Error(statusText);
      }

      if (!res.ok || 'error' in json) throw new Error('error' in json ? json.error : `Error ${res.status}`);
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
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 8,
          border: '1px solid #2a2d3e',
          background: analyzing ? '#1a1d27' : '#1e2130',
          color: analyzing ? '#475569' : '#94a3b8',
          fontSize: 13, fontWeight: 600,
          cursor: analyzing ? 'wait' : 'pointer', transition: 'all 0.15s',
        }}
      >
        {analyzing ? '🔍 Analizando…' : '📷 Analizar screenshot'}
      </button>

      {saved && (
        <p style={{ fontSize: 12, color: '#34d399', margin: '6px 0 0' }}>✓ Datos guardados</p>
      )}
      {analyzeErr && (
        <p style={{ fontSize: 12, color: '#f87171', margin: '6px 0 0' }}>{analyzeErr}</p>
      )}

      {result && confirmed && (
        <div style={overlay}>
          <div style={modal}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                background: PLATFORM_COLORS[result.type] + '22',
                color: PLATFORM_COLORS[result.type],
                border: `1px solid ${PLATFORM_COLORS[result.type]}44`,
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

            {/* Editable fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {EDITABLE_FIELDS.map(([key, label, type]) => {
                const raw = confirmed[key];
                if (Array.isArray(raw)) return null;
                const val = (raw as string | null | undefined) ?? '';
                if (!val && (key === 'notes' || key === 'connections')) return null;

                // Check if this field already has a value in the person record
                const existingVal = MERGE_FIELDS.has(key)
                  ? (existingValues[key as keyof ExistingPersonValues] ?? null)
                  : null;

                // Special case: notes will be concatenated, show hint
                const isNotes = key === 'notes';
                const willConcat = isNotes && !!existingValues.notes && !!val;

                if (existingVal && !isNotes) {
                  // Field already set — show read-only warning, won't be overwritten
                  return (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {label}
                      </span>
                      <div style={{
                        background: '#1a1d27', border: '1px solid #854d0e44',
                        borderRadius: 8, padding: '7px 12px',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <span style={{ fontSize: 12, color: '#92400e' }}>⚠️</span>
                        <span style={{ fontSize: 12, color: '#78350f', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Ya existe: <strong style={{ color: '#fbbf24' }}>{existingVal}</strong>
                          <span style={{ color: '#475569' }}> — no se sobreescribirá</span>
                        </span>
                      </div>
                      {val && val !== existingVal && (
                        <span style={{ fontSize: 11, color: '#475569', paddingLeft: 4 }}>
                          Extraído: {val}
                        </span>
                      )}
                    </div>
                  );
                }

                return (
                  <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {label}
                      {willConcat && (
                        <span style={{ color: '#818cf8', fontWeight: 400, marginLeft: 6, textTransform: 'none' }}>
                          (se añadirá a las notas existentes)
                        </span>
                      )}
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

              {/* Connections — read-only numeric */}
              {confirmed.connections != null && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Conexiones
                  </span>
                  <span style={{ fontSize: 13, color: '#94a3b8', padding: '7px 12px', background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8 }}>
                    {String(confirmed.connections)}
                  </span>
                </div>
              )}
            </div>

            {/* Work history — read-only table */}
            {confirmed.work_history && confirmed.work_history.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>
                  Experiencia laboral
                </span>
                <div style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8, overflow: 'hidden' }}>
                  {confirmed.work_history.map((entry, i) => (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr auto',
                      gap: 8, padding: '8px 12px',
                      borderBottom: i < (confirmed.work_history?.length ?? 0) - 1 ? '1px solid #2a2d3e' : 'none',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>{entry.role}</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{entry.company}</span>
                      <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>{entry.period}</span>
                    </div>
                  ))}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#334155' }}>
                  Se guardará como memoria semántica.
                </p>
              </div>
            )}

            {/* WhatsApp-specific section */}
            {result.type === 'whatsapp' && (confirmed.conversation_tone || confirmed.emotional_state || confirmed.topics?.length || confirmed.cycle_data) && (
              <div style={{ marginBottom: 20, background: '#25d36614', border: '1px solid #25d36630', borderRadius: 10, padding: '12px 14px' }}>
                <span style={{ fontSize: 11, color: '#25d366', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 10 }}>
                  WhatsApp — Contexto de conversación
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {confirmed.conversation_tone && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#64748b', minWidth: 80 }}>Tono</span>
                      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{confirmed.conversation_tone}</span>
                    </div>
                  )}
                  {confirmed.emotional_state && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#64748b', minWidth: 80 }}>Estado</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{confirmed.emotional_state}</span>
                    </div>
                  )}
                  {confirmed.last_interaction_quality && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#64748b', minWidth: 80 }}>Calidad</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{confirmed.last_interaction_quality}</span>
                    </div>
                  )}
                  {confirmed.topics && confirmed.topics.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {confirmed.topics.map((t, i) => (
                        <span key={i} style={{ fontSize: 11, background: '#1e2130', border: '1px solid #2a2d3e', borderRadius: 6, padding: '2px 8px', color: '#818cf8' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {confirmed.cycle_data?.detected && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, background: '#f8717122', color: '#f87171', borderRadius: 6, padding: '2px 8px' }}>
                        Ciclo detectado
                      </span>
                      {confirmed.cycle_data.last_period_start && (
                        <span style={{ fontSize: 11, color: '#64748b' }}>
                          Inicio: {confirmed.cycle_data.last_period_start}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

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
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const modal: React.CSSProperties = {
  background: '#13151f', border: '1px solid #2a2d3e', borderRadius: 16,
  padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto',
};
const fieldStyle: React.CSSProperties = {
  background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8,
  padding: '7px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', width: '100%',
};
const btnBase: React.CSSProperties = {
  padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
