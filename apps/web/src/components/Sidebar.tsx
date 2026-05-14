'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/people',    label: 'Personas',  icon: '◎' },
  { href: '/memories',  label: 'Memorias',  icon: '◈' },
  { href: '/state',     label: 'Estado',    icon: '◉' },
];

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside style={{
      width: 220,
      background: '#1a1d27',
      borderRight: '1px solid #2a2d3e',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 0',
      flexShrink: 0,
    }}>
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #2a2d3e' }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>SIR</span>
      </div>

      <nav style={{ flex: 1, padding: '16px 12px' }}>
        {NAV.map(({ href, label, icon }) => {
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
              {label}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '16px 20px', borderTop: '1px solid #2a2d3e' }}>
        <p style={{ fontSize: 12, color: '#475569', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {userEmail}
        </p>
        <button onClick={handleLogout} style={{
          width: '100%',
          padding: '8px',
          background: 'transparent',
          border: '1px solid #2a2d3e',
          borderRadius: 6,
          color: '#94a3b8',
          fontSize: 13,
          cursor: 'pointer',
        }}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
