import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TaskBacker AR — Your Tasks, Backed by Reality',
  description:
    'Next-generation task management with LiDAR-powered augmented reality. ' +
    'Place tasks in your physical space. See your work in a new dimension.',
  keywords: ['task management', 'augmented reality', 'LiDAR', 'AR tasks', 'productivity'],
  authors: [{ name: 'TaskBacker' }],
  openGraph: {
    title: 'TaskBacker AR',
    description: 'Place tasks in augmented reality with LiDAR depth sensing.',
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
      <head>
        {/* Allow WebXR camera access */}
        <meta httpEquiv="feature-policy" content="xr-spatial-tracking 'self'" />
      </head>
      <body className="min-h-screen bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
