'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ContactInput } from '../actions';
import type { ActionResult, Contact, Industry } from '../types';
import { ContactSheet } from './ContactSheet';
import type { PlaceValue } from './PlaceInput';

interface Props {
  industries: Industry[];
  existingNames: string[];
  defaultPlace: PlaceValue | null;
  onCreate: (input: ContactInput) => Promise<ActionResult<Contact>>;
}

/** The "Met someone" button plus the create sheet; also opens on ?add=1. */
export function QuickAddSheet({ industries, existingNames, defaultPlace, onCreate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openedByUrl = params.get('add') === '1';

  const [open, setOpen] = useState(openedByUrl);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => { if (openedByUrl) setOpen(true); }, [openedByUrl]);

  const close = useCallback(() => {
    setOpen(false);
    if (openedByUrl) {
      const p = new URLSearchParams(params.toString());
      p.delete('add');
      const qs = p.toString();
      router.replace((qs ? `${pathname}?${qs}` : pathname) as Route, { scroll: false });
    }
  }, [openedByUrl, params, pathname, router]);

  return (
    <>
      <span className="pp-addwrap">
        {flash && !open && (
          <span className="pp-flash" role="status">
            {flash}
            <button type="button" className="pp-iconbtn" aria-label="Dismiss"
                    onClick={() => setFlash(null)}>✕</button>
          </span>
        )}
        <button type="button" className="pp-btn" onClick={() => { setFlash(null); setOpen(true); }}>
          Met someone
        </button>
      </span>
      {open && (
        <ContactSheet
          open onClose={close}
          industries={industries} existingNames={existingNames} defaultPlace={defaultPlace}
          onSubmit={onCreate}
          onSaved={(c, addAnother) => {
            setFlash(`Added ${c.name}`);
            if (!addAnother) close();
            router.refresh();
          }}
        />
      )}
    </>
  );
}
