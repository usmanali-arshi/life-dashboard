import { notFound } from 'next/navigation';
import { PrepSheet } from '@/components/PrepSheet';
import { getSheet } from '@/lib/prep';
import { requireUser } from '@/lib/supabase/server';

/** Gated, so never prerendered — see the note in ../page.tsx. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sheet = getSheet(slug);
  return { title: sheet ? `${sheet.title} · Prep` : 'Prep' };
}

export default async function SheetPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  if (!user) {
    return (
      <div className="card" style={{ maxWidth: 420 }}>
        <h2>Sign in</h2>
        <a className="btn" href="/login">Sign in</a>
      </div>
    );
  }

  const { slug } = await params;
  const sheet = getSheet(slug);
  if (!sheet) notFound();
  return <PrepSheet sheet={sheet} />;
}
