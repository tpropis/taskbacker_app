'use client';

import Link from 'next/link';

function TaskBackerLogo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="11" fill="#4f46e5" />
      <path
        d="M18 6L8 11V19C8 25.5 12.5 30.5 18 32C23.5 30.5 28 25.5 28 19V11L18 6Z"
        fill="white"
        fillOpacity="0.2"
      />
      <path
        d="M12 19L15.5 22.5L24 14"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
      <div className="max-w-3xl mx-auto px-5 h-16 flex items-center">
        <Link href="/" className="flex items-center gap-3">
          <TaskBackerLogo />
          <div className="leading-none">
            <p className="font-black text-[15px] text-slate-900 tracking-tight">TaskBacker</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Document · Review · Complete</p>
          </div>
        </Link>
      </div>
    </header>
  );
}
