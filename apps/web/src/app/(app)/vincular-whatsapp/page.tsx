'use client';

import { useState, useEffect } from 'react';

interface LinkState {
  loading: boolean;
  verified: boolean;
  phone_number: string | undefined;
  code: string | undefined;
  error: string | undefined;
  refreshing: boolean;
  disconnecting: boolean;
}

const BOT_PHONE = process.env['NEXT_PUBLIC_WHATSAPP_BOT_PHONE'] ?? '+1 (555) SIR-BOT';

export default function VincularWhatsAppPage() {
  const [state, setState] = useState<LinkState>({
    loading:       true,
    verified:      false,
    phone_number:  undefined,
    code:          undefined,
    error:         undefined,
    refreshing:    false,
    disconnecting: false,
  });

  useEffect(() => {
    void fetchStatus();
  }, []);

  async function fetchStatus() {
    setState(s => ({ ...s, loading: true, error: undefined }));
    try {
      const res  = await fetch('/api/whatsapp/link');
      const data = await res.json() as { verified?: boolean; code?: string; phone_number?: string; error?: string };
      setState(s => ({
        ...s,
        loading:      false,
        verified:     data.verified ?? false,
        code:         data.code,
        phone_number: data.phone_number,
        error:        !res.ok ? (data.error ?? 'Error') : undefined,
      }));
    } catch {
      setState(s => ({ ...s, loading: false, error: 'Error de red' }));
    }
  }

  async function refreshCode() {
    setState(s => ({ ...s, refreshing: true }));
    try {
      const res  = await fetch('/api/whatsapp/link', { method: 'POST' });
      const data = await res.json() as { code?: string; error?: string };
      setState(s => ({ ...s, refreshing: false, code: data.code, error: data.error }));
    } catch {
      setState(s => ({ ...s, refreshing: false, error: 'Error al renovar código' }));
    }
  }

  async function disconnect() {
    if (!confirm('¿Desconectar WhatsApp?')) return;
    setState(s => ({ ...s, disconnecting: true }));
    try {
      await fetch('/api/whatsapp/link', { method: 'DELETE' });
      setState(s => ({ ...s, disconnecting: false, verified: false, phone_number: undefined, code: undefined }));
      await fetchStatus();
    } catch {
      setState(s => ({ ...s, disconnecting: false }));
    }
  }

  const card: React.CSSProperties = {
    background:   '#1a1d27',
    border:       '1px solid #2a2d3e',
    borderRadius: 12,
    padding:      '24px',
    maxWidth:     520,
  };

  const badge = (connected: boolean) => ({
    display:       'inline-block' as const,
    fontSize:       11, fontWeight: 600,
    borderRadius:   20, padding:    '2px 8px',
    background:    connected ? '#bbf7d033' : '#f1f5f933',
    color:         connected ? '#86efac'   : '#64748b',
    marginTop:      4,
  });

  if (state.loading) {
    return (
      <div style={{ maxWidth: 520 }}>
        <p style={{ color: '#64748b' }}>Cargando...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', margin: '0 0 6px' }}>
          Vincular WhatsApp
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
          Accede a SIR directamente desde WhatsApp.
        </p>
      </div>

      <div style={card}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: '#25D36633', border: '1px solid #25D36644',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>
            💬
          </div>
          <div>
            <p style={{ color: '#e2e8f0', fontWeight: 600, margin: '0 0 2px', fontSize: 15 }}>
              Bot de SIR
            </p>
            <span style={badge(state.verified)}>
              {state.verified ? '● Conectado' : '○ No conectado'}
            </span>
          </div>
        </div>

        {state.verified ? (
          /* ── Already linked ── */
          <>
            <div style={{
              background: '#13151f', borderRadius: 8, padding: '12px 16px', marginBottom: 16,
            }}>
              <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 4px' }}>Número vinculado</p>
              <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 16, margin: 0 }}>
                +{state.phone_number}
              </p>
            </div>

            <div style={{
              background: '#bbf7d01a', border: '1px solid #86efac33',
              borderRadius: 8, padding: '12px 16px', marginBottom: 20,
            }}>
              <p style={{ color: '#86efac', fontSize: 13, margin: '0 0 8px', fontWeight: 600 }}>
                ✅ Tu WhatsApp está activo
              </p>
              <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
                Escribe al bot para usar comandos: <strong>briefing</strong>, <strong>señal</strong>, <strong>estado</strong>, <strong>red</strong>, <strong>ayuda</strong>
              </p>
            </div>

            <button
              onClick={() => void disconnect()}
              disabled={state.disconnecting}
              style={{
                padding:    '8px 16px',
                background: 'transparent',
                color:      '#94a3b8',
                border:     '1px solid #2a2d3e',
                borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: state.disconnecting ? 'not-allowed' : 'pointer',
              }}
            >
              {state.disconnecting ? 'Desconectando…' : 'Desconectar'}
            </button>
          </>
        ) : (
          /* ── Not linked ── */
          <>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 20px', lineHeight: 1.6 }}>
              Sigue estos pasos para conectar tu WhatsApp:
            </p>

            {/* Step 1 */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-start' }}>
              <div style={{
                minWidth: 28, height: 28, borderRadius: '50%',
                background: '#6366f133', color: '#818cf8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
              }}>1</div>
              <div>
                <p style={{ color: '#e2e8f0', fontWeight: 600, margin: '0 0 4px', fontSize: 14 }}>
                  Guarda el número del bot
                </p>
                <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 8px' }}>
                  Agrega este número a tus contactos de WhatsApp:
                </p>
                <code style={{
                  display: 'block',
                  background: '#13151f', border: '1px solid #2a2d3e',
                  borderRadius: 6, padding: '8px 12px',
                  color: '#e2e8f0', fontSize: 16, fontWeight: 700, letterSpacing: 1,
                }}>
                  {BOT_PHONE}
                </code>
              </div>
            </div>

            {/* Step 2 */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-start' }}>
              <div style={{
                minWidth: 28, height: 28, borderRadius: '50%',
                background: '#6366f133', color: '#818cf8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
              }}>2</div>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#e2e8f0', fontWeight: 600, margin: '0 0 4px', fontSize: 14 }}>
                  Envía este código al bot
                </p>
                <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 8px' }}>
                  Manda exactamente este código de 6 dígitos:
                </p>
                {state.code ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{
                      background: '#13151f', border: '1px solid #6366f144',
                      borderRadius: 6, padding: '10px 20px',
                      color: '#818cf8', fontSize: 28, fontWeight: 700, letterSpacing: 6,
                    }}>
                      {state.code}
                    </code>
                    <button
                      onClick={() => void refreshCode()}
                      disabled={state.refreshing}
                      title="Obtener nuevo código"
                      style={{
                        padding: '6px 10px',
                        background: 'transparent', color: '#64748b',
                        border: '1px solid #2a2d3e',
                        borderRadius: 6, fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      {state.refreshing ? '…' : '↻'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => void refreshCode()}
                    style={{
                      padding: '8px 16px',
                      background: '#6366f1', color: '#fff',
                      border: 'none', borderRadius: 8,
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Generar código
                  </button>
                )}
              </div>
            </div>

            {/* Step 3 */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-start' }}>
              <div style={{
                minWidth: 28, height: 28, borderRadius: '50%',
                background: '#6366f133', color: '#818cf8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
              }}>3</div>
              <div>
                <p style={{ color: '#e2e8f0', fontWeight: 600, margin: '0 0 4px', fontSize: 14 }}>
                  ¡Listo!
                </p>
                <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
                  El bot confirmará la vinculación y podrás usar todos los comandos.
                </p>
              </div>
            </div>

            {state.error && (
              <p style={{
                color: '#fca5a5', fontSize: 13,
                background: '#fca5a51a', padding: '8px 12px', borderRadius: 6, margin: 0,
              }}>
                {state.error}
              </p>
            )}
          </>
        )}
      </div>

      {/* Commands reference */}
      <div style={{ ...card, marginTop: 16 }}>
        <p style={{ color: '#94a3b8', fontWeight: 600, fontSize: 13, margin: '0 0 12px' }}>
          Comandos disponibles
        </p>
        {[
          ['briefing [nombre]', 'Briefing ejecutivo de un contacto'],
          ['señal [texto]',     'Guardar una señal o nota'],
          ['estado',            'Rituales sugeridos para hoy'],
          ['red',               'Top 5 contactos por fortaleza'],
          ['ayuda',             'Lista de todos los comandos'],
        ].map(([cmd, desc]) => (
          <div key={cmd} style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <code style={{
              color: '#818cf8', fontSize: 12, fontWeight: 600,
              background: '#6366f11a', borderRadius: 4, padding: '2px 6px',
              minWidth: 140,
            }}>
              {cmd}
            </code>
            <span style={{ color: '#64748b', fontSize: 13 }}>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
