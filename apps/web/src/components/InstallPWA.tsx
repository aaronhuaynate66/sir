'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'sir-pwa-dismissed';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Hide if already running as standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Hide if user dismissed before
    if (localStorage.getItem(DISMISSED_KEY)) return;
    // Hide on desktop (viewport wider than 768px)
    if (window.innerWidth > 768) return;

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#1e1b4b', borderTop: '1px solid #6366f1',
      padding: '14px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <span style={{ fontSize: 14, color: '#e2e8f0', flex: 1 }}>
        📱 Instala SIR en tu celular → Agregar a pantalla de inicio
      </span>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={install}
          style={{
            padding: '7px 14px', background: '#6366f1', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Instalar
        </button>
        <button
          onClick={dismiss}
          aria-label="Cerrar"
          style={{
            padding: '7px 10px', background: 'transparent', color: '#64748b',
            border: '1px solid #334155', borderRadius: 8, fontSize: 13, cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
