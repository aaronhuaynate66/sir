'use client';

import { useState, useTransition } from 'react';
import type { DbNotificationLog } from '@sir/db';

const TYPE_LABELS: Record<string, string> = {
  birthday_reminder:    '🎂 Cumpleaños',
  reconnect_suggestion: '🔗 Reconectar',
  signal_opportunity:   '⚡ Oportunidad',
  weekly_digest:        '📊 Digest Semanal',
  briefing_ready:       '📋 Briefing',
};

const TYPE_COLORS: Record<string, string> = {
  birthday_reminder:    '#f472b6',
  reconnect_suggestion: '#818cf8',
  signal_opportunity:   '#34d399',
  weekly_digest:        '#fbbf24',
  briefing_ready:       '#60a5fa',
};

interface Props {
  initialLogs: DbNotificationLog[];
}

export default function NotificationList({ initialLogs }: Props) {
  const [logs, setLogs] = useState(initialLogs);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [, startTransition] = useTransition();

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    startTransition(() => {
      setLogs(prev =>
        prev.map(l => l.id === id ? { ...l, status: 'read' as const, read_at: new Date().toISOString() } : l)
      );
    });
  }

  async function markAllRead() {
    const unread = logs.filter(l => l.status !== 'read');
    await Promise.all(unread.map(l => fetch(`/api/notifications/${l.id}/read`, { method: 'PATCH' })));
    startTransition(() => {
      setLogs(prev => prev.map(l => ({ ...l, status: 'read' as const, read_at: new Date().toISOString() })));
    });
  }

  const visible = filter === 'unread' ? logs.filter(l => l.status !== 'read') : logs;
  const unreadCount = logs.filter(l => l.status !== 'read').length;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['all', 'unread'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: filter === f ? '#818cf8' : '#2a2d3e',
                background: filter === f ? '#1e2035' : 'transparent',
                color: filter === f ? '#818cf8' : '#64748b',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {f === 'all' ? 'Todas' : `No leídas (${unreadCount})`}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            style={{
              marginLeft: 'auto',
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid #2a2d3e',
              background: 'transparent',
              color: '#64748b',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
          <p style={{ fontSize: 15 }}>Sin notificaciones</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map(log => (
            <NotificationCard key={log.id} log={log} onMarkRead={markRead} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationCard({
  log,
  onMarkRead,
}: {
  log: DbNotificationLog;
  onMarkRead: (id: string) => void;
}) {
  const isUnread = log.status !== 'read';
  const color = TYPE_COLORS[log.type] ?? '#64748b';
  const label = TYPE_LABELS[log.type] ?? log.type;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        padding: '16px 20px',
        background: isUnread ? '#16192a' : '#0f1117',
        border: '1px solid',
        borderColor: isUnread ? '#2a2d3e' : '#1a1d27',
        borderLeft: `3px solid ${isUnread ? color : '#2a2d3e'}`,
        borderRadius: 8,
        cursor: isUnread ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
      onClick={() => { if (isUnread) onMarkRead(log.id); }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, color,
            background: `${color}18`, padding: '2px 8px',
            borderRadius: 4, textTransform: 'uppercase' as const,
          }}>
            {label}
          </span>
          <span style={{ fontSize: 11, color: '#475569', marginLeft: 'auto' }}>
            {new Date(log.created_at).toLocaleDateString('es-ES', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: isUnread ? 600 : 400, color: isUnread ? '#e2e8f0' : '#94a3b8' }}>
          {log.title}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>{log.body}</p>
      </div>
      {isUnread && (
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: color, flexShrink: 0, marginTop: 4,
        }} />
      )}
    </div>
  );
}
