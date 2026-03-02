'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Camera } from 'lucide-react';

function TaskBackerLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#1e293b" />
      <path
        d="M16 5L7 9V16C7 21.5 11 26.1 16 27.5C21 26.1 25 21.5 25 16V9L16 5Z"
        fill="white"
        fillOpacity="0.18"
      />
      <path
        d="M11 16L14 19L21 12"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <TaskBackerLogo />
          <span className="font-bold text-base text-gray-900">TaskBacker</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              pathname === '/'
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <LayoutDashboard size={15} />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <Link
            href="/ar"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              pathname === '/ar' || pathname?.startsWith('/tasks')
                ? 'bg-blue-600 text-white'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Camera size={15} />
            <span className="hidden sm:inline">Scan</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
