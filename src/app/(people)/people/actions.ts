'use server';

import { revalidatePath } from 'next/cache';
import * as people from '@/features/people/actions';
import type { ActionResult, Contact } from '@/features/people/types';
import { createPeopleHost } from '@/lib/people-host';

// Errors thrown from server actions are masked in production, so every action
// returns a result object with the real message instead.
async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath('/people');
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function createContactAction(input: people.ContactInput): Promise<ActionResult<Contact>> {
  return run(async () => people.createContact(await createPeopleHost(), input));
}

export async function updateContactAction(id: string, input: people.ContactInput): Promise<ActionResult<Contact>> {
  return run(async () => people.updateContact(await createPeopleHost(), id, input));
}

export async function deleteContactAction(id: string): Promise<ActionResult<void>> {
  return run(async () => people.deleteContact(await createPeopleHost(), id));
}

export async function setContactPhotoAction(id: string, form: FormData): Promise<ActionResult<Contact>> {
  return run(async () => {
    const file = form.get('photo');
    if (!(file instanceof Blob)) throw new Error('No photo received');
    return people.setContactPhoto(await createPeopleHost(), id, file);
  });
}

export async function removeContactPhotoAction(id: string): Promise<ActionResult<Contact>> {
  return run(async () => people.removeContactPhoto(await createPeopleHost(), id));
}
