'use client';

import { useState, useTransition } from 'react';
import { updateNotificationPrefs, type NotificationPrefs } from './actions';

const TIMEZONES = [
  'UTC', 'America/Lima', 'America/Bogota', 'America/Santiago',
  'America/Buenos_Aires', 'America/Mexico_City', 'America/New_York',
  'America/Los_Angeles', 'Europe/Madrid', 'Europe/London',
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function SettingsForm({ initial }: { initial: NotificationPrefs }) {
  const [form, setForm] = useState<NotificationPrefs>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof NotificationPrefs>(key: K, val: NotificationPrefs[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      try {
        await updateNotificationPrefs(form);
        setSaved(true);
      } catch (err) {
        setError(String(err));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>

      {/* Channels */}
      <Section title="Canales">
        <Toggle
          label="Notificaciones push (móvil)"
          checked={form.push_enabled}
          onChange={v => set('push_enabled', v)}
        />
        <Toggle
          label="Correo electrónico"
          checked={form.email_enabled}
          onChange={v => set('email_enabled', v)}
        />
      </Section>

      {/* DND */}
      <Section title="Horario silencioso (DND)">
        <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 12px' }}>
          Sin notificaciones en este rango horario
        </p>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <label style={labelStyle}>
            Desde
            <select
              value={form.dnd_start_hour}
              onChange={e => set('dnd_start_hour', parseInt(e.target.value, 10))}
              style={selectStyle}
            >
              {HOURS.map(h => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Hasta
            <select
              value={form.dnd_end_hour}
              onChange={e => set('dnd_end_hour', parseInt(e.target.value, 10))}
              style={selectStyle}
            >
              {HOURS.map(h => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
              ))}
            </select>
          </label>
        </div>
      </Section>

      {/* Frequency */}
      <Section title="Frecuencia máxima">
        <label style={labelStyle}>
          Máximo por día
          <select
            value={form.max_notifs_per_day}
            onChange={e => set('max_notifs_per_day', parseInt(e.target.value, 10))}
            style={selectStyle}
          >
            {[1, 2, 3, 5, 10].map(n => (
              <option key={n} value={n}>{n} notificaciones/día</option>
            ))}
          </select>
        </label>
      </Section>

      {/* Timezone */}
      <Section title="Zona horaria">
        <label style={labelStyle}>
          Tu zona horaria
          <select
            value={form.timezone}
            onChange={e => set('timezone', e.target.value)}
            style={selectStyle}
          >
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </label>
      </Section>

      {error && (
        <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" disabled={isPending} style={{
          padding: '10px 24px',
          background: '#818cf8',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: isPending ? 'not-allowed' : 'pointer',
          opacity: isPending ? 0.7 : 1,
        }}>
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {saved && <span style={{ color: '#34d399', fontSize: 13 }}>✓ Guardado</span>}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: '#818cf8',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0', borderBottom: '1px solid #1a1d27' }}>
      <span style={{ fontSize: 14, color: '#cbd5e1' }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12,
          background: checked ? '#818cf8' : '#2a2d3e',
          border: 'none', cursor: 'pointer', position: 'relative',
          transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 3,
          left: checked ? 23 : 3,
          width: 18, height: 18,
          background: '#fff', borderRadius: '50%',
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6,
  fontSize: 14, color: '#94a3b8',
};

const selectStyle: React.CSSProperties = {
  padding: '8px 12px', background: '#1a1d27',
  border: '1px solid #2a2d3e', borderRadius: 6,
  color: '#e2e8f0', fontSize: 14,
};
