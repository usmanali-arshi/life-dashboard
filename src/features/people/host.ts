import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The seam between People and whatever app hosts it. The dashboard implements
 * this in one file; a standalone app would implement it with its own auth.
 * People never imports dashboard code.
 */
export interface PeopleHost {
  /** Throws if not signed in. */
  getUserId(): Promise<string>;
  /** RLS-scoped client — never the secret key. */
  db(): SupabaseClient;
}

export class NotSignedInError extends Error {
  constructor() {
    super('Not signed in');
    this.name = 'NotSignedInError';
  }
}
