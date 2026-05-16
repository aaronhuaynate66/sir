import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import InstallPWA from '@/components/InstallPWA';

export const metadata: Metadata = {
  title: 'SIR — Sistema de Inteligencia Relacional',
  description: 'Tu inteligencia relacional personal',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SIR',
  },
  icons: {
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#7C6FCD',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env['NEXT_PUBLIC_GA4_MEASUREMENT_ID'];
  return (
    <html lang="es">
      <body style={{
        margin: 0,
        padding: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#0f1117',
        color: '#e2e8f0',
        minHeight: '100vh',
      }}>
        {children}
        <InstallPWA />

        {/* Service Worker registration */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function () {
                navigator.serviceWorker.register('/sw.js');
              });
            }
          `}
        </Script>

        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
