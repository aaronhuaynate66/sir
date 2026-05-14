'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createPersonAction } from '../actions';

export default function NewPersonButton() {
  const [open, setOpen]     = useState(false);
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);
  const router              = useRouter();
  const formRef             = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    setSaving(true);
    setError('');
    const result = await createPersonAction(new FormData(formRef.current));
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setOpen(false);
      formRef.current.reset();
      router.refresh();
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={btnStyle}>
        + Nueva persona
      </button>

      {open && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div style={modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#e2e8f0' }}>Nueva persona</h3>
              <button onClick={() => setOpen(false)} style={closeBtn}>✕</button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit}>
              <Field label="Nombre *" name="name" placeholder="Juan García" required />
              <Field label="Organización" name="organization" placeholder="Empresa S.A." />
              <Field label="Rol / Cargo" name="role" placeholder="CTO" />
              <Field label="Email" name="email" type="email" placeholder="juan@empresa.com" />
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Notas</label>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Contexto, cómo se conocieron…"
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
                />
              </div>

              {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}

              <button type="submit" disabled={saving} style={submitBtn(saving)}>
                {saving ? 'Creando…' : 'Crear persona'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label, name, placeholder, required, type = 'text',
}: { label: string; name: string; placeholder?: string; required?: boolean; type?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      <input name={name} type={type} placeholder={placeholder} required={required} style={inputStyle} />
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '9px 18px',
  background: '#6366f1',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.65)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 50, padding: 20,
};
const modal: React.CSSProperties = {
  background: '#1a1d27',
  border: '1px solid #2a2d3e',
  borderRadius: 16,
  padding: 28,
  width: '100%',
  maxWidth: 460,
};
const closeBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18,
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 5, fontWeight: 500,
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '9px 12px',
  background: '#0f1117',
  border: '1px solid #2a2d3e',
  borderRadius: 7,
  color: '#e2e8f0',
  fontSize: 14,
  outline: 'none',
};
const submitBtn = (disabled: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '10px',
  background: disabled ? '#3730a3' : '#6366f1',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.7 : 1,
  marginTop: 4,
});
