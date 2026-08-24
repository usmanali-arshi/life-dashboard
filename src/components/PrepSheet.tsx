import { agoLabel, KIND_LABEL } from '@/lib/prep';
import type { Section, Sheet } from '@/lib/prep/types';

/* Server component — a cheat sheet is text you read, so there is nothing to
   hydrate and no reason to ship JS for it. */

const toneClass = (tone?: Section['tone']) =>
  tone === 'warn' ? 'prep-sec is-warn' : tone === 'good' ? 'prep-sec is-good' : 'prep-sec';

function Sections({ sections }: { sections: Section[] }) {
  return (
    <>
      {sections.map((s) => (
        <section className={toneClass(s.tone)} key={s.heading}>
          <h3>{s.heading}</h3>
          <ul>{s.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </section>
      ))}
    </>
  );
}

export function PrepSheet({ sheet }: { sheet: Sheet }) {
  return (
    <>
      <header className="pagehead">
        <div>
          <h1>{sheet.title}</h1>
          <div className="date">
            {KIND_LABEL[sheet.kind]}
            {sheet.source ? ` · ${sheet.source}` : ''} · updated {agoLabel(sheet.updated)}
          </div>
        </div>
        <a className="btn" href="/prep">All sheets</a>
      </header>

      <div className="prep-tags">
        {sheet.tags.map((t) => <span className="pill soon" key={t}>{t}</span>)}
        {sheet.sourceUrl && (
          <a className="prep-src" href={sheet.sourceUrl} target="_blank" rel="noreferrer">
            Original lesson ↗
          </a>
        )}
      </div>

      {sheet.kind === 'design' ? (
        <>
          <section className="card prep-gist">
            {sheet.gist.map((g, i) => <p key={i}>{g}</p>)}
          </section>

          {sheet.numbers && sheet.numbers.length > 0 && (
            <div className="prep-numbers">
              {sheet.numbers.map((n) => (
                <div className="tile" key={n.label}>
                  <div className="prep-num-v">{n.value}</div>
                  <div className="prep-num-l">{n.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <Sections sections={sheet.sections} />
          </div>

          {sheet.tradeoffs && sheet.tradeoffs.length > 0 && (
            <section className="card">
              <h2>Tradeoffs they will probe</h2>
              {sheet.tradeoffs.map((t) => (
                <div className="prep-trade" key={t.axis}>
                  <h3>{t.axis}</h3>
                  <div className="prep-trade-sides">
                    <p><span>A</span>{t.a}</p>
                    <p><span>B</span>{t.b}</p>
                  </div>
                  <p className="prep-pick"><strong>Your default:</strong> {t.pick}</p>
                </div>
              ))}
            </section>
          )}

          {sheet.quickfire && sheet.quickfire.length > 0 && (
            <section className="card">
              <h2>Quick-fire</h2>
              <dl className="prep-qa">
                {sheet.quickfire.map((qa) => (
                  <div key={qa.q}>
                    <dt>{qa.q}</dt>
                    <dd>{qa.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </>
      ) : (
        <>
          <section className="card prep-sec is-good">
            <h3>Reach for this when you see</h3>
            <ul>{sheet.triggers.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </section>

          {sheet.routing && sheet.routing.length > 0 && (
            <section className="card">
              <h2>Which template? — routing table</h2>
              <p className="prep-route-lead">
                Read the problem, find the row, write that skeleton. Picking right is most of the battle.
              </p>
              <div className="prep-routes">
                {sheet.routing.map((r) => (
                  <div className="prep-route" key={r.signal}>
                    <span className="prep-route-id">{r.use}</span>
                    <div>
                      <div className="prep-route-sig">{r.signal}</div>
                      <div className="prep-route-why">{r.why}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="card">
            <h2>Templates</h2>
            {sheet.template.map((t) => (
              <div className="prep-tpl" key={t.label}>
                <h3>
                  {t.id && <span className="prep-tpl-id">{t.id}</span>}
                  {t.label}
                </h3>
                {t.when && <p className="prep-tpl-when">{t.when}</p>}
                <pre><code>{t.code}</code></pre>
                {t.note && <p className="prep-note">{t.note}</p>}
              </div>
            ))}
            <p className="prep-cx">
              <strong>Time</strong> {sheet.complexity.time} · <strong>Space</strong> {sheet.complexity.space}
              {sheet.complexity.note ? ` — ${sheet.complexity.note}` : ''}
            </p>
          </section>

          {sheet.walkthrough && (
            <section className="card">
              <h2>{sheet.walkthrough.title}</h2>
              <ol className="prep-steps">
                {sheet.walkthrough.steps.map((st) => (
                  <li key={st.label}>
                    <h3>{st.label}</h3>
                    <p>{st.body}</p>
                    {st.code && <pre><code>{st.code}</code></pre>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div className="card">
            <Sections sections={sheet.sections} />
          </div>

          <section className="card">
            <h2>Problems that fit</h2>
            <div className="rowlist">
              {sheet.problems.map((p) => (
                <div className="row prep-prob" key={p.name}>
                  <div>
                    <div className="prep-prob-name">{p.name}</div>
                    <div className="prep-prob-twist">{p.twist}</div>
                  </div>
                  <span className={
                    p.difficulty === 'Easy' ? 'pill soon'
                      : p.difficulty === 'Medium' ? 'pill today' : 'pill overdue'
                  }>{p.difficulty}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
