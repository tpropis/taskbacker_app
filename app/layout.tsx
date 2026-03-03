import type { Metadata, Viewport } from 'next';
import './globals.css';
import GhstAIChatbot from '@/components/GhstAIChatbot';

export const metadata: Metadata = {
  title: 'TaskBacker — Document. Review. Complete.',
  description:
    'Task management with before & after photo documentation. ' +
    'Capture the problem, fix it, capture the proof. Works in Safari — no app required.',
  keywords: ['task management', 'photo documentation', 'before after', 'field tasks', 'productivity'],
  authors: [{ name: 'TaskBacker' }],
  openGraph: {
    title: 'TaskBacker',
    description: 'Document tasks with before & after photos. Works in Safari on iPhone.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white antialiased">
        {children}
        <GhstAIChatbot />
      </body>
    </html>
  );
}
