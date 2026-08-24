/**
 * Provider abstraction.
 *
 * The point of these interfaces is that "add Todoist" or "support Outlook
 * users" becomes one new file implementing an existing contract, plus a line
 * in the registry — not a schema migration and a UI rewrite. Written this way
 * from day one because the multi-user phase needs it and retrofitting an
 * abstraction over concrete Google calls is far more expensive.
 */

export interface LinkedAccount {
  id: string;
  user_id: string;
  provider: string;
  provider_user_id: string;
  email: string;
  label: string | null;
  color: string;
  refresh_token_enc: string;
  scopes: string[];
  status: 'active' | 'reauth_required';
  last_synced_at: string | null;
}

export interface NormalizedEvent {
  externalId: string;
  calendarId: string;
  title: string | null;
  description?: string | null;
  location?: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  status?: string | null;
  responseStatus?: string | null;
  attendeeCount: number;
  conferenceUrl?: string | null;
  htmlLink?: string | null;
  deleted: boolean;
}

export interface NormalizedThread {
  externalId: string;
  subject: string | null;
  fromName: string | null;
  fromEmail: string | null;
  snippet: string | null;
  isUnread: boolean;
  isImportant: boolean;
  isStarred: boolean;
  needsReply: boolean;
  lastMessageAt: Date;
  lastFromMe: boolean;
  messageCount: number;
  webUrl: string | null;
}

export interface NormalizedTask {
  externalId: string;
  /** Provider-side container id (Google Tasks list, Todoist project, …).
   *  Required to write the task back — without it, updates have to guess. */
  listId?: string | null;
  title: string;
  notes?: string | null;
  due?: Date | null;
  dueIsDateOnly: boolean;
  completed: boolean;
  completedAt?: Date | null;
  priority?: 1 | 2 | 3 | 4 | null;
  projectName?: string | null;
  url?: string | null;
}

export interface TaskRef { listId: string; taskId: string; }

export interface TaskPatch {
  title?: string;
  notes?: string | null;
  /** null clears the due date; undefined leaves it alone. */
  due?: Date | null;
}

export interface TaskList { id: string; title: string; }

/** Result of an incremental pull: items plus the cursor to store for next time. */
export interface SyncResult<T> {
  items: T[];
  cursor: string | null;
  /** True when the provider invalidated our cursor and we did a full refetch. */
  resynced?: boolean;
}

export interface CalendarProvider {
  readonly id: string;
  fetchEvents(accessToken: string, cursor: string | null): Promise<SyncResult<NormalizedEvent>>;
}

export interface MailProvider {
  readonly id: string;
  fetchThreads(accessToken: string, cursor: string | null, selfEmail: string): Promise<SyncResult<NormalizedThread>>;
}

export interface TaskProvider {
  readonly id: string;
  listTasks(accessToken: string): Promise<SyncResult<NormalizedTask>>;
  listTaskLists(accessToken: string): Promise<TaskList[]>;
  createTaskList(accessToken: string, title: string): Promise<TaskList>;
  /** Rename an existing list. Writes through to the provider, so the new name
   *  shows up everywhere the user looks at these tasks, not just here. */
  renameTaskList(accessToken: string, listId: string, title: string): Promise<TaskList>;
  /** completed=false un-completes, so the checkbox is a toggle rather than a
   *  one-way door. */
  setCompleted(accessToken: string, ref: TaskRef, completed: boolean): Promise<void>;
  updateTask(accessToken: string, ref: TaskRef, patch: TaskPatch): Promise<void>;
  createTask(
    accessToken: string,
    listId: string | null,
    task: { title: string; notes?: string | null; due?: Date | null },
  ): Promise<NormalizedTask>;
}
