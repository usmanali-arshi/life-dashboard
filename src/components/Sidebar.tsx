'use client';

import { usePathname } from 'next/navigation';

/* Inline 1.5px stroke icons — no icon dependency, no runtime cost, and they
   inherit currentColor so the active state needs no special-casing. */
const icons: Record<string, React.ReactNode> = {
  overview: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  tasks: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  mail: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="m3 7 8.2 5.6a1.5 1.5 0 0 0 1.6 0L21 7" /></>,
  habits: <><path d="M3 17.5 8.5 12l3.5 3.5L21 6.5" /><path d="M15.5 6.5H21v5.5" /></>,
  prep: <><path d="M4 4.5h6a2.5 2.5 0 0 1 2 2.5 2.5 2.5 0 0 1 2-2.5h6v13h-6a2.5 2.5 0 0 0-2 2.5 2.5 2.5 0 0 0-2-2.5H4Z" /><path d="M12 7v13" /></>,
  accounts: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
};

const NAV = [
  { href: '/', label: 'Overview', icon: 'overview' },
  { href: '/calendar', label: 'Calendar', icon: 'calendar' },
  { href: '/tasks', label: 'Tasks', icon: 'tasks' },
  { href: '/inbox', label: 'Emails', icon: 'mail', gmailOnly: true },
  { href: '/habits', label: 'Habits', icon: 'habits' },
  { href: '/prep', label: 'Prep', icon: 'prep' },
];

export function Sidebar({ enableGmail }: { enableGmail: boolean }) {
  const pathname = usePathname();
  const items = NAV.filter((i) => !i.gmailOnly || enableGmail);

  const link = (href: string, label: string, icon: string) => {
    // Exact match for "/", prefix match for the rest — otherwise every route
    // would light up Overview.
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
    return (
      <a key={href} href={href} className={active ? 'active' : undefined}
         aria-current={active ? 'page' : undefined}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {icons[icon]}
        </svg>
        <span>{label}</span>
      </a>
    );
  };

  return (
    <nav className="sidebar">
      <div className="brand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
             strokeLinecap="round" style={{ width: 18, height: 18 }}>
          {icons.overview}
        </svg>
        My Dashboard
      </div>
      {items.map((i) => link(i.href, i.label, i.icon))}
      <div className="grow" />
      {link('/settings', 'Accounts', 'accounts')}
    </nav>
  );
}
