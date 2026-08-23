import { agoLabel, KIND_LABEL, SHEETS, sheetsByKind } from '@/lib/prep';
import type { Sheet, SheetKind } from '@/lib/prep/types';
import { requireUser } from '@/lib/supabase/server';

/**
 * Content is compiled into the bundle, so this page *could* be prerendered —
 * but it must not be. Prep sheets are private study notes; a static route is
 * served without ever touching the session. Gated and dynamic, like every
 * other tab.
 */
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Prep · Life Dashboard' };

function Group({ kind }: { kind: SheetKind }) {
  const sheets = sheetsByKind(kind);
  if (!sheets.length) return null;
  return (
    <>
      <h2 className="prep-group">{KIND_LABEL[kind]}</h2>
      <div className="grid">
        {sheets.map((s: Sheet) => (
          <a className="card prep-card" href={`/prep/${s.slug}`} key={s.slug}>
            <h3>{s.title}</h3>
            <p className="prep-card-sub">
              {s.kind === 'pattern'
                ? `${s.problems.length} problems · ${s.template.length} templates`
                : `${s.sections.length} sections${s.quickfire ? ` · ${s.quickfire.length} quick-fire` : ''}`}
            </p>
            <div className="prep-tags">
              {s.tags.map((t) => <span className="pill soon" key={t}>{t}</span>)}
            </div>
            <p className="prep-card-age">updated {agoLabel(s.updated)}</p>
          </a>
        ))}
      </div>
    </>
  );
}

export default async function PrepPage() {
  const user = await requireUser();
  if (!user) {
    return (
      <div className="card" style={{ maxWidth: 420 }}>
        <h2>Sign in</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Sign in to read your prep sheets.
        </p>
        <a className="btn" href="/login">Sign in</a>
      </div>
    );
  }

  return (
    <>
      <header className="pagehead">
        <div>
          <h1>Prep</h1>
          <div className="date">
            {SHEETS.length} cheat {SHEETS.length === 1 ? 'sheet' : 'sheets'} · read one before the call
          </div>
        </div>
      </header>

      {SHEETS.length === 0 ? (
        <div className="card">
          <p className="empty">No sheets yet. Add a file under <code>src/lib/prep/sheets/</code> and
            register it in <code>src/lib/prep/index.ts</code>.</p>
        </div>
      ) : (
        <>
          <Group kind="design" />
          <Group kind="pattern" />
        </>
      )}
    </>
  );
}
