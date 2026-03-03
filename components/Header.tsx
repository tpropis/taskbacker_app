'use client';

import Link from 'next/link';

function TaskBackerLogo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="10" fill="#4f46e5" />
      <path
        d="M18 7L9 12V19.5C9 25 13 29.5 18 31C23 29.5 27 25 27 19.5V12L18 7Z"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M12 19L16 23L24 13"
        stroke="white"
        strokeWidth="2.8"
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
