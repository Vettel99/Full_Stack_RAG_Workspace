'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, LayoutDashboard, LogOut, BookOpen } from 'lucide-react';
import { signOut } from '@/app/login/actions';

const NAV_LINKS = [
  { href: '/', label: 'Chat Workspace', icon: MessageSquare, exact: true },
  { href: '/evaluation/dashboard', label: 'Evaluation Dashboard', icon: LayoutDashboard, exact: false },
] as const;

export function NavBar() {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <header className="shrink-0 border-b border-white/10 bg-background/40 backdrop-blur-xl px-5 py-2.5 flex items-center justify-between">
      {/* Left: logo + nav links */}
      <div className="flex items-center gap-1">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mr-3 shadow-lg shadow-violet-500/30">
          <BookOpen className="w-3.5 h-3.5 text-white" />
        </div>
        {NAV_LINKS.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(href, exact)
                ? 'bg-white/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </Link>
        ))}
      </div>

      {/* Right: sign out */}
      <form action={signOut}>
        <button
          type="submit"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </form>
    </header>
  );
}
