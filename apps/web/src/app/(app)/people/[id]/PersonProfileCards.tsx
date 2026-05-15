'use client';

import { useState, useTransition } from 'react';
import { updatePersonExtraFieldsAction, updateCycleDataAction } from '@/app/(app)/actions';
import type { WorkHistoryEntry, CycleData } from '@sir/db';

export interface PersonCardData {
  id:            string;
  role:          string | null;
  organization:  string | null;
  location:      string | null;
  education:     string | null;
  linkedin_url:  string | null;
  instagram_url: string | null;
  birthday:      string | null;
  anniversary:   string | null;
  notes:         string | null;
  work_history:  WorkHistoryEntry[] | null;
  cycle_data:    CycleData | null;
  sensitive_context: Record<string, unknown> | null;
  relationship_type: string;
}

interface Props {
  person: PersonCardData;
}

type CardKey = 'professional' | 'social' | 'dates' | 'notes' | 'cycle';

// ─── Cycle phase helper ───────────────────────────────────────────────────────

interface CyclePhase {
  name:           string;
  days:           string;
  recommendation: string;
  color:          string;
}

function getCyclePhase(lastPeriodStart: string): CyclePhase & { dayOfCycle: number } {
  const start = new Date(lastPeriodStart + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfCycle = Math.floor((today.getTime() - start.getTime()) / 86_400_000) % 28 + 1;

  let phase: CyclePhase;
  if (dayOfCycle <= 5) {
    phase = { name: 'Menstrual', days: '1–5', recommendation: 'Momentos de calma y cuidado.', color: '#f87171' };
  } else if (dayOfCycle <= 13) {
    phase = { name: 'Folicular', days: '6–13', recommendation: 'Alta energía y apertura.', color: '#34d399' };
  } else if (dayOfCycle === 14) {
    phase = { name: 'Ovulación', days: '14', recommendation: 'Comunicación fluida.', color: '#fbbf24' };
  } else {
    phase = { name: 'Lútea', days: '15–28', recommendation: 'Prefiere estabilidad.', color: '#818cf8' };
  }
  return { ...phase, dayOfCycle };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const now = new Date();
  const d = new Date(dateStr + 'T00:00:00');
  let next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (next.getTime() < Date.now() - 86_400_000) {
    next = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate());
  }
  return Math.ceil((next.getTime() - Date.now()) / 86_400_000);
}

function formatDateES(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long',
  });
}

