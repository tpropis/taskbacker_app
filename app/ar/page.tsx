import dynamic from 'next/dynamic';
import Header from '@/components/Header';

// ScanMode uses camera APIs — must be client-side only
const LiDARScanner = dynamic(() => import('@/components/LiDARScanner'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl border-2 border-cyan-500/50 animate-pulse"
          style={{ boxShadow: '0 0 40px rgba(0,212,255,0.4)' }}
        />
        <p className="text-cyan-400/70 text-sm">Initialising AR engine…</p>
      </div>
    </div>
  ),
});

export default function ARPage() {
  return (
    <main className="fixed inset-0 bg-black overflow-hidden">
      {/* Header only shown before AR session starts — hidden by AR camera */}
      <Header />
      <LiDARScanner />
    </main>
  );
}
