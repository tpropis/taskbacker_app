'use client';

import Link from 'next/link';

function TaskBackerLogo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="34" height="34" rx="9" fill="#4f46e5" />
      <path
        d="M9.5 18L14.5 23L24.5 12"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
      <div className="max-w-3xl mx-auto px-5 h-14 flex items-center">
        <Link href="/" className="flex items-center gap-2.5">
          <TaskBackerLogo />
          <span className="font-black text-[15px] text-slate-900 tracking-tight">TaskBacker</span>
        </Link>
      </div>
    </header>
  );
}
