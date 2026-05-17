'use client';

import { useRef, useState, useTransition } from 'react';
import {
  updatePersonExtraFieldsAction,
  updateCycleDataAction,
  updateSensitiveContextAction,
  confirmScreenshotAction,
} from '@/app/(app)/actions';
import type { AnalysisResult } from '@/app/api/people/[id]/analyze-screenshot/route';
import type { WorkHistoryEntry, CycleData } from '@sir/db';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface PersonCardData {
  id:                    string;
  name:                  string;
  role:                  string | null;
  organization:          string | null;
  location:              string | null;
  education:             string | null;
  linkedin_url:          string | null;
  instagram_url:         string | null;
  facebook_url:          string | null;
  twitter_url:           string | null;
  tiktok_url:            string | null;
  birthday:              string | null;
  anniversary:           string | null;
  notes:                 string | null;
  work_history:          WorkHistoryEntry[] | null;
  cycle_data:            CycleData | null;
  sensitive_context:     Record<string, unknown> | null;
  emotional_state:       string | null;
  love_language:         string | null;
  relationship_patterns: string | null;
  notes_professional:    string | null;
  notes_social:          string | null;
  notes_personal:        string | null;
  relationship_type:     string;
}

// ─── SVG Cycle Wheel ──────────────────────────────────────────────────────────

const W = 220;
const CX = 110; const CY = 110;
const RO = 94; const RI = 66;
const SEG = 360 / 28;
const GAP = 2;

function toRad(d: number) { return (d - 90) * (Math.PI / 180); }
function pt(r: number, d: number): [number, number] {
  return [CX + r * Math.cos(toRad(d)), CY + r * Math.sin(toRad(d))];
}
function segPath(a1: number, a2: number): string {
  const [x1, y1] = pt(RO, a1); const [x2, y2] = pt(RO, a2);
  const [x3, y3] = pt(RI, a2); const [x4, y4] = pt(RI, a1);
  return `M${x1.toFixed(2)},${y1.toFixed(2)}A${RO},${RO},0,0,1,${x2.toFixed(2)},${y2.toFixed(2)}L${x3.toFixed(2)},${y3.toFixed(2)}A${RI},${RI},0,0,0,${x4.toFixed(2)},${y4.toFixed(2)}Z`;
}

function phaseColor(d: number): string {
  if (d <= 5)  return '#E8394D';
  if (d <= 13) return '#4CAF82';
  if (d <= 17) return '#2ECC71';
  return '#7C6FCD';
}
function phaseName(d: number): string {
  if (d <= 5)  return 'Menstrual';
  if (d <= 13) return 'Folicular';
  if (d <= 17) return 'Ovulación';
  return 'Lútea';
}

function CycleWheel({ day }: { day: number }) {
  const RM = (RO + RI) / 2;
  const [dotX, dotY] = pt(RM, (day - 1) * SEG + SEG / 2);
  const col = phaseColor(day);

  return (
    <svg width={W} height={W} viewBox={`0 0 ${W} ${W}`} style={{ display: 'block', margin: '0 auto' }}>
      <defs>
        <filter id="wglow">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="bg-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#1e1b2e" />
          <stop offset="100%" stopColor="#13111f" />
        </radialGradient>
      </defs>

      {/* Background circle */}
      <circle cx={CX} cy={CY} r={RI - 4} fill="url(#bg-grad)" />

      {/* Segments */}
      {Array.from({ length: 28 }, (_, i) => {
        const d = i + 1;
        const a1 = i * SEG + GAP;
        const a2 = (i + 1) * SEG - GAP;
        const c = phaseColor(d);
        return (
          <path
            key={d}
            d={segPath(a1, a2)}
            fill={d <= day ? c : c + '28'}
          />
        );
      })}

      {/* Outer glow ring */}
      <circle cx={CX} cy={CY} r={RO + 5} fill="none"
        stroke={col} strokeWidth={2} opacity={0.2} />

      {/* Today dot */}
      <circle cx={dotX} cy={dotY} r={7} fill="white" filter="url(#wglow)" />
      <circle cx={dotX} cy={dotY} r={3.5} fill={col} />

      {/* Center label */}
      <text x={CX} y={CY - 20} textAnchor="middle"
        fontSize="8.5" fontWeight="800" letterSpacing="1.5"
        fill={col} style={{ fontFamily: 'system-ui,sans-serif', textTransform: 'uppercase' }}>
        {phaseName(day)}
      </text>
      <text x={CX} y={CY + 14} textAnchor="middle"
        fontSize="30" fontWeight="800" fill="white"
        style={{ fontFamily: 'system-ui,sans-serif' }}>
        {day}
      </text>
      <text x={CX} y={CY + 30} textAnchor="middle"
        fontSize="10" fill="#475569"
        style={{ fontFamily: 'system-ui,sans-serif' }}>
        del ciclo
      </text>
    </svg>
  );
}

