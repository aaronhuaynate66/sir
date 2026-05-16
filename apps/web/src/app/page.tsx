import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthUser } from '@/lib/supabase-server';

export default async function LandingPage() {
  const user = await getAuthUser();
  if (user) redirect('/inicio');

  return (
    <div style={{ background: '#0f1117', color: '#e2e8f0', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 48px', borderBottom: '1px solid #1a1d27' }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: '#818cf8', letterSpacing: '-0.5px' }}>SIR</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/login" style={navLink}>Iniciar sesión</Link>
          <Link href="/signup" style={ctaSmall}>Empezar gratis →</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '100px 48px 80px', maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'inline-block', background: '#6366f122', border: '1px solid #6366f144', borderRadius: 20, padding: '4px 14px', fontSize: 12, color: '#818cf8', fontWeight: 600, marginBottom: 24, letterSpacing: '0.04em' }}>
          INTELIGENCIA RELACIONAL
        </div>
        <h1 style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.1, margin: '0 0 20px', letterSpacing: '-1.5px' }}>
          Conoce a las personas{' '}
          <span style={{ color: '#818cf8' }}>importantes de tu vida</span>{' '}
          mejor que nadie
        </h1>
        <p style={{ fontSize: 18, color: '#64748b', lineHeight: 1.7, margin: '0 0 40px', maxWidth: 540, marginLeft: 'auto', marginRight: 'auto' }}>
          SIR recuerda el contexto de tus relaciones, genera briefings con IA antes de cada conversación y detecta oportunidades automáticamente.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/signup" style={ctaLarge}>Empezar gratis →</Link>
          <Link href="/login" style={secondaryBtn}>Ya tengo cuenta</Link>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 800, margin: '0 0 60px', letterSpacing: '-0.5px' }}>
          Todo lo que necesitas para gestionar tus relaciones
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {[
            {
              icon: '🧠',
              title: 'Memoria profunda',
              desc: 'Guarda contexto detallado de cada persona: trabajo, familia, fechas importantes, estados emocionales, y conversaciones relevantes.',
            },
            {
              icon: '💡',
              title: 'Briefings con IA',
              desc: 'Antes de una reunión o llamada, genera un resumen inteligente con todo lo que necesitas saber: contexto actual, oportunidades y recomendaciones.',
            },
            {
              icon: '📡',
              title: 'Signal Engine',
              desc: 'Detecta señales en conversaciones de WhatsApp, LinkedIn o Instagram. Identifica cambios de trabajo, logros y momentos clave automáticamente.',
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={featureCard}>
              <span style={{ fontSize: 36, display: 'block', marginBottom: 16 }}>{icon}</span>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 10px', color: '#e2e8f0' }}>{title}</h3>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: '80px 48px', background: '#13151f', borderTop: '1px solid #1a1d27', borderBottom: '1px solid #1a1d27' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 800, margin: '0 0 60px', letterSpacing: '-0.5px' }}>
            Cómo funciona
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {[
              { step: '01', title: 'Agrega tus contactos', desc: 'Sube un screenshot de LinkedIn, Instagram o WhatsApp. SIR extrae automáticamente toda la información relevante.' },
              { step: '02', title: 'Registra señales', desc: 'Anota interacciones, eventos y observaciones. La IA enriquece el contexto y genera memorias automáticamente.' },
              { step: '03', title: 'Actúa con inteligencia', desc: 'Antes de cada conversación, genera un briefing personalizado. Nunca llegues sin contexto a una reunión importante.' },
            ].map(({ step, title, desc }) => (
              <div key={step} style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#6366f1', background: '#6366f115', border: '1px solid #6366f130', borderRadius: 8, padding: '6px 12px', flexShrink: 0, letterSpacing: '0.04em' }}>
                  {step}
                </span>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: '#e2e8f0' }}>{title}</h3>
                  <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ padding: '80px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.5px' }}>
          Planes simples y transparentes
        </h2>
        <p style={{ textAlign: 'center', color: '#64748b', fontSize: 15, margin: '0 0 60px' }}>
          Empieza gratis, actualiza cuando lo necesites
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[
            {
              name: 'Individual',
              price: '$19',
              period: '/mes',
              color: '#6366f1',
              features: ['Contactos ilimitados', '50 briefings/mes', 'Signal Engine', 'Grafo de relaciones'],
              cta: 'Empezar',
            },
            {
              name: 'Executive',
              price: '$49',
              period: '/mes',
              color: '#f59e0b',
              features: ['Todo en Individual', 'Modo Executive', 'Stakeholders map', 'Pipeline + Capital score', 'Reporte semanal IA'],
              cta: 'Empezar',
              featured: true,
            },
            {
              name: 'Teams',
              price: '$39',
              period: '/usr/mes',
              color: '#10b981',
              features: ['Todo en Executive', 'Admin panel', 'Compartir contexto', 'Mín. 3 usuarios', 'Soporte prioritario'],
              cta: 'Contactar',
            },
          ].map(({ name, price, period, color, features, cta, featured }) => (
            <div key={name} style={{
              background: featured ? '#1e1b4b' : '#1a1d27',
              border: `1px solid ${featured ? '#6366f1' : '#2a2d3e'}`,
              borderTop: `3px solid ${color}`,
              borderRadius: 16, padding: '28px 24px',
              position: 'relative' as const,
            }}>
              {featured && (
                <div style={{ position: 'absolute' as const, top: -12, left: '50%', transform: 'translateX(-50%)', background: '#6366f1', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '2px 12px', whiteSpace: 'nowrap' as const }}>
                  MÁS POPULAR
                </div>
              )}
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: '#e2e8f0' }}>{name}</h3>
              <div style={{ margin: '0 0 20px', display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color }}>{price}</span>
                <span style={{ fontSize: 14, color: '#64748b' }}>{period}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                {features.map(f => (
                  <li key={f} style={{ fontSize: 14, color: '#94a3b8', display: 'flex', gap: 8 }}>
                    <span style={{ color }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" style={{
                display: 'block', textAlign: 'center', padding: '10px',
                background: featured ? '#6366f1' : 'transparent',
                border: `1px solid ${featured ? '#6366f1' : '#2a2d3e'}`,
                borderRadius: 8, color: featured ? '#fff' : '#94a3b8',
                textDecoration: 'none', fontSize: 14, fontWeight: 600,
              }}>
                {cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1a1d27', padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: '#818cf8' }}>SIR</span>
        <div style={{ display: 'flex', gap: 24 }}>
          {[
            { label: 'Privacidad', href: '/privacidad' },
            { label: 'Términos', href: '/terminos' },
            { label: 'Iniciar sesión', href: '/login' },
            { label: 'Registrarse', href: '/signup' },
          ].map(({ label, href }) => (
            <Link key={href} href={href} style={{ fontSize: 13, color: '#475569', textDecoration: 'none' }}>
              {label}
            </Link>
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#334155' }}>© 2026 SIR — Sistema de Inteligencia Relacional</span>
      </footer>
    </div>
  );
}

// Styles
const navLink: React.CSSProperties = {
  padding: '8px 16px', color: '#94a3b8', textDecoration: 'none', fontSize: 14, borderRadius: 8,
};
const ctaSmall: React.CSSProperties = {
  padding: '8px 18px', background: '#6366f1', color: '#fff', textDecoration: 'none',
  fontSize: 14, fontWeight: 600, borderRadius: 8,
};
const ctaLarge: React.CSSProperties = {
  display: 'inline-block', padding: '14px 32px',
  background: '#6366f1', color: '#fff', textDecoration: 'none',
  fontSize: 16, fontWeight: 700, borderRadius: 10,
};
const secondaryBtn: React.CSSProperties = {
  display: 'inline-block', padding: '14px 24px',
  background: 'transparent', border: '1px solid #2a2d3e',
  color: '#94a3b8', textDecoration: 'none', fontSize: 15, borderRadius: 10,
};
const featureCard: React.CSSProperties = {
  background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 16, padding: '28px 24px',
};
