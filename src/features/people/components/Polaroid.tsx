import type { Route } from 'next';
import Link from 'next/link';
import { fmtMetOn } from '../dates';
import type { Contact } from '../types';
import { initials, rotation, tintIndex } from './visual';

export const PinIcon = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11Z" /><circle cx="12" cy="10" r="2.2" />
  </svg>
);

interface Props {
  contact: Contact;
  placeName: string | null;
  industryName: string | null;
  href?: string;
  /** Larger, untilted-by-default variant for the drawer header. */
  size?: 'wall' | 'drawer';
  tilt?: number;
}

export function Polaroid({ contact, placeName, industryName, href, size = 'wall', tilt }: Props) {
  const deg = tilt ?? rotation(contact.id);
  const body = (
    <>
      <span className="pp-tape" aria-hidden />
      <span className={`pp-photo tint-${tintIndex(contact.id)}`} aria-hidden>
        {initials(contact.name)}
      </span>
      <span className="pp-name">{contact.name}</span>
      <span className="pp-meta">
        <PinIcon />
        <span className="pp-meta-text">
          {placeName ? `${placeName} · ` : ''}{fmtMetOn(contact.met_on)}
        </span>
      </span>
      {industryName && <span className="pp-pill">{industryName}</span>}
    </>
  );
  const cls = `pp-polaroid ${size === 'drawer' ? 'is-large' : ''}`;
  const style = { '--tilt': `${deg}deg` } as React.CSSProperties;
  return href
    ? <Link href={href as Route} className={cls} style={style} scroll={false}>{body}</Link>
    : <div className={cls} style={style}>{body}</div>;
}
