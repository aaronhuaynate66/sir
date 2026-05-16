import Link from 'next/link';

export const metadata = { title: 'Términos de Uso — SIR' };

export default function TerminosPage() {
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
        <h1 style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-1px', margin: '0 0 8px' }}>Términos de Uso</h1>
        <p style={{ color: '#475569', fontSize: 14, margin: '0 0 48px' }}>Última actualización: mayo 2026</p>

        <Section title="1. Aceptación">
          <p>Al crear una cuenta en SIR (Sistema de Inteligencia Relacional) aceptas estos Términos de Uso. Si no estás de acuerdo, no uses el servicio.</p>
        </Section>

        <Section title="2. Descripción del servicio">
          <p>SIR es una plataforma de gestión de relaciones personales y profesionales que utiliza inteligencia artificial para ayudarte a mantener el contexto de tus relaciones, generar briefings y detectar oportunidades. El servicio se presta «tal cual» y puede cambiar o interrumpirse en cualquier momento.</p>
        </Section>

        <Section title="3. Uso aceptable">
          <p>Te comprometes a:</p>
          <ul>
            <li>Usar SIR únicamente para fines legales y éticos.</li>
            <li>No introducir datos de terceros sin su consentimiento cuando sea legalmente requerido.</li>
            <li>No intentar acceder a datos de otros usuarios ni vulnerar la seguridad del sistema.</li>
            <li>No usar el servicio para spam, desinformación o actividades que violen leyes aplicables.</li>
          </ul>
        </Section>

        <Section title="4. Tu contenido">
          <p>Eres el único propietario de los datos que introduces en SIR. Nos concedes una licencia limitada para procesarlos con el único fin de prestarte el servicio. No reclamamos ningún derecho de propiedad sobre tu contenido.</p>
        </Section>

        <Section title="5. Planes y pagos">
          <ul>
            <li><strong>Plan gratuito:</strong> acceso básico con límites de uso.</li>
            <li><strong>Planes de pago:</strong> facturación mensual vía Stripe. Puedes cancelar en cualquier momento; el acceso se mantiene hasta el final del período pagado.</li>
            <li><strong>Reembolsos:</strong> ofrecemos reembolso completo dentro de los primeros 7 días si no estás satisfecho.</li>
          </ul>
        </Section>

        <Section title="6. Disponibilidad y SLA">
          <p>Nos esforzamos por mantener una disponibilidad del 99,5 % mensual. No garantizamos disponibilidad ininterrumpida. Realizamos mantenimientos comunicados con al menos 24 horas de antelación cuando sea posible.</p>
        </Section>

        <Section title="7. Limitación de responsabilidad">
          <p>SIR no se hace responsable de pérdidas indirectas, de datos o de negocio derivadas del uso o la imposibilidad de uso del servicio. La responsabilidad máxima se limita al importe pagado en los últimos 12 meses.</p>
        </Section>

        <Section title="8. Privacidad">
          <p>El tratamiento de tus datos personales se rige por nuestra <Link href="/privacidad" style={inlineLink}>Política de Privacidad</Link>, que forma parte integrante de estos Términos.</p>
        </Section>

        <Section title="9. Modificaciones">
          <p>Podemos actualizar estos Términos con 30 días de preaviso por correo. El uso continuado del servicio tras ese plazo implica la aceptación de los nuevos términos.</p>
        </Section>

        <Section title="10. Ley aplicable">
          <p>Estos Términos se rigen por la legislación española. Para cualquier disputa, las partes se someten a los juzgados y tribunales de Madrid.</p>
        </Section>

        <Section title="11. Contacto">
          <p>Para consultas sobre estos Términos, escríbenos a <a href="mailto:legal@sir-app.com" style={inlineLink}>legal@sir-app.com</a>.</p>
        </Section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1a1d27', padding: '28px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <Link href="/" style={{ fontSize: 18, fontWeight: 800, color: '#818cf8', textDecoration: 'none' }}>SIR</Link>
        <div style={{ display: 'flex', gap: 20 }}>
          <Link href="/privacidad" style={footerLink}>Privacidad</Link>
          <Link href="/login"      style={footerLink}>Iniciar sesión</Link>
          <Link href="/signup"     style={footerLink}>Registrarse</Link>
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
