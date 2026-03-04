'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Camera } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === '/ar') return null;

  const onTasks = pathname === '/' || (pathname?.startsWith('/tasks') ?? false);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex h-[60px] max-w-3xl mx-auto">
        <Link
          href="/"
          className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
            onTasks ? 'text-indigo-600' : 'text-slate-400'
          }`}
        >
          <LayoutGrid size={22} strokeWidth={onTasks ? 2.5 : 1.8} />
          <span className="text-[11px] font-bold tracking-tight">Tasks</span>
        </Link>

        <Link
          href="/ar"
          className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
            !onTasks ? 'text-indigo-600' : 'text-slate-400'
          }`}
        >
          <Camera size={22} strokeWidth={!onTasks ? 2.5 : 1.8} />
          <span className="text-[11px] font-bold tracking-tight">Scan</span>
        </Link>
      </div>
    </nav>
  );
}
