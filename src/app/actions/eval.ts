'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

// Deletes ONLY the current user's eval_runs (eval_details cascade via FK).
// Scoped by user_id so one tenant cannot wipe another tenant's history.
export async function clearEvaluationHistory(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('eval_runs')
    .delete()
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath('/evaluation/dashboard');
}
