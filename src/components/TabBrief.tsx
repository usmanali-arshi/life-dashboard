import type { Brief } from '@/lib/briefing/tabs';

/** Per-tab summary line. Renders nothing when there's nothing worth saying. */
export function TabBrief({ brief }: { brief: Brief | null }) {
  if (!brief) return null;
  return (
    <div className="tabbrief">
      <strong>{brief.headline}</strong>
      {brief.body && <span className="body">{brief.body}</span>}
    </div>
  );
}
