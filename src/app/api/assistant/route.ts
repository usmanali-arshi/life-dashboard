import { NextResponse } from 'next/server';
import { loadLlm } from '@/lib/llm';
import { LlmError, type LlmMessage } from '@/lib/llm/types';
import {
  buildLlmContext, deterministicAnswer, SYSTEM_PROMPT, type TaskLite,
} from '@/lib/scheduling/assistant';
import { findSlots } from '@/lib/scheduling/slots';
import { getEventsRange, getProfile, getTasks } from '@/lib/queries';
import { requireUser, supabaseServer } from '@/lib/supabase/server';
import { addDays, startOfDayUTC, todayKey } from '@/lib/tz';

export const runtime = 'nodejs';
export const maxDuration = 45;
export const dynamic = 'force-dynamic';

const HORIZON_DAYS = 8;      // today + 7
const MAX_QUESTION = 500;
const MAX_TURNS = 6;         // keeps the prompt (and the user's bill) bounded

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const question = String(body.question ?? '').trim().slice(0, MAX_QUESTION);
  if (!question) return NextResponse.json({ error: 'ask something' }, { status: 400 });

  const history: LlmMessage[] = Array.isArray(body.history)
    ? body.history.slice(-MAX_TURNS).filter((m: any) =>
        (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    : [];

  const profile = await getProfile();
  const tz = profile?.timezone ?? 'America/New_York';
  const start = todayKey(tz);

  const sb = await supabaseServer();
  const [events, tasks, { data: activities }, { data: habits }] = await Promise.all([
    getEventsRange(
      startOfDayUTC(start, tz).toISOString(),
      startOfDayUTC(addDays(start, HORIZON_DAYS), tz).toISOString(),
    ),
    getTasks(tz),
    sb.from('activities')
      .select('name,duration_minutes,earliest_hour,latest_hour,days_of_week')
      .eq('archived', false).order('name'),
    // Habits with a duration are schedulable too — no reason to re-enter "Gym"
    // in two places.
    sb.from('habits')
      .select('name,duration_minutes')
      .eq('archived', false).not('duration_minutes', 'is', null),
  ]);

  const catalog = [
    ...(activities ?? []),
    ...(habits ?? []).map((h) => ({
      name: h.name,
      duration_minutes: h.duration_minutes as number,
      earliest_hour: null, latest_hour: null, days_of_week: [],
    })),
  ].filter((a, i, arr) => arr.findIndex((x) => x.name === a.name) === i);

  const flat: TaskLite[] = [
    ...tasks.overdue.map((t) => ({ title: t.title, due: t.due, bucket: 'overdue' as const,
      account: t.linked_accounts?.label })),
    ...tasks.dueToday.map((t) => ({ title: t.title, due: t.due, bucket: 'today' as const,
      account: t.linked_accounts?.label })),
    ...tasks.tomorrow.map((t) => ({ title: t.title, due: t.due, bucket: 'tomorrow' as const,
      account: t.linked_accounts?.label })),
    ...tasks.later.map((t) => ({ title: t.title, due: t.due, bucket: 'later' as const,
      account: t.linked_accounts?.label })),
    ...tasks.unscheduled.map((t) => ({ title: t.title, due: null, bucket: 'unscheduled' as const,
      account: t.linked_accounts?.label })),
  ];

  const now = new Date();
  const days = findSlots(events, tz, HORIZON_DAYS, now);
  const ctx = { now, tz, days, activities: catalog, tasks: flat };

  // Always computed, so there is a real answer even if the model is absent or
  // the provider is down.
  const fallback = deterministicAnswer(question, ctx);
  const llm = await loadLlm();

  if (!llm) {
    return NextResponse.json({
      answer: fallback, source: 'rules',
      hint: 'Connect an API key on the Accounts page for full natural-language answers.',
      slots: days,
    });
  }

  try {
    const answer = await llm.provider.complete(llm.apiKey, llm.model, {
      system: SYSTEM_PROMPT,
      messages: [
        ...history,
        { role: 'user', content: `${buildLlmContext(ctx)}\n\nQUESTION: ${question}` },
      ],
      maxTokens: 500,
    });
    return NextResponse.json({
      answer: answer || fallback,
      source: llm.provider.id,
      model: llm.model,
      slots: days,
    });
  } catch (e) {
    // Never fail the request because someone's key ran out of credit — answer
    // deterministically and say why it's the lesser answer.
    const message = e instanceof LlmError ? e.message : 'The model call failed.';
    return NextResponse.json({
      answer: fallback, source: 'rules', warning: message, slots: days,
    });
  }
}
