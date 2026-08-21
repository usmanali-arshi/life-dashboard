import { TabBrief } from '@/components/TabBrief';
import { habitsBrief } from '@/lib/briefing/tabs';
import { getHabitsToday } from '@/lib/queries';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Last 28 days of entries, for the streak strip. */
async function recentEntries() {
  const sb = await supabaseServer();
  const from = new Date(Date.now() - 27 * 864e5).toISOString().slice(0, 10);
  const { data } = await sb.from('habit_entries').select('habit_id,on_date').gte('on_date', from);
  return data ?? [];
}

export default async function HabitsPage() {
  const [habits, entries] = await Promise.all([getHabitsToday(), recentEntries()]);

  const days = Array.from({ length: 28 }, (_, i) =>
    new Date(Date.now() - (27 - i) * 864e5).toISOString().slice(0, 10));
  const logged = new Set(entries.map((e) => `${e.habit_id}|${e.on_date}`));

  if (!habits.length) {
    return (
      <div className="card">
        <h2>Habits</h2>
        <p className="empty">No habits yet. Add rows to the <code>habits</code> table to get started —
          the add-habit form is step 8 in the build order.</p>
      </div>
    );
  }

  // Streaks are needed twice — once for the brief, once per card — so compute
  // them here rather than inside the map.
  const streakOf = (habitId: string) => {
    let n = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (logged.has(`${habitId}|${days[i]}`)) n++;
      else break;
    }
    return n;
  };

  return (
    <>
      <header className="pagehead">
        <div><h1>Habits</h1><div className="date">Last 28 days</div></div>
      </header>
    <TabBrief brief={habitsBrief(habits.map((h) => ({
      name: h.name, doneToday: h.doneToday, streak: streakOf(h.id),
    })))} />
    <div className="grid">
      {habits.map((h) => {
        const streak = streakOf(h.id);
        return (
          <section className="card" key={h.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 style={{ margin: 0 }}>{h.name}</h2>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {streak} day streak · {h.doneToday ? 'logged today' : 'not yet today'}
              </span>
            </div>
            {/* 28 binary states over time: a dot strip, not a chart. Each cell
                carries a title so the state is available without color. */}
            <div style={{ display: 'flex', gap: 3, marginTop: 14, flexWrap: 'wrap' }}>
              {days.map((d) => {
                const on = logged.has(`${h.id}|${d}`);
                return (
                  <span
                    key={d}
                    title={`${d}: ${on ? 'logged' : 'missed'}`}
                    style={{
                      width: 16, height: 16, borderRadius: 4,
                      background: on ? h.color : 'var(--surface-2)',
                      border: on ? 'none' : '1px solid var(--border)',
                    }}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
    </>
  );
}
