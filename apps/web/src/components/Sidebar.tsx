'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import SearchModal from './SearchModal';

interface NavItem {
  href:  string;
  label: string;
  icon:  string;
  badge?: number;
  pro?:  boolean;
}

function buildNav(unreadCount: number): NavItem[] {
  return [
    { href: '/inicio',        label: 'Inicio',    icon: '⊞' },
    { href: '/red',           label: 'Red',       icon: '◎' },
    { href: '/grafo',         label: 'Grafo',     icon: '◯' },
    { href: '/senales',       label: 'Señales',   icon: '◆' },
    { href: '/memorias',      label: 'Memorias',  icon: '◈' },
    { href: '/estado',        label: 'Estado',    icon: '◉' },
    { href: '/executive',     label: 'Executive', icon: '◈', pro: true },
    { href: '/rituales',         label: 'Rituales',      icon: '🔔' },
    { href: '/notifications',    label: 'Alertas',       icon: '🔕', ...(unreadCount > 0 ? { badge: unreadCount } : {}) },
    { href: '/config/integraciones', label: 'Integraciones', icon: '🔗' },
    { href: '/config',               label: 'Config',        icon: '⚙' },
  ];
}

export default function Sidebar({
  userEmail,
  unreadCount = 0,
}: {
  userEmail: string;
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const NAV = buildNav(unreadCount);
  const [searchOpen, setSearchOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(s => !s);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <SearchModal open={searchOpen} onClose={closeSearch} />

      <aside style={{
        width: 220,
        background: '#1a1d27',
        borderRight: '1px solid #2a2d3e',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 0',
        flexShrink: 0,
      }}>
        <div style={{ padding: '0 20px 16px', borderBottom: '1px solid #2a2d3e' }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: 14 }}>SIR</span>

          {/* Search trigger */}
          <button
            onClick={openSearch}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '7px 10px',
              background: '#13151f', border: '1px solid #2a2d3e',
              borderRadius: 8, cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 13, color: '#475569' }}>🔍</span>
            <span style={{ flex: 1, fontSize: 13, color: '#475569' }}>Buscar…</span>
            <kbd style={{ fontSize: 10, color: '#334155', background: '#2a2d3e', borderRadius: 4, padding: '1px 5px', fontFamily: 'inherit' }}>
              ⌘K
            </kbd>
          </button>
        </div>

        <nav style={{ flex: 1, padding: '16px 12px' }}>
          {NAV.map(({ href, label, icon, badge, pro }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                marginBottom: 4,
                color: active ? '#818cf8' : '#94a3b8',
                background: active ? '#2a2d3e' : 'transparent',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ flex: 1 }}>{label}</span>
                {pro && (
                  <span style={{ fontSize: 9, fontWeight: 700, background: '#6366f133', color: '#818cf8', borderRadius: 4, padding: '1px 5px' }}>
                    PRO
                  </span>
                )}
                {badge !== undefined && badge > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    background: '#818cf8', color: '#fff',
                    borderRadius: 10, padding: '1px 6px',
                    minWidth: 18, textAlign: 'center' as const,
                  }}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid #2a2d3e' }}>
          <p style={{
            fontSize: 12, color: '#475569', marginBottom: 10,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {userEmail}
          </p>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '8px',
            background: 'transparent', border: '1px solid #2a2d3e',
            borderRadius: 6, color: '#94a3b8', fontSize: 13, cursor: 'pointer',
          }}>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
