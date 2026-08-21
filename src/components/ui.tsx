import { dueDayKey, todayKeyIn, tomorrowKeyIn } from '@/lib/dates';

/**
 * Completion control. Deliberately a ROUND button with a text label, sitting on
 * the right — the multi-select control is a square checkbox on the left. Two
 * adjacent square checkboxes meaning "select" and "complete" were impossible to
 * tell apart; shape, position and wording now all separate them.
 */
export function DoneButton({ done, busy, onClick, title }: {
  done: boolean; busy?: boolean; onClick: () => void; title: string;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={busy}
      className={done ? 'donebtn is-done' : 'donebtn'}
      aria-pressed={done}
      aria-label={done ? `Mark "${title}" not done` : `Mark "${title}" done`}
    >
      <span className="ring" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"
             strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 13 4.5 4.5L19 6.5" />
        </svg>
      </span>
      <span className="txt">{done ? 'Undo' : 'Done'}</span>
    </button>
  );
}

/**
 * Faint wash of the account's identity colour behind a row, so you can tell at
 * a glance which inbox/calendar a line came from. Kept at 8% so text contrast
 * is untouched — the colour is a hint, never the carrier of meaning; the
 * account name is always printed in the row as well.
 */
export function accountTint(color?: string | null): React.CSSProperties | undefined {
  if (!color) return undefined;
  return { background: `color-mix(in srgb, ${color} 8%, transparent)` };
}

/** Account chip in the Connected Tools row. Initials + the validated identity
 *  color, with the account name in text beside it. */
export function ToolBadge({ label, color }: { label: string; color: string }) {
  const initials = label.replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/)
    .map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return <span className="badge" style={{ background: color }}>{initials || '?'}</span>;
}

export const fmtTime = (d: Date | string, tz: string) =>
  new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });

export const fmtDay = (d: Date | string, tz: string) =>
  new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz });

/** "Today" / "Tomorrow" / "Mon, Sep 3" — relative labels where they help. */
export function dueLabel(due: string | null, tz: string): string | null {
  if (!due) return null;
  const t = dueDayKey(due);                   // floating date → UTC
  const today = todayKeyIn(tz);               // instant → user's zone
  if (t === today) return 'Today';
  if (t === tomorrowKeyIn(tz)) return 'Tomorrow';
  if (t < today) return 'Overdue';
  // Render the label in UTC too, or a Tuesday due date prints as Monday.
  return new Date(due).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

export type Urgency = 'overdue' | 'today' | 'soon' | 'none';

/**
 * Due-date urgency. Due date read in UTC (floating date), today read in the
 * user's zone (real instant) — see lib/dates.ts for why mixing them is a bug.
 */
export function urgency(due: string | null, tz: string): Urgency {
  if (!due) return 'none';
  const t = dueDayKey(due);
  const today = todayKeyIn(tz);
  if (t < today) return 'overdue';
  if (t === today) return 'today';
  const inTwoDays = new Date(Date.now() + 2 * 864e5).toLocaleDateString('en-CA', { timeZone: tz });
  if (t <= inTwoDays) return 'soon';
  return 'none';
}

/** Status pill. Always carries a text label — never colour alone. */
export function DuePill({ due, tz }: { due: string | null; tz: string }) {
  const u = urgency(due, tz);
  const text = dueLabel(due, tz);
  if (!text) return <span className="pill soon">No date</span>;
  return <span className={u === 'none' ? 'pill soon' : `pill ${u}`}>{text}</span>;
}

export const rowClass = (due: string | null, tz: string) => {
  const u = urgency(due, tz);
  return u === 'overdue' ? 'row is-overdue' : u === 'today' ? 'row is-today' : 'row';
};
