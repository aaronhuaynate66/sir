export const metadata = {
  title: 'SIR — Sistema de Inteligencia Relacional',
  description: 'Tu inteligencia relacional personal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
