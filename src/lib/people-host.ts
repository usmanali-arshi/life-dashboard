import { NotSignedInError, type PeopleHost } from '@/features/people/host';
import { supabaseServer } from './supabase/server';

/** Dashboard's implementation of the People seam. Request-scoped; build one per request. */
export async function createPeopleHost(): Promise<PeopleHost> {
  const sb = await supabaseServer();
  return {
    async getUserId() {
      const { data, error } = await sb.auth.getUser();
      if (error || !data.user) throw new NotSignedInError();
      return data.user.id;
    },
    db: () => sb,
  };
}
