import type { Metadata, Viewport } from 'next';
import { FloatingAdd } from '@/components/FloatingAdd';
import { RegisterSW } from '@/components/RegisterSW';
import { Sidebar } from '@/components/Sidebar';
import { ENABLE_GMAIL } from '@/lib/env';
import './globals.css';

export const metadata: Metadata = {
  title: 'Life Dashboard',
  description: 'Calendar, email, tasks and habits across every account, on one page.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon-32.png',
    // iOS ignores the manifest icon list and uses this.
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Dashboard',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Home-screen apps should not rubber-band-zoom like a web page.
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#16182b' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0f1a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Grammarly and similar extensions inject attributes (data-gr-ext-installed,
          data-new-gr-c-s-check-loaded) into <body> before React hydrates, which
          reads as a server/client mismatch. Scoped to this element only — it does
          NOT suppress mismatches in children, so real hydration bugs still surface. */}
      <body suppressHydrationWarning>
        <div className="app">
          <Sidebar enableGmail={ENABLE_GMAIL} />
          <main className="main">{children}</main>
        </div>
        <FloatingAdd />
        <RegisterSW />
      </body>
    </html>
  );
}
