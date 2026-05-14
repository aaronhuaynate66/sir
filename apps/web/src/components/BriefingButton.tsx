'use client';

import { useState, useCallback, useMemo } from 'react';

interface Meta {
  inputTokens:  number;
  outputTokens: number;
  costUsd:      number;
  briefingId:   string | null;
}

export interface BriefingRecord {
  id:            string;
  content:       string;
  input_tokens:  number;
  output_tokens: number;
  cost_usd:      number | string;
  created_at:    string;
}

interface Props {
  personName: string;
  personId:   string;
  history?:   BriefingRecord[];
}

interface Section {
  num:     string;
  title:   string;
  content: string;
  open:    boolean;
}

const META_SEP = '\n\n__META__';

const SECTION_ICONS: Record<string, string> = {
  '1': '👤',
  '2': '💡',
  '3': '📊',
  '4': '📡',
  '5': '⏱',
  '6': '💬',
};

function parseSections(text: string): Section[] {
  const lines   = text.split('\n');
  const result: Array<{ num: string; title: string; lines: string[] }> = [];

  for (const line of lines) {
    const m = line.match(/^## (\d+)\. (.+)/);
    if (m) {
      result.push({ num: m[1] ?? '', title: m[2] ?? '', lines: [] });
    } else if (result.length > 0) {
      result[result.length - 1]!.lines.push(line);
    }
  }

  return result.map(s => ({
    num:     s.num,
    title:   s.title.trim(),
    content: s.lines.join('\n').trim(),
    open:    true,
  }));
}

function formatCost(c: number): string {
  return c < 0.001 ? '<$0.001' : `$${c.toFixed(4)}`;
}

export default function BriefingButton({ personName, personId, history = [] }: Props) {
  const [open,      setOpen]      = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [done,      setDone]      = useState(false);
  const [text,      setText]      = useState('');
  const [meta,      setMeta]      = useState<Meta | null>(null);
  const [error,     setError]     = useState('');
  const [sections,  setSections]  = useState<Section[]>([]);
  const [tab,       setTab]       = useState<'briefing' | 'history'>('briefing');

  const generate = useCallback(async () => {
    setStreaming(true);
    setDone(false);
    setText('');
    setSections([]);
    setMeta(null);
    setError('');
    setTab('briefing');

    try {
      const res = await fetch('/api/briefing', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ personId }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Error al generar briefing');
      }
      if (!res.body) throw new Error('No response stream');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buf     = '';

      while (true) {
        const { done: rdDone, value } = await reader.read();
        if (rdDone) break;

        buf += decoder.decode(value, { stream: true });

        const metaIdx = buf.indexOf(META_SEP);
        if (metaIdx !== -1) {
          const textPart = buf.slice(0, metaIdx);
          const metaPart = buf.slice(metaIdx + META_SEP.length);
          setText(textPart);
          try { setMeta(JSON.parse(metaPart) as Meta); } catch { /* ignore */ }
          break;
        }

        setText(buf);
      }

      setText(prev => {
        const parsed = parseSections(prev);
        setSections(parsed);
        return prev;
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setStreaming(false);
    }
  }, [personId]);

  function openAndGenerate() {
    setOpen(true);
    void generate();
  }

  function toggleSection(idx: number) {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, open: !s.open } : s));
  }

  const displaySections = useMemo(() => {
    if (!done || sections.length === 0) return [];
    return sections;
  }, [done, sections]);

  return (
    <>
      <button onClick={openAndGenerate} disabled={streaming} style={triggerBtn(streaming)}>
        {streaming ? '⟳ Generando…' : '✦ Briefing IA'}
      </button>

      {open && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div style={modal}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#e2e8f0' }}>
                  Briefing — {personName}
                </h3>
                {meta && (
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: '#475569' }}>
                    {meta.inputTokens + meta.outputTokens} tokens · {formatCost(meta.costUsd)}
                    {meta.briefingId && ' · guardado'}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {done && (
                  <button
                    onClick={() => void generate()}
                    disabled={streaming}
                    style={regenBtn}
                  >
                    ↺ Regenerar
                  </button>
                )}
                <button onClick={() => setOpen(false)} style={closeBtn}>✕</button>
              </div>
            </div>

            {/* Tabs */}
            {history.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #2a2d3e', paddingBottom: 10 }}>
                {(['briefing', 'history'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} style={tabBtn(tab === t)}>
                    {t === 'briefing' ? '✦ Briefing' : `Historial (${history.length})`}
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            <div style={{ overflowY: 'auto', maxHeight: '60vh' }}>
              {tab === 'history' ? (
                <HistoryPanel history={history} />
              ) : (
                <>
                  {/* Streaming raw text */}
                  {streaming && (
                    <div style={streamBox}>
                      <span style={{ color: '#e2e8f0', whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.8 }}>
                        {text}
                      </span>
                      <span style={cursor} />
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <p style={{ color: '#f87171', fontSize: 13, padding: '12px 0' }}>{error}</p>
                  )}

                  {/* Parsed sections */}
                  {!streaming && done && displaySections.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {displaySections.map((sec, i) => (
                        <div key={i} style={sectionCard}>
                          <button
                            onClick={() => toggleSection(i)}
                            style={sectionHeader}
                          >
                            <span style={{ fontSize: 16, marginRight: 6 }}>
                              {SECTION_ICONS[sec.num] ?? '•'}
                            </span>
                            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#e2e8f0', textAlign: 'left' }}>
                              {sec.num}. {sec.title}
                            </span>
                            <span style={{ color: '#475569', fontSize: 12 }}>{sec.open ? '▲' : '▼'}</span>
                          </button>
                          {sec.open && (
                            <div style={{ padding: '12px 16px', borderTop: '1px solid #2a2d3e' }}>
                              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                                {sec.content}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Fallback: raw text when no sections parsed */}
                  {!streaming && done && displaySections.length === 0 && text && (
                    <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{text}</p>
                  )}

                  {/* Idle state */}
                  {!streaming && !done && !error && (
                    <p style={{ color: '#475569', textAlign: 'center', padding: 24, fontSize: 14 }}>
                      Haz clic en "✦ Briefing IA" para generar el briefing.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {done && meta && (
              <div style={footer}>
                <span style={{ fontSize: 11, color: '#334155' }}>
                  {meta.inputTokens.toLocaleString()} in · {meta.outputTokens.toLocaleString()} out
                </span>
                <span style={{ fontSize: 11, color: '#475569' }}>
                  Costo: {formatCost(meta.costUsd)}
                </span>
                <span style={{ fontSize: 11, color: '#334155' }}>
                  {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── History panel ────────────────────────────────────────────────────────────

function HistoryPanel({ history }: { history: BriefingRecord[] }) {
  const [selected, setSelected] = useState<BriefingRecord | null>(null);

  if (selected) {
    return (
      <div>
        <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: 13, marginBottom: 12, padding: 0 }}>
          ← Volver al historial
        </button>
        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#475569' }}>
          {new Date(selected.created_at).toLocaleString('es-ES')} · {formatCost(Number(selected.cost_usd))}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
          {selected.content}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {history.map(b => (
        <button key={b.id} onClick={() => setSelected(b)} style={historyRow}>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#e2e8f0' }}>
              {new Date(b.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#475569' }}>
              {b.input_tokens + b.output_tokens} tokens · {formatCost(Number(b.cost_usd))}
            </p>
          </div>
          <span style={{ color: '#475569', fontSize: 12 }}>→</span>
        </button>
      ))}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const triggerBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '10px 18px',
  background: '#6366f1',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.7 : 1,
  whiteSpace: 'nowrap',
});

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.72)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100, padding: 20,
};

const modal: React.CSSProperties = {
  background: '#1a1d27',
  border: '1px solid #2a2d3e',
  borderRadius: 18,
  padding: '24px 28px',
  width: '100%',
  maxWidth: 640,
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
};

const closeBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#64748b',
  cursor: 'pointer', fontSize: 18, padding: '2px 6px',
};

const regenBtn: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  border: '1px solid #2a2d3e',
  borderRadius: 7,
  color: '#818cf8',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: '5px 14px',
  background: active ? '#2a2d3e' : 'transparent',
  border: 'none',
  borderRadius: 6,
  color: active ? '#e2e8f0' : '#64748b',
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  cursor: 'pointer',
});

const streamBox: React.CSSProperties = {
  background: '#0f1117',
  border: '1px solid #2a2d3e',
  borderRadius: 10,
  padding: '16px 18px',
  minHeight: 80,
};

const cursor: React.CSSProperties = {
  display: 'inline-block',
  width: 2, height: '1em',
  background: '#818cf8',
  marginLeft: 2,
  verticalAlign: 'text-bottom',
  animation: 'blink 1s step-end infinite',
};

const sectionCard: React.CSSProperties = {
  background: '#0f1117',
  border: '1px solid #2a2d3e',
  borderRadius: 10,
  overflow: 'hidden',
};

const sectionHeader: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '11px 14px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
};

const footer: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderTop: '1px solid #1e2030',
  paddingTop: 12,
  marginTop: 14,
};

const historyRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 14px',
  background: '#0f1117',
  border: '1px solid #2a2d3e',
  borderRadius: 10,
  cursor: 'pointer',
  width: '100%',
};
