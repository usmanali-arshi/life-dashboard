import { AccountFilter } from '@/components/AccountFilter';
import { AddTask } from '@/components/AddTask';
import { TaskBlock } from '@/components/TaskBlock';
import type { TaskRow } from '@/components/TaskItem';
import { TabBrief } from '@/components/TabBrief';
import { tasksBrief } from '@/lib/briefing/tabs';
import { getAccounts, getCompletedToday, getProfile, getTasks } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const profile = await getProfile();
  const tz = profile?.timezone ?? 'America/New_York';

  /** "Tue, Aug 18" for today + n days, in the user's zone. */
  const dateLabel = (offsetDays: number) =>
    new Date(Date.now() + offsetDays * 864e5).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: tz,
    });
  const [tasks, accounts, doneToday] = await Promise.all([
    getTasks(tz), getAccounts(), getCompletedToday(tz),
  ]);

  return (
    <>
      <header className="pagehead">
        <div>
          <h1>Tasks</h1>
          <div className="date">
            {tasks.overdue.length} overdue · {tasks.dueToday.length} today
            {tasks.tomorrow.length > 0 && ` · ${tasks.tomorrow.length} tomorrow`}
            {doneToday.length > 0 && ` · ${doneToday.length} done`}
          </div>
        </div>
        <AddTask />
      </header>

      <AccountFilter accounts={accounts} />
      <TabBrief brief={tasksBrief({ ...tasks, doneToday: doneToday.length })} />

      <div className="grid">
        {tasks.overdue.length > 0 && (
          <TaskBlock title="Overdue" tone="critical"
                     tasks={tasks.overdue as TaskRow[]} tz={tz} />
        )}
        <TaskBlock title="Today" subtitle={dateLabel(0)}
                   tasks={tasks.dueToday as TaskRow[]} tz={tz} />
        <TaskBlock title="Tomorrow" subtitle={dateLabel(1)}
                   tasks={tasks.tomorrow as TaskRow[]} tz={tz} />
        <TaskBlock title="Later" tasks={tasks.later as TaskRow[]} tz={tz}
                   defaultOpen={tasks.later.length <= 10} />
        <TaskBlock title="Unscheduled" tasks={tasks.unscheduled as TaskRow[]} tz={tz}
                   defaultOpen={tasks.unscheduled.length <= 10} />
        {doneToday.length > 0 && (
          <TaskBlock title="Completed today" tasks={doneToday as TaskRow[]} tz={tz}
                     defaultOpen={false} />
        )}
      </div>
    </>
  );
}
