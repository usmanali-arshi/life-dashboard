'use client';

import { usePathname } from 'next/navigation';

/** Mobile-only "+" that opens the People quick-add from any tab. */
export function FloatingAdd() {
  const pathname = usePathname();
  // People has its own "Met someone" button; login has nothing to add to.
  if (pathname.startsWith('/people') || pathname.startsWith('/login')) return null;
  return (
    <a href="/people?add=1" className="fab" aria-label="Met someone">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
           strokeLinecap="round" aria-hidden>
        <path d="M12 5v14M5 12h14" />
      </svg>
    </a>
  );
}
