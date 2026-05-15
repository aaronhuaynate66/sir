'use client';

import { useState, useTransition } from 'react';
import { updatePersonExtraFieldsAction } from '@/app/(app)/actions';

interface Props {
  personId:     string;
  birthday:     string | null;
  anniversary:  string | null;
  instagramUrl: string | null;
  linkedinUrl:  string | null;
}

interface Fields {
  birthday:      string;
  anniversary:   string;
  instagram_url: string;
  linkedin_url:  string;
}

export default function PersonExtraFieldsEditor({
  personId,
  birthday,
  anniversary,
  instagramUrl,
  linkedinUrl,
}: Props) {
  const [editing, setEditing]    = useState(false);
  const [saved, setSaved]        = useState(false);
  const [errMsg, setErrMsg]      = useState<string | null>(null);
  const [isPending, start]       = useTransition();

  const [fields, setFields] = useState<Fields>({
    birthday:      birthday      ?? '',
    anniversary:   anniversary   ?? '',
    instagram_url: instagramUrl  ?? '',
    linkedin_url:  linkedinUrl   ?? '',
  });

  function handleSave() {
    setErrMsg(null);
    start(async () => {
      const res = await updatePersonExtraFieldsAction(personId, {
        birthday:      fields.birthday      || null,
        anniversary:   fields.anniversary   || null,
        instagram_url: fields.instagram_url || null,
        linkedin_url:  fields.linkedin_url  || null,
      });
      if (res.error) {
        setErrMsg(res.error);
      } else {
        setSaved(true);
        setEditing(false);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  const hasAny = birthday || anniversary || instagramUrl || linkedinUrl;

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editing ? 16 : 0 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>Datos adicionales</h3>
        <button
          onClick={() => { setEditing(e => !e); setSaved(false); setErrMsg(null); }}
          style={{
            background: 'none', border: 'none', color: '#818cf8',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '2px 6px',
          }}
        >
          {editing ? 'Cancelar' : 'Editar'}
        </button>
      </div>

      {!editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: hasAny ? 12 : 0 }}>
          {!hasAny && (
            <p style={{ margin: 0, fontSize: 13, color: '#334155' }}>
              Sin datos adicionales. Pulsa Editar o analiza un screenshot.
            </p>
          )}
          {birthday && (
            <Row icon="🎂" label="Cumpleaños" value={
              new Date(birthday + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
            } />
          )}
          {anniversary && (
            <Row icon="💑" label="Aniversario" value={
              new Date(anniversary + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
            } />
          )}
          {instagramUrl && (
            <Row icon="📷" label="Instagram" value={instagramUrl} href={instagramUrl} />
          )}
          {linkedinUrl && (
            <Row icon="💼" label="LinkedIn" value={linkedinUrl} href={linkedinUrl} />
          )}
        </div>
      )}

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field
            label="Cumpleaños" type="date"
            value={fields.birthday}
            onChange={v => setFields(f => ({ ...f, birthday: v }))}
          />
          <Field
            label="Aniversario" type="date"
            value={fields.anniversary}
            onChange={v => setFields(f => ({ ...f, anniversary: v }))}
          />
          <Field
            label="Instagram URL" type="url"
            value={fields.instagram_url}
            onChange={v => setFields(f => ({ ...f, instagram_url: v }))}
            placeholder="https://instagram.com/handle"
          />
          <Field
            label="LinkedIn URL" type="url"
            value={fields.linkedin_url}
            onChange={v => setFields(f => ({ ...f, linkedin_url: v }))}
            placeholder="https://linkedin.com/in/username"
          />
          {errMsg && <p style={{ margin: 0, fontSize: 12, color: '#f87171' }}>{errMsg}</p>}
          <button
            onClick={handleSave}
            disabled={isPending}
            style={{
              padding: '8px 0', borderRadius: 8, border: 'none',
              background: '#6366f1', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: isPending ? 'wait' : 'pointer',
            }}
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      )}

      {saved && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#34d399' }}>✓ Guardado</p>
      )}
    </div>
  );
}

function Row({ icon, label, value, href }: { icon: string; label: string; value: string; href?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 12, color: '#475569', minWidth: 80 }}>{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 13, color: '#818cf8', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
          {value}
        </a>
      ) : (
        <span style={{ fontSize: 13, color: '#94a3b8' }}>{value}</span>
      )}
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{
          background: '#13151f', border: '1px solid #2a2d3e', borderRadius: 8,
          padding: '7px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', width: '100%',
          colorScheme: 'dark',
        }}
      />
    </label>
  );
}

const card: React.CSSProperties = {
  background:   '#1a1d27',
  border:       '1px solid #2a2d3e',
  borderRadius: 14,
  padding:      18,
};
