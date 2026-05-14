import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthUser } from '@/lib/supabase-server';
import DeleteAccountForm from './DeleteAccountForm';

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ marginBottom: 28 }}>
        <Link href="/settings" style={{ color: '#64748b', fontSize: 13, textDecoration: 'none' }}>
          ← Configuración
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#e2e8f0', margin: '8px 0 4px' }}>
          Privacidad y datos
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
          Exporta o elimina todos tus datos personales
        </p>
      </div>

      {/* Export */}
      <section style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 12, padding: 22, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', margin: '0 0 8px' }}>
          Exportar mis datos
        </h2>
        <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px', lineHeight: 1.6 }}>
          Descarga un archivo JSON con todas tus memorias, señales, relaciones, personas y estados.
        </p>
        <a
          href="/api/privacy/export"
          style={{
            display: 'inline-block', padding: '9px 20px',
            background: '#6366f1', borderRadius: 8, color: '#fff',
            textDecoration: 'none', fontSize: 13, fontWeight: 600,
          }}
        >
          Exportar mis datos (JSON)
        </a>
      </section>

      {/* Delete */}
      <section style={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 12, padding: 22 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fca5a5', margin: '0 0 8px' }}>
          Eliminar mi cuenta
        </h2>
        <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px', lineHeight: 1.6 }}>
          Elimina permanentemente tu cuenta y todos los datos asociados. Esta acción no se puede deshacer.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
