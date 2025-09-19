export const metadata = { title: 'UnlistIN', description: 'Privacy app starter' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'sans-serif', maxWidth: 720, margin: '0 auto', padding: 24 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
  <h1 style={{ margin: 0 }}>UnlistIN</h1>
  <nav style={{ display: 'flex', gap: 16 }}>
    <a href="/">Home</a>
    <a href="/requests">Requests</a>
  </nav>
</header>
        {children}
      </body>
    </html>
  );
}