function igUsername(url: string): string {
  const m = url.match(/instagram\.com\/([^/?#]+)/);
  return m ? `@${m[1]}` : url;
}

function liUsername(url: string): string {
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/);
  return m?.[1] ?? url;
}

// ─── Edit-mode field components ───────────────────────────────────────────────

function TextField({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={labelStyle}>{label}</span>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({
  title, editing, onEdit, onSave, onCancel, isPending, children, editChildren,
}: {
  title: string;
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
  children: React.ReactNode;
  editChildren: React.ReactNode;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{title}</h3>
        {!editing ? (
          <button onClick={onEdit} style={editBtn}>Editar</button>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCancel} style={cancelBtn}>Cancelar</button>
            <button onClick={onSave} disabled={isPending} style={saveBtn}>
              {isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        )}
      </div>
      {editing ? editChildren : children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PersonProfileCards({ person }: Props) {
  const [editingCard, setEditingCard] = useState<CardKey | null>(null);
  const [isPending, start] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Local edit state per card
  const [profEdit, setProfEdit] = useState({
    role:         person.role          ?? '',
    organization: person.organization  ?? '',
    location:     person.location      ?? '',
    education:    person.education     ?? '',
  });
  const [socialEdit, setSocialEdit] = useState({
    linkedin_url:  person.linkedin_url  ?? '',
    instagram_url: person.instagram_url ?? '',
  });
  const [datesEdit, setDatesEdit] = useState({
    birthday:    person.birthday    ?? '',
    anniversary: person.anniversary ?? '',
  });
  const [notesEdit, setNotesEdit] = useState(person.notes ?? '');
  const [cycleEdit, setCycleEdit] = useState({
    last_period_start: person.cycle_data?.last_period_start ?? '',
    notes:             person.cycle_data?.notes             ?? '',
  });

  // Derive current values from edit state when editing, otherwise from person
  const prof   = editingCard === 'professional' ? profEdit   : { role: person.role ?? '', organization: person.organization ?? '', location: person.location ?? '', education: person.education ?? '' };
  const social = editingCard === 'social'       ? socialEdit : { linkedin_url: person.linkedin_url ?? '', instagram_url: person.instagram_url ?? '' };
  const dates  = editingCard === 'dates'        ? datesEdit  : { birthday: person.birthday ?? '', anniversary: person.anniversary ?? '' };
  const notes  = editingCard === 'notes'        ? notesEdit  : (person.notes ?? '');

  function startEdit(card: CardKey) {
    // Reset local edit state to current person values
    if (card === 'professional') setProfEdit({ role: person.role ?? '', organization: person.organization ?? '', location: person.location ?? '', education: person.education ?? '' });
    if (card === 'social')       setSocialEdit({ linkedin_url: person.linkedin_url ?? '', instagram_url: person.instagram_url ?? '' });
    if (card === 'dates')        setDatesEdit({ birthday: person.birthday ?? '', anniversary: person.anniversary ?? '' });
    if (card === 'notes')        setNotesEdit(person.notes ?? '');
    if (card === 'cycle')        setCycleEdit({ last_period_start: person.cycle_data?.last_period_start ?? '', notes: person.cycle_data?.notes ?? '' });
    setErrMsg(null);
    setEditingCard(card);
  }

  function save(card: CardKey, fields: Record<string, string | null>) {
    start(async () => {
      // convert empty strings to null
      const clean: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(fields)) clean[k] = v || null;
      const res = await updatePersonExtraFieldsAction(person.id, clean);
      if (res.error) { setErrMsg(res.error); return; }
      setEditingCard(null);
    });
  }

  // Visibility checks
  const workEntries     = person.work_history ?? [];
  const hasProfessional = !!(person.role || person.organization || person.location || person.education || workEntries.length > 0);
  const hasSocial       = !!(person.linkedin_url || person.instagram_url);
  const hasDates        = !!(person.birthday || person.anniversary);
  const hasNotes        = !!person.notes;
  const isPersonalOrFamily = person.relationship_type === 'personal' || person.relationship_type === 'family';
  const hasCycle        = isPersonalOrFamily && !!person.cycle_data;

  const daysBirthday    = person.birthday    ? daysUntil(person.birthday)    : null;
  const daysAnniversary = person.anniversary ? daysUntil(person.anniversary) : null;

  const cyclePhase = (hasCycle && person.cycle_data?.last_period_start)
    ? getCyclePhase(person.cycle_data.last_period_start)
    : null;

  const [showAllWork, setShowAllWork] = useState(false);
  const visibleWork = showAllWork ? workEntries : workEntries.slice(0, 2);

  if (!hasProfessional && !hasSocial && !hasDates && !hasNotes && !hasCycle) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {errMsg && (
        <p style={{ margin: 0, fontSize: 12, color: '#f87171' }}>{errMsg}</p>
      )}

      {/* ── Perfil profesional ── */}
      {hasProfessional && (
        <Card
          title="Perfil profesional"
          editing={editingCard === 'professional'}
          onEdit={() => startEdit('professional')}
          onSave={() => save('professional', profEdit)}
          onCancel={() => setEditingCard(null)}
          isPending={isPending}
          editChildren={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <TextField label="Cargo"    value={profEdit.role}         onChange={v => setProfEdit(p => ({ ...p, role: v }))} />
              <TextField label="Empresa"  value={profEdit.organization} onChange={v => setProfEdit(p => ({ ...p, organization: v }))} />
              <TextField label="Ubicación" value={profEdit.location}    onChange={v => setProfEdit(p => ({ ...p, location: v }))} />
              <TextField label="Educación" value={profEdit.education}   onChange={v => setProfEdit(p => ({ ...p, education: v }))} />
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(prof.role || prof.organization) && (
              <DataRow icon="💼" value={[prof.role, prof.organization].filter(Boolean).join(' · ')} />
            )}
            {prof.location && <DataRow icon="📍" value={prof.location} />}
            {prof.education && <DataRow icon="🎓" value={prof.education} />}
            {workEntries.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Experiencia
                </span>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {visibleWork.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>{entry.role}</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{entry.company} · {entry.period}</span>
                    </div>
                  ))}
                </div>
                {workEntries.length > 2 && (
                  <button
                    onClick={() => setShowAllWork(s => !s)}
                    style={{ marginTop: 8, background: 'none', border: 'none', color: '#818cf8', fontSize: 12, cursor: 'pointer', padding: 0 }}
                  >
                    {showAllWork ? 'Ocultar historial' : `Ver historial laboral (${workEntries.length - 2} más)`}
                  </button>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Redes sociales ── */}
      {hasSocial && (
        <Card
          title="Redes sociales"
          editing={editingCard === 'social'}
          onEdit={() => startEdit('social')}
          onSave={() => save('social', socialEdit)}
          onCancel={() => setEditingCard(null)}
          isPending={isPending}
          editChildren={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <TextField label="LinkedIn URL"  value={socialEdit.linkedin_url}  onChange={v => setSocialEdit(p => ({ ...p, linkedin_url: v }))}  type="url" placeholder="https://linkedin.com/in/username" />
              <TextField label="Instagram URL" value={socialEdit.instagram_url} onChange={v => setSocialEdit(p => ({ ...p, instagram_url: v }))} type="url" placeholder="https://instagram.com/handle" />
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {social.linkedin_url && (
              <DataRow
                icon="💼"
                value={liUsername(social.linkedin_url)}
                href={social.linkedin_url}
              />
            )}
            {social.instagram_url && (
              <DataRow
                icon="📷"
                value={igUsername(social.instagram_url)}
                href={social.instagram_url}
              />
            )}
          </div>
        </Card>
      )}

      {/* ── Fechas importantes ── */}
      {hasDates && (
        <Card
          title="Fechas importantes"
          editing={editingCard === 'dates'}
          onEdit={() => startEdit('dates')}
          onSave={() => save('dates', datesEdit)}
          onCancel={() => setEditingCard(null)}
          isPending={isPending}
          editChildren={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <TextField label="Cumpleaños"  value={datesEdit.birthday}    onChange={v => setDatesEdit(p => ({ ...p, birthday: v }))}    type="date" />
              <TextField label="Aniversario" value={datesEdit.anniversary} onChange={v => setDatesEdit(p => ({ ...p, anniversary: v }))} type="date" />
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dates.birthday && (
              <DataRow
                icon="🎂"
                value={formatDateES(dates.birthday)}
                {...(daysBirthday !== null && daysBirthday <= 30
                  ? { badge: daysBirthday === 0 ? '¡Hoy!' : `en ${daysBirthday} días` }
                  : {})}
              />
            )}
            {dates.anniversary && (
              <DataRow
                icon="💑"
                value={formatDateES(dates.anniversary)}
                {...(daysAnniversary !== null && daysAnniversary <= 30
                  ? { badge: daysAnniversary === 0 ? '¡Hoy!' : `en ${daysAnniversary} días` }
                  : {})}
              />
            )}
          </div>
        </Card>
      )}

      {/* ── Notas personales ── */}
      {hasNotes && (
        <Card
          title="Notas personales"
          editing={editingCard === 'notes'}
          onEdit={() => startEdit('notes')}
          onSave={() => save('notes', { notes: notesEdit })}
          onCancel={() => setEditingCard(null)}
          isPending={isPending}
          editChildren={
            <textarea
              value={notesEdit}
              onChange={e => setNotesEdit(e.target.value)}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          }
        >
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {notes}
          </p>
        </Card>
      )}

      {/* ── Contexto privado (cycle data) ── */}
      {hasCycle && (
        <Card
          title="Contexto privado"
          editing={editingCard === 'cycle'}
          onEdit={() => startEdit('cycle')}
          onSave={() => {
            start(async () => {
              const res = await updateCycleDataAction(person.id, {
                detected:          true,
                last_period_start: cycleEdit.last_period_start || null,
                notes:             cycleEdit.notes             || null,
              });
              if (res.error) { setErrMsg(res.error); return; }
              setEditingCard(null);
            });
          }}
          onCancel={() => setEditingCard(null)}
          isPending={isPending}
          editChildren={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <TextField
                label="Inicio del último período"
                value={cycleEdit.last_period_start}
                onChange={v => setCycleEdit(p => ({ ...p, last_period_start: v }))}
                type="date"
              />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={labelStyle}>Notas</span>
                <textarea
                  value={cycleEdit.notes}
                  onChange={e => setCycleEdit(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </label>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cyclePhase && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                    color: cyclePhase.color,
                    background: cyclePhase.color + '22',
                    borderRadius: 6, padding: '2px 8px', textTransform: 'uppercase',
                  }}>
                    Fase {cyclePhase.name}
                  </span>
                  <span style={{ fontSize: 11, color: '#475569' }}>
                    Día {cyclePhase.dayOfCycle} · días {cyclePhase.days}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                  {cyclePhase.recommendation}
                </p>
              </div>
            )}
            {person.cycle_data?.last_period_start && !cyclePhase && (
              <DataRow icon="📅" value={`Inicio: ${formatDateES(person.cycle_data.last_period_start)}`} />
            )}
            {person.cycle_data?.notes && (
              <p style={{ margin: 0, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                {person.cycle_data.notes}
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DataRow({ icon, value, href, badge }: {
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
        <span style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 600, flexShrink: 0,
          color: '#fbbf24', background: '#fbbf2420', borderRadius: 6, padding: '1px 7px',
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 14, padding: 18,
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#64748b', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.04em',
};
const inputStyle: React.CSSProperties = {
  background: '#13151f', border: '1px solid #2a2d3e', borderRadius: 8,
  padding: '7px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none',
  width: '100%', colorScheme: 'dark',
};
const editBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#818cf8',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '2px 6px',
};
const cancelBtn: React.CSSProperties = {
  background: 'none', border: '1px solid #2a2d3e', color: '#64748b',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '3px 10px', borderRadius: 6,
};
const saveBtn: React.CSSProperties = {
  background: '#6366f1', border: 'none', color: '#fff',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '3px 10px', borderRadius: 6,
};
