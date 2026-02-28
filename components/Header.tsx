'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Scan, LayoutDashboard, Zap } from 'lucide-react';

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-9 h-9">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 opacity-80 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 rounded-xl flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
          </div>
          <span className="font-bold text-lg tracking-tight gradient-text-blue-purple">
            TaskBacker
          </span>
          <span className="hidden sm:inline text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            AR
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              pathname === '/'
                ? 'bg-white/10 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <LayoutDashboard size={16} />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <Link
            href="/ar"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              pathname === '/ar'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-white/60 hover:text-cyan-400 hover:bg-cyan-500/10'
            }`}
          >
            <Scan size={16} />
            <span className="hidden sm:inline">AR Mode</span>
          </Link>
        </nav>

        {/* Status pill */}
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden sm:inline">LiDAR Ready</span>
        </div>
      </div>
    </header>
  );
}