// ─── Cycle helpers ────────────────────────────────────────────────────────────

function getCycleInfo(lastPeriodStart: string) {
  const start = new Date(lastPeriodStart + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const raw = Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;
  if (raw < 1) return null;
  const day = ((raw - 1) % 28) + 1;
  return { day, name: phaseName(day), color: phaseColor(day), nextIn: 29 - day };
}

const RECS: Record<string, { emoji: string; text: string }> = {
  Menstrual: { emoji: '🌙', text: 'Dale espacio y calma hoy' },
  Folicular: { emoji: '✨', text: 'Buen momento para planes juntos' },
  Ovulación: { emoji: '💬', text: 'Conversaciones importantes hoy' },
  Lútea:     { emoji: '🤍', text: 'Tono suave, evita presión' },
};

// ─── Symptoms ─────────────────────────────────────────────────────────────────

type SymKey = 'mood' | 'energy' | 'sleep' | 'pain';
const SYMS: Array<{ key: SymKey; emoji: string; label: string; color: string }> = [
  { key: 'mood',   emoji: '😊', label: 'Ánimo',   color: '#f59e0b' },
  { key: 'energy', emoji: '⚡', label: 'Energía', color: '#34d399' },
  { key: 'sleep',  emoji: '😴', label: 'Sueño',   color: '#818cf8' },
  { key: 'pain',   emoji: '💊', label: 'Dolor',   color: '#f87171' },
];

// ─── Love languages ───────────────────────────────────────────────────────────

const LOVE_LANGS = [
  { v: 'words',   l: 'Palabras de afirmación' },
  { v: 'time',    l: 'Tiempo de calidad'       },
  { v: 'gifts',   l: 'Regalos'                 },
  { v: 'service', l: 'Actos de servicio'       },
  { v: 'touch',   l: 'Contacto físico'         },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────

function daysUntil(s: string): number {
  const d = new Date(s + 'T00:00:00');
  let next = new Date(new Date().getFullYear(), d.getMonth(), d.getDate());
  if (next.getTime() < Date.now() - 86_400_000)
    next = new Date(new Date().getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.ceil((next.getTime() - Date.now()) / 86_400_000);
}
function fmtES(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}
function igUser(u: string): string {
  const m = u.match(/instagram\.com\/([^/?#]+)/);
  return m ? `@${m[1]}` : u;
}
function liUser(u: string): string {
  const m = u.match(/linkedin\.com\/in\/([^/?#]+)/);
  return m?.[1] ?? u;
}
function fbUser(u: string): string {
  const m = u.match(/facebook\.com\/([^/?#]+)/);
  return m?.[1] ?? u;
}
function twUser(u: string): string {
  const m = u.match(/(?:twitter|x)\.com\/([^/?#]+)/);
  return m ? `@${m[1] ?? ''}` : u;
}
function ttUser(u: string): string {
  const m = u.match(/tiktok\.com\/@?([^/?#]+)/);
  return m ? `@${m[1] ?? ''}` : u;
}

// ─── Scan helpers ─────────────────────────────────────────────────────────────

const SCAN_PLATFORM_COLORS: Record<string, string> = {
  linkedin:  '#0077b5',
  instagram: '#e1306c',
  facebook:  '#1877f2',
  twitter:   '#1da1f2',
};
const SCAN_PLATFORM_LABELS: Record<string, string> = {
  linkedin:  'LinkedIn',
  instagram: 'Instagram',
  facebook:  'Facebook',
  twitter:   'Twitter/X',
};

function detectPlatform(url: string): string {
  if (url.includes('linkedin'))  return 'linkedin';
  if (url.includes('instagram')) return 'instagram';
  if (url.includes('facebook'))  return 'facebook';
  if (url.includes('twitter') || url.includes('x.com')) return 'twitter';
  return 'unknown';
}

function toBase64Scan(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── ScanProfilePanel ─────────────────────────────────────────────────────────

const SCAN_EDITABLE_FIELDS: [keyof AnalysisResult['data'], string][] = [
  ['role',         'Cargo'],
  ['organization', 'Empresa'],
  ['location',     'Ubicación'],
  ['education',    'Educación'],
  ['notes',        'Notas'],
];

function ScanProfilePanel({
  personId,
  personName,
  url,
  onClose,
  onSaved,
}: {
  personId:   string;
  personName: string;
  url:        string;
  onClose:    () => void;
  onSaved:    () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing]    = useState(false);
  const [scanErr,   setScanErr]      = useState<string | null>(null);
  const [result,    setResult]       = useState<AnalysisResult | null>(null);
  const [confirmed, setConfirmed]    = useState<AnalysisResult['data'] | null>(null);
  const [saved,     setSaved]        = useState(false);
  const [isPending, startTransition] = useTransition();

  const plat      = result?.type ?? detectPlatform(url);
  const platColor = SCAN_PLATFORM_COLORS[plat] ?? '#6366f1';
  const platLabel = SCAN_PLATFORM_LABELS[plat] ?? 'Perfil';

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // Warn early if file is too large (>3MB uncompressed → ~4MB base64)
    if (file.size > 3_000_000) {
      setScanErr('La imagen es muy grande. Recorta o comprime el screenshot antes de subirlo (máx 3 MB).');
      return;
    }

    setAnalyzing(true);
    setScanErr(null);
    try {
      const b64 = await toBase64Scan(file);
      const res = await fetch(`/api/people/${personId}/analyze-screenshot`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: b64, mimeType: file.type }),
      });

      // Handle non-JSON responses (413 "Request Entity Too Large", 502, etc.)
      let json: AnalysisResult | { error: string };
      try {
        json = await res.json() as typeof json;
      } catch {
        const statusText = res.status === 413
          ? 'Imagen demasiado grande para el servidor. Recorta o comprime el screenshot.'
          : `Error del servidor (${res.status})`;
        throw new Error(statusText);
      }

      if (!res.ok || 'error' in json) {
        throw new Error('error' in json ? json.error : `Error ${res.status}`);
      }
      setResult(json);
      setConfirmed({ ...json.data });
    } catch (err) {
      setScanErr(err instanceof Error ? err.message : 'Error al analizar');
    } finally {
      setAnalyzing(false);
    }
  }

  function handleConfirm() {
    if (!result || !confirmed) return;
    startTransition(async () => {
      const res = await confirmScreenshotAction(personId, personName, result, confirmed);
      if (res.error) { setScanErr(res.error); }
      else { setSaved(true); setTimeout(onSaved, 1400); }
    });
  }

  if (saved) {
    return (
      <div style={{ marginTop: 6, padding: '7px 12px', background: '#0d2e1a', border: '1px solid #25d36630', borderRadius: 8 }}>
        <p style={{ margin: 0, fontSize: 12, color: '#34d399' }}>✓ Datos guardados correctamente</p>
      </div>
    );
  }

  // ── Result confirmation modal (overlay) ────────────────────────────────────
  if (result && confirmed) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#13151f', border: '1px solid #2a2d3e', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, maxHeight: '85vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: platColor + '22', color: platColor, border: `1px solid ${platColor}44` }}>
              {platLabel}
            </span>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>Confirmar datos</h3>
          </div>
          {result.data.raw_summary && (
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{result.data.raw_summary}</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {SCAN_EDITABLE_FIELDS.map(([key, label]) => {
              const raw = confirmed[key];
              if (Array.isArray(raw) || !raw) return null;
              const val = String(raw);
              return (
                <label key={String(key)} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
                  <input
                    type="text"
                    value={val}
                    onChange={ev => setConfirmed(p => ({ ...p!, [key]: ev.target.value || null }))}
                    style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8, padding: '7px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', width: '100%', colorScheme: 'dark' as const }}
                  />
                </label>
              );
            })}
          </div>
          {scanErr && <p style={{ fontSize: 12, color: '#f87171', margin: '0 0 12px' }}>{scanErr}</p>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#1a1d27', color: '#64748b', border: '1px solid #2a2d3e' }}>
              Cancelar
            </button>
            <button onClick={handleConfirm} disabled={isPending} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: isPending ? 'wait' : 'pointer', background: '#6366f1', color: '#fff', border: 'none' }}>
              {isPending ? 'Guardando…' : 'Guardar datos'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Instructions panel (inline) ────────────────────────────────────────────
  return (
    <div style={{ marginTop: 6, background: '#0f1520', border: '1px solid #2a2d3e', borderRadius: 8, padding: '10px 14px' }}>
      {analyzing ? (
        <p style={{ margin: 0, fontSize: 12, color: '#818cf8' }}>🔍 Analizando screenshot…</p>
      ) : (
        <>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
            1. Toma un screenshot del perfil que se abrió<br />
            2. Súbelo aquí para que SIR extraiga la información
          </p>
          <label style={{ display: 'inline-block', padding: '6px 12px', background: '#6366f122', border: '1px solid #6366f144', borderRadius: 6, color: '#818cf8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            📂 Seleccionar screenshot
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
          </label>
        </>
      )}
      {scanErr && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#f87171' }}>{scanErr}</p>}
      <button onClick={onClose} style={{ display: 'block', marginTop: 8, background: 'none', border: 'none', color: '#334155', fontSize: 11, cursor: 'pointer', padding: 0 }}>
        Cerrar ×
      </button>
    </div>
  );
}

// ─── Field components ─────────────────────────────────────────────────────────

function TF({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={LS}>{label}</span>
      <input type={type} value={value} placeholder={placeholder ?? ''}
        onChange={e => onChange(e.target.value)} style={IS} />
    </label>
  );
}

function SF({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: Array<{ v: string; l: string }>;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={LS}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ ...IS, appearance: 'none' as const }}>
        <option value="">Sin seleccionar</option>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ title, editing, onEdit, onSave, onCancel, isPending, children, editChildren,
  collapsible = false, startCollapsed = false, badge,
}: {
  title: string; editing: boolean; onEdit: () => void; onSave: () => void;
  onCancel: () => void; isPending: boolean;
  children: React.ReactNode; editChildren: React.ReactNode;
  collapsible?: boolean; startCollapsed?: boolean;
  badge?: React.ReactNode;
}) {
  const [col, setCol] = useState(startCollapsed);
  return (
    <div style={CS}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: col ? 0 : 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {collapsible ? (
            <button onClick={() => setCol(c => !c)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{title}</h3>
              <span style={{ fontSize: 10, color: '#334155' }}>{col ? '▼' : '▲'}</span>
            </button>
          ) : (
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{title}</h3>
          )}
          {badge}
        </div>
        {!col && (
          !editing ? (
            <button onClick={onEdit} style={EB}>Editar</button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onCancel} style={CB}>Cancelar</button>
              <button onClick={onSave} disabled={isPending} style={SB}>
                {isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          )
        )}
      </div>
      {!col && (editing ? editChildren : children)}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PersonProfileCards({ person }: { person: PersonCardData }) {
  const [editingCard, setEditingCard] = useState<
    'professional' | 'social' | 'dates' | 'notes_pro' | 'notes_soc' | 'notes_pers' | 'cycle' | null
  >(null);
  const [isPending, start] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Edit state
  const [profEdit, setProfEdit] = useState({
    role: person.role ?? '', organization: person.organization ?? '',
    location: person.location ?? '', education: person.education ?? '',
  });
  const [socialEdit, setSocialEdit] = useState({
    linkedin_url:  person.linkedin_url  ?? '',
    instagram_url: person.instagram_url ?? '',
    facebook_url:  person.facebook_url  ?? '',
    twitter_url:   person.twitter_url   ?? '',
    tiktok_url:    person.tiktok_url    ?? '',
  });
  const [activeScan, setActiveScan] = useState<string | null>(null);
  const [datesEdit, setDatesEdit] = useState({
    birthday: person.birthday ?? '', anniversary: person.anniversary ?? '',
  });
  const [notesPro,  setNotesPro]  = useState(person.notes_professional ?? '');
  const [notesSoc,  setNotesSoc]  = useState(person.notes_social       ?? '');
  const [notesPers, setNotesPers] = useState(person.notes_personal     ?? '');
  const [cycleEdit, setCycleEdit] = useState({
    last_period_start:     person.cycle_data?.last_period_start ?? '',
    cycle_notes:           person.cycle_data?.notes             ?? '',
    emotional_state:       person.emotional_state               ?? '',
    love_language:         person.love_language                 ?? '',
    relationship_patterns: person.relationship_patterns         ?? '',
  });

  // Today's symptoms from sensitive_context
  const today = new Date().toISOString().slice(0, 10);
  const storedSyms = (
    (person.sensitive_context?.['symptoms'] as Record<string, Record<string, boolean>> | undefined)
  )?.[today] ?? {};
  const [symptoms, setSymptoms] = useState<Record<string, boolean>>(storedSyms);

  // showAllWork must be before early return (React hooks rule)
  const [showAllWork, setShowAllWork] = useState(false);

  function startEdit(card: typeof editingCard) {
    if (card === 'professional') setProfEdit({ role: person.role ?? '', organization: person.organization ?? '', location: person.location ?? '', education: person.education ?? '' });
    if (card === 'social')     setSocialEdit({ linkedin_url: person.linkedin_url ?? '', instagram_url: person.instagram_url ?? '', facebook_url: person.facebook_url ?? '', twitter_url: person.twitter_url ?? '', tiktok_url: person.tiktok_url ?? '' });
    if (card === 'dates')      setDatesEdit({ birthday: person.birthday ?? '', anniversary: person.anniversary ?? '' });
    if (card === 'notes_pro')  setNotesPro(person.notes_professional ?? '');
    if (card === 'notes_soc')  setNotesSoc(person.notes_social       ?? '');
    if (card === 'notes_pers') setNotesPers(person.notes_personal     ?? '');
    if (card === 'cycle')      setCycleEdit({ last_period_start: person.cycle_data?.last_period_start ?? '', cycle_notes: person.cycle_data?.notes ?? '', emotional_state: person.emotional_state ?? '', love_language: person.love_language ?? '', relationship_patterns: person.relationship_patterns ?? '' });
    setErrMsg(null);
    setEditingCard(card);
  }

  function saveFields(fields: Record<string, string | null>) {
    start(async () => {
      const clean: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(fields)) clean[k] = v || null;
      const res = await updatePersonExtraFieldsAction(person.id, clean);
      if (res.error) { setErrMsg(res.error); return; }
      setEditingCard(null);
    });
  }

  function saveCycle() {
    start(async () => {
      const [r1, r2] = await Promise.all([
        updateCycleDataAction(person.id, {
          detected:          true,
          last_period_start: cycleEdit.last_period_start || null,
          notes:             cycleEdit.cycle_notes       || null,
        }),
        updatePersonExtraFieldsAction(person.id, {
          emotional_state:       cycleEdit.emotional_state       || null,
          love_language:         cycleEdit.love_language         || null,
          relationship_patterns: cycleEdit.relationship_patterns || null,
        }),
      ]);
      const err = r1.error ?? r2.error;
      if (err) { setErrMsg(err); return; }
      setEditingCard(null);
    });
  }

  function toggleSym(key: SymKey) {
    const next = { ...symptoms, [key]: !symptoms[key] };
    setSymptoms(next);
    const prevSyms = (person.sensitive_context?.['symptoms'] as Record<string, unknown>) ?? {};
    void updateSensitiveContextAction(person.id, { symptoms: { ...prevSyms, [today]: next } });
  }

  // Visibility
  const workEntries     = person.work_history ?? [];
  const visibleWork     = showAllWork ? workEntries : workEntries.slice(0, 2);
  const hasProfessional = !!(person.role || person.organization || person.location || person.education || workEntries.length);
  const hasSocial       = !!(person.linkedin_url || person.instagram_url || person.facebook_url || person.twitter_url || person.tiktok_url);
  const hasDates        = !!(person.birthday || person.anniversary);
  const hasNotesPro     = !!person.notes_professional;
  const hasNotesSoc     = !!person.notes_social;
  const hasNotesPers    = !!person.notes_personal;
  const isPrivate       = person.relationship_type === 'personal' || person.relationship_type === 'family';

  const cycleInfo = person.cycle_data?.last_period_start
    ? getCycleInfo(person.cycle_data.last_period_start)
    : null;

  const llLabel = LOVE_LANGS.find(l => l.v === (person.love_language ?? cycleEdit.love_language))?.l ?? null;

  // Derived display values
  const prof   = editingCard === 'professional' ? profEdit   : { role: person.role ?? '', organization: person.organization ?? '', location: person.location ?? '', education: person.education ?? '' };
  const social = editingCard === 'social' ? socialEdit : {
    linkedin_url:  person.linkedin_url  ?? '',
    instagram_url: person.instagram_url ?? '',
    facebook_url:  person.facebook_url  ?? '',
    twitter_url:   person.twitter_url   ?? '',
    tiktok_url:    person.tiktok_url    ?? '',
  };
  const dates  = editingCard === 'dates'        ? datesEdit  : { birthday: person.birthday ?? '', anniversary: person.anniversary ?? '' };

  if (!hasProfessional && !hasDates && !hasNotesPro && !hasNotesSoc && !hasNotesPers && !isPrivate) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {errMsg && <p style={{ margin: 0, fontSize: 12, color: '#f87171' }}>{errMsg}</p>}

      {/* ── 1° Contexto privado (personal/family only) ── */}
      {isPrivate && (
        <Card
          title="Contexto privado"
          editing={editingCard === 'cycle'}
          onEdit={() => startEdit('cycle')}
          onSave={saveCycle}
          onCancel={() => setEditingCard(null)}
          isPending={isPending}
          badge={
            cycleInfo ? (
              <span style={{
                fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px',
                background: cycleInfo.color + '22', color: cycleInfo.color,
                letterSpacing: '0.04em',
              }}>
                {cycleInfo.name.toUpperCase()}
              </span>
            ) : undefined
          }
          editChildren={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <TF label="Inicio del último período" value={cycleEdit.last_period_start}
                onChange={v => setCycleEdit(p => ({ ...p, last_period_start: v }))} type="date" />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={LS}>Notas del ciclo</span>
                <textarea value={cycleEdit.cycle_notes}
                  onChange={e => setCycleEdit(p => ({ ...p, cycle_notes: e.target.value }))}
                  rows={2} style={{ ...IS, resize: 'vertical' as const, fontFamily: 'inherit' }} />
              </label>
              <TF label="Estado emocional actual" value={cycleEdit.emotional_state}
                onChange={v => setCycleEdit(p => ({ ...p, emotional_state: v }))}
                placeholder="Ej: entusiasta, reservada…" />
              <SF label="Lenguaje del amor" value={cycleEdit.love_language}
                onChange={v => setCycleEdit(p => ({ ...p, love_language: v }))}
                options={LOVE_LANGS} />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={LS}>Patrones relacionales</span>
                <textarea value={cycleEdit.relationship_patterns}
                  onChange={e => setCycleEdit(p => ({ ...p, relationship_patterns: e.target.value }))}
                  rows={3} placeholder="Observaciones sobre patrones, preferencias…"
                  style={{ ...IS, resize: 'vertical' as const, fontFamily: 'inherit' }} />
              </label>
            </div>
          }
        >
          {cycleInfo ? (
            <>
              <CycleWheel day={cycleInfo.day} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 4px 0' }}>
                <div>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#e2e8f0', lineHeight: 1 }}>{cycleInfo.day}</span>
                  <span style={{ fontSize: 12, color: '#64748b', marginLeft: 6 }}>días del ciclo</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>Próximo período</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>~{cycleInfo.nextIn} días</p>
                </div>
              </div>
              {RECS[cycleInfo.name] && (
                <div style={{
                  margin: '12px 0 4px',
                  background: cycleInfo.color + '14',
                  border: `1px solid ${cycleInfo.color}30`,
                  borderRadius: 10, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 20 }}>{RECS[cycleInfo.name]!.emoji}</span>
                  <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>
                    {RECS[cycleInfo.name]!.text}
                  </span>
                </div>
              )}
            </>
          ) : (
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#475569', textAlign: 'center' }}>
              Agrega el inicio del período para activar el ciclo visual.
            </p>
          )}

          {/* Symptom quick-log */}
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: '0 0 8px', fontSize: 10, color: '#334155', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Registro rápido
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {SYMS.map(s => {
                const active = !!symptoms[s.key];
                return (
                  <button
                    key={s.key}
                    onClick={() => toggleSym(s.key)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 4, padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                      border: active ? `1.5px solid ${s.color}` : '1.5px solid #2a2d3e',
                      background: active ? s.color + '18' : '#13151f',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{s.emoji}</span>
                    <span style={{ fontSize: 10, color: active ? s.color : '#475569', fontWeight: 600 }}>
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {(person.love_language || person.emotional_state || person.relationship_patterns) && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {llLabel && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#475569', minWidth: 80 }}>Lenguaje</span>
                  <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>{llLabel}</span>
                </div>
              )}
              {person.emotional_state && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#475569', minWidth: 80 }}>Estado</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{person.emotional_state}</span>
                </div>
              )}
              {person.relationship_patterns && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 11, color: '#334155', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Patrones</span>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {person.relationship_patterns}
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── 2° Vida profesional ── */}
      {hasNotesPro && (
        <Card
          title="💼 Vida profesional"
          editing={editingCard === 'notes_pro'}
          onEdit={() => startEdit('notes_pro')}
          onSave={() => saveFields({ notes_professional: notesPro })}
          onCancel={() => setEditingCard(null)}
          isPending={isPending}
          editChildren={
            <textarea value={notesPro} onChange={e => setNotesPro(e.target.value)}
              rows={5} placeholder="Trabajo, proyectos, logros, ambiciones…"
              style={{ ...IS, resize: 'vertical' as const, fontFamily: 'inherit' }} />
          }
        >
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {person.notes_professional}
          </p>
        </Card>
      )}

      {/* ── 3° Vida social ── */}
      {hasNotesSoc && (
        <Card
          title="🌐 Vida social"
          editing={editingCard === 'notes_soc'}
          onEdit={() => startEdit('notes_soc')}
          onSave={() => saveFields({ notes_social: notesSoc })}
          onCancel={() => setEditingCard(null)}
          isPending={isPending}
          editChildren={
            <textarea value={notesSoc} onChange={e => setNotesSoc(e.target.value)}
              rows={5} placeholder="Redes sociales, intereses públicos, comunidad…"
              style={{ ...IS, resize: 'vertical' as const, fontFamily: 'inherit' }} />
          }
        >
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {person.notes_social}
          </p>
        </Card>
      )}

      {/* ── 4° Lo personal ── */}
      {hasNotesPers && (
        <Card
          title="💙 Lo personal"
          editing={editingCard === 'notes_pers'}
          onEdit={() => startEdit('notes_pers')}
          onSave={() => saveFields({ notes_personal: notesPers })}
          onCancel={() => setEditingCard(null)}
          isPending={isPending}
          editChildren={
            <textarea value={notesPers} onChange={e => setNotesPers(e.target.value)}
              rows={5} placeholder="Conversaciones privadas, estado emocional general…"
              style={{ ...IS, resize: 'vertical' as const, fontFamily: 'inherit' }} />
          }
        >
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {person.notes_personal}
          </p>
        </Card>
      )}

      {/* ── 5° Fechas importantes ── */}
      {hasDates && (
        <Card
          title="Fechas importantes"
          editing={editingCard === 'dates'}
          onEdit={() => startEdit('dates')}
          onSave={() => saveFields(datesEdit)}
          onCancel={() => setEditingCard(null)}
          isPending={isPending}
          editChildren={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <TF label="Cumpleaños"  value={datesEdit.birthday}    onChange={v => setDatesEdit(p => ({ ...p, birthday: v }))}    type="date" />
              <TF label="Aniversario" value={datesEdit.anniversary} onChange={v => setDatesEdit(p => ({ ...p, anniversary: v }))} type="date" />
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dates.birthday && (() => {
              const d = daysUntil(dates.birthday);
              return <DR icon="🎂" value={fmtES(dates.birthday)}
                {...(d <= 30 ? { badge: d === 0 ? '¡Hoy!' : `en ${d} días` } : {})} />;
            })()}
            {dates.anniversary && (() => {
              const d = daysUntil(dates.anniversary);
              return <DR icon="💑" value={fmtES(dates.anniversary)}
                {...(d <= 30 ? { badge: d === 0 ? '¡Hoy!' : `en ${d} días` } : {})} />;
            })()}
          </div>
        </Card>
      )}

      {/* ── 6° Perfil profesional (collapsed) ── */}
      {hasProfessional && (
        <Card
          title="Perfil profesional"
          collapsible
          startCollapsed
          editing={editingCard === 'professional'}
          onEdit={() => startEdit('professional')}
          onSave={() => saveFields(profEdit)}
          onCancel={() => setEditingCard(null)}
          isPending={isPending}
          editChildren={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <TF label="Cargo"     value={profEdit.role}         onChange={v => setProfEdit(p => ({ ...p, role: v }))} />
              <TF label="Empresa"   value={profEdit.organization} onChange={v => setProfEdit(p => ({ ...p, organization: v }))} />
              <TF label="Ubicación" value={profEdit.location}     onChange={v => setProfEdit(p => ({ ...p, location: v }))} />
              <TF label="Educación" value={profEdit.education}    onChange={v => setProfEdit(p => ({ ...p, education: v }))} />
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(prof.role || prof.organization) && (
              <DR icon="💼" value={[prof.role, prof.organization].filter(Boolean).join(' · ')} />
            )}
            {prof.location  && <DR icon="📍" value={prof.location} />}
            {prof.education && <DR icon="🎓" value={prof.education} />}
            {workEntries.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Experiencia
                </span>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {visibleWork.map((e, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>{e.role}</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{e.company} · {e.period}</span>
                    </div>
                  ))}
                </div>
                {workEntries.length > 2 && (
                  <button onClick={() => setShowAllWork(s => !s)}
                    style={{ marginTop: 8, background: 'none', border: 'none', color: '#818cf8', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                    {showAllWork ? 'Ocultar historial' : `Ver historial (${workEntries.length - 2} más)`}
                  </button>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── 7° Redes sociales (always visible) ── */}
      <Card
        title="Redes sociales"
        editing={editingCard === 'social'}
        onEdit={() => { startEdit('social'); setActiveScan(null); }}
        onSave={() => saveFields(socialEdit)}
        onCancel={() => { setEditingCard(null); }}
        isPending={isPending}
        editChildren={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <TF label="LinkedIn URL"  value={socialEdit.linkedin_url}  onChange={v => setSocialEdit(p => ({ ...p, linkedin_url: v }))}  type="url" placeholder="https://linkedin.com/in/username" />
            <TF label="Instagram URL" value={socialEdit.instagram_url} onChange={v => setSocialEdit(p => ({ ...p, instagram_url: v }))} type="url" placeholder="https://instagram.com/handle" />
            <TF label="Facebook URL"  value={socialEdit.facebook_url}  onChange={v => setSocialEdit(p => ({ ...p, facebook_url: v }))}  type="url" placeholder="https://facebook.com/username" />
            <TF label="Twitter/X URL" value={socialEdit.twitter_url}   onChange={v => setSocialEdit(p => ({ ...p, twitter_url: v }))}   type="url" placeholder="https://x.com/handle" />
            <TF label="TikTok URL"    value={socialEdit.tiktok_url}    onChange={v => setSocialEdit(p => ({ ...p, tiktok_url: v }))}    type="url" placeholder="https://tiktok.com/@handle" />
          </div>
        }
      >
        {hasSocial ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { url: social.linkedin_url,  icon: '💼', label: liUser, plat: 'linkedin'  },
              { url: social.instagram_url, icon: '📷', label: igUser, plat: 'instagram' },
              { url: social.facebook_url,  icon: '🌐', label: fbUser, plat: 'facebook'  },
              { url: social.twitter_url,   icon: '🐦', label: twUser, plat: 'twitter'   },
            ].filter(x => x.url).map(({ url, icon, label, plat }) => (
              <div key={plat}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DR icon={icon} value={label(url!)} href={url!} />
                  <button
                    onClick={() => {
                      if (activeScan === url) { setActiveScan(null); return; }
                      window.open(url!, '_blank');
                      setActiveScan(url!);
                    }}
                    style={{
                      marginLeft: 'auto', flexShrink: 0,
                      padding: '3px 8px', borderRadius: 6,
                      background: activeScan === url ? '#6366f122' : '#1a1d27',
                      border: `1px solid ${activeScan === url ? '#6366f144' : '#2a2d3e'}`,
                      color: activeScan === url ? '#818cf8' : '#475569',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    📸 Escanear
                  </button>
                </div>
                {activeScan === url && (
                  <ScanProfilePanel
                    personId={person.id}
                    personName={person.name}
                    url={url!}
                    onClose={() => setActiveScan(null)}
                    onSaved={() => setActiveScan(null)}
                  />
                )}
              </div>
            ))}
            {social.tiktok_url && (
              <DR icon="🎵" value={ttUser(social.tiktok_url)} href={social.tiktok_url} />
            )}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>
            Sin redes sociales guardadas. Haz clic en <strong style={{ color: '#818cf8' }}>Editar</strong> para agregar.
          </p>
        )}
      </Card>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DR({ icon, value, href, badge }: {
  icon: string; value: string; href?: string; badge?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 13, color: '#818cf8', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
          {value}
        </a>
      ) : (
        <span style={{ fontSize: 13, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
      )}
      {badge && (
        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, flexShrink: 0, color: '#fbbf24', background: '#fbbf2420', borderRadius: 6, padding: '1px 7px' }}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CS: React.CSSProperties = {
  background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 14, padding: 18,
};
const LS: React.CSSProperties = {
  fontSize: 11, color: '#64748b', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.04em',
};
const IS: React.CSSProperties = {
  background: '#13151f', border: '1px solid #2a2d3e', borderRadius: 8,
  padding: '7px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none',
  width: '100%', colorScheme: 'dark',
};
const EB: React.CSSProperties = {
  background: 'none', border: 'none', color: '#818cf8',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '2px 6px',
};
const CB: React.CSSProperties = {
  background: 'none', border: '1px solid #2a2d3e', color: '#64748b',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '3px 10px', borderRadius: 6,
};
const SB: React.CSSProperties = {
  background: '#6366f1', border: 'none', color: '#fff',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '3px 10px', borderRadius: 6,
};
