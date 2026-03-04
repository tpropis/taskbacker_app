import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  metadataBase: new URL('https://taskbacker-app.vercel.app'),
  title: 'TaskBacker',
  description: 'Document tasks with before & after photos. AI scores every scan.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TaskBacker',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#4f46e5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
