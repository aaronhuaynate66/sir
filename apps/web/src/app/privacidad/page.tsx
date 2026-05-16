import Link from 'next/link';

export const metadata = { title: 'Privacidad — SIR' };

export default function PrivacidadPage() {
  return (
    <div style={{ background: '#0f1117', color: '#e2e8f0', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 48px', borderBottom: '1px solid #1a1d27' }}>
        <Link href="/" style={{ fontSize: 22, fontWeight: 800, color: '#818cf8', letterSpacing: '-0.5px', textDecoration: 'none' }}>SIR</Link>
        <div style={{ display: 'flex', gap: 16 }}>
          <Link href="/login"  style={navLink}>Iniciar sesión</Link>
          <Link href="/signup" style={ctaSmall}>Empezar gratis →</Link>
        </div>
      </nav>

      {/* Content */}
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '64px 48px 96px' }}>
        <h1 style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-1px', margin: '0 0 8px' }}>Política de Privacidad</h1>
        <p style={{ color: '#475569', fontSize: 14, margin: '0 0 48px' }}>Última actualización: mayo 2026</p>

        <Section title="1. Qué datos recopilamos">
          <p>SIR recopila únicamente los datos que tú introduces de forma explícita:</p>
          <ul>
            <li><strong>Datos de cuenta:</strong> correo electrónico y contraseña (cifrada por Supabase Auth).</li>
            <li><strong>Datos de contactos:</strong> nombre, empresa, cargo, notas y cualquier información que añadas sobre las personas de tu red.</li>
            <li><strong>Señales y memorias:</strong> los registros de interacciones, estados emocionales y eventos que tú ingresas manualmente o cargas vía screenshot.</li>
            <li><strong>Estado personal:</strong> registros de estado de ánimo y energía que tú introduces.</li>
            <li><strong>Datos de uso:</strong> eventos de navegación anónimos para mejorar el producto (sin identificadores personales en Google Analytics).</li>
          </ul>
          <p>No rastreamos tu ubicación, no accedemos a tus contactos del dispositivo ni leemos tus conversaciones sin que tú las cargues explícitamente.</p>
        </Section>

        <Section title="2. Cómo usamos tus datos">
          <ul>
            <li><strong>Prestación del servicio:</strong> para generar briefings, detectar señales y mostrarte el grafo de relaciones.</li>
            <li><strong>IA (Claude de Anthropic / Ollama local):</strong> el contenido que generas puede ser enviado a la API de Claude para producir briefings. Anthropic no usa estos datos para entrenar modelos (zero data retention).</li>
            <li><strong>Mejora del producto:</strong> métricas de uso agregadas (DAU, eventos por función).</li>
          </ul>
          <p>Nunca vendemos tus datos a terceros.</p>
        </Section>

        <Section title="3. Almacenamiento y seguridad">
          <p>Tus datos se almacenan en <strong>Supabase</strong> (PostgreSQL cifrado en reposo) con políticas de Row-Level Security (RLS) que garantizan que solo tú puedes acceder a tu información. La comunicación usa HTTPS/TLS en todo momento.</p>
        </Section>

        <Section title="4. Tus derechos (RGPD / GDPR)">
          <ul>
            <li><strong>Acceso y exportación:</strong> puedes descargar todos tus datos en formato JSON desde <Link href="/settings/privacy" style={inlineLink}>Configuración → Privacidad</Link>.</li>
            <li><strong>Eliminación:</strong> puedes borrar tu cuenta y todos tus datos de forma permanente e inmediata desde la misma sección.</li>
            <li><strong>Rectificación:</strong> puedes editar o eliminar cualquier dato en cualquier momento desde la aplicación.</li>
            <li><strong>Portabilidad:</strong> la exportación incluye todas tus personas, memorias, señales e interacciones en formato estándar JSON.</li>
          </ul>
        </Section>

        <Section title="5. Cookies">
          <p>SIR usa únicamente cookies de sesión de autenticación (gestionadas por Supabase) y no utiliza cookies de seguimiento o publicidad de terceros.</p>
        </Section>

        <Section title="6. Retención de datos">
          <p>Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta, todos tus datos se borran de nuestros sistemas en 24 horas.</p>
        </Section>

        <Section title="7. Cambios en esta política">
          <p>Te notificaremos por correo con al menos 30 días de antelación ante cambios materiales en esta política.</p>
        </Section>

        <Section title="8. Contacto">
          <p>Para cualquier consulta sobre privacidad, escríbenos a <a href="mailto:privacidad@sir-app.com" style={inlineLink}>privacidad@sir-app.com</a>.</p>
        </Section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1a1d27', padding: '28px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <Link href="/" style={{ fontSize: 18, fontWeight: 800, color: '#818cf8', textDecoration: 'none' }}>SIR</Link>
        <div style={{ display: 'flex', gap: 20 }}>
          <Link href="/terminos"  style={footerLink}>Términos</Link>
          <Link href="/login"     style={footerLink}>Iniciar sesión</Link>
          <Link href="/signup"    style={footerLink}>Registrarse</Link>
        </div>
        <span style={{ fontSize: 12, color: '#334155' }}>© 2026 SIR — Sistema de Inteligencia Relacional</span>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', margin: '0 0 14px', letterSpacing: '-0.3px' }}>{title}</h2>
      <div style={{ fontSize: 15, color: '#94a3b8', lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  );
}

const navLink: React.CSSProperties = {
  padding: '8px 16px', color: '#94a3b8', textDecoration: 'none', fontSize: 14, borderRadius: 8,
};
const ctaSmall: React.CSSProperties = {
  padding: '8px 18px', background: '#6366f1', color: '#fff', textDecoration: 'none',
  fontSize: 14, fontWeight: 600, borderRadius: 8,
};
const footerLink: React.CSSProperties = {
  fontSize: 13, color: '#475569', textDecoration: 'none',
};
const inlineLink: React.CSSProperties = {
  color: '#818cf8', textDecoration: 'underline',
};
