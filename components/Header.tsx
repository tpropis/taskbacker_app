'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Camera } from 'lucide-react';

function TaskBackerLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="url(#logo-bg)" />
      {/* Shield shape */}
      <path
        d="M16 5L7 9V16C7 21.5 11 26.1 16 27.5C21 26.1 25 21.5 25 16V9L16 5Z"
        fill="white"
        fillOpacity="0.15"
      />
      {/* Checkmark */}
      <path
        d="M11 16L14 19L21 12"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00d4ff" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <TaskBackerLogo />
          <span className="font-bold text-lg tracking-tight text-white">
            TaskBacker
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
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
              pathname === '/ar' || pathname?.startsWith('/tasks')
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'text-white/60 hover:text-cyan-400 hover:bg-cyan-500/10'
            }`}
          >
            <Camera size={16} />
            <span className="hidden sm:inline">Scan</span>
          </Link>
        </nav>

        {/* Status */}
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden sm:inline">Ready</span>
        </div>
      </div>
    </header>
  );
}
