import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { runEvaluationEngine } from '@/lib/eval-engine';

export const maxDuration = 300;

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Guard: abort immediately if the user has no ingested documents
  const { count, error: countError } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (countError || !count || count === 0) {
    return Response.json(
      {
        error:
          'No documents found. Please ingest a PDF document before running an evaluation.',
      },
      { status: 400 },
    );
  }

  const result = await runEvaluationEngine(user.id);
  return Response.json(result);
}
