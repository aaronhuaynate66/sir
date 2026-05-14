export const metadata = {
  title: 'SIR Admin',
  description: 'Panel de administración del Sistema de Inteligencia Relacional',
};

const NAV_LINKS = [
  { href: '/',         label: 'Dashboard' },
  { href: '/users',    label: 'Usuarios'  },
  { href: '/memories', label: 'Memorias'  },
  { href: '/signals',  label: 'Señales'   },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f3f4f6' }}>
        <nav style={{
          background: '#1e1b4b', color: '#fff',
          padding: '0 24px', display: 'flex', alignItems: 'center',
          gap: 0, height: 52, position: 'sticky', top: 0, zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,.25)',
        }}>
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.5px', marginRight: 32 }}>
            SIR <span style={{ opacity: 0.4, fontWeight: 400 }}>admin</span>
          </span>
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              style={{
                color: '#c7d2fe', textDecoration: 'none', fontSize: 14,
                fontWeight: 500, padding: '0 16px', height: 52,
                display: 'flex', alignItems: 'center',
                borderBottom: '2px solid transparent',
              }}
            >
              {label}
            </a>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: '#818cf8', opacity: 0.8 }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </nav>
        <main style={{ padding: 28, maxWidth: 1200, margin: '0 auto' }}>{children}</main>
      </body>
    </html>
  );
}
