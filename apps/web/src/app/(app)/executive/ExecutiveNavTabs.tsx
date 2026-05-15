'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/executive',              label: 'Vista General'  },
  { href: '/executive/stakeholders', label: '◎ Stakeholders' },
  { href: '/executive/pipeline',     label: '⬛ Pipeline'    },
  { href: '/executive/capital',      label: '◆ Capital'      },
  { href: '/executive/reporte',      label: '◉ Reporte'      },
];

export default function ExecutiveNavTabs() {
  const pathname = usePathname();
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderBottom: '1px solid #2a2d3e', overflowX: 'auto' }}>
      {TABS.map(tab => {
        const isActive = tab.href === '/executive'
          ? pathname === '/executive'
          : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} style={{
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: isActive ? 600 : 400,
            color: isActive ? '#818cf8' : '#64748b',
            textDecoration: 'none',
            borderBottom: `2px solid ${isActive ? '#818cf8' : 'transparent'}`,
            marginBottom: -1,
            whiteSpace: 'nowrap' as const,
            flexShrink: 0,
            display: 'block',
          }}>
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
