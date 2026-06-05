'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';

// One entry per unique document_name (not per chunk)
export type DocumentGroup = {
  document_name: string;
  chunk_count: number;
};

// Returns unique documents grouped by filename.
// Only fetches id + document_name — no content or embedding — for efficiency.
export async function getIngestedDocuments(): Promise<DocumentGroup[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from('documents')
    .select('id, document_name')
    .eq('user_id', user.id)
    .not('document_name', 'is', null);

  if (error) throw new Error(error.message);

  // Group by document_name in JS — PostgREST does not support GROUP BY
  const grouped = new Map<string, DocumentGroup>();
  for (const row of data ?? []) {
    const name = row.document_name as string;
    if (!grouped.has(name)) {
      grouped.set(name, { document_name: name, chunk_count: 0 });
    }
    grouped.get(name)!.chunk_count++;
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.document_name.localeCompare(b.document_name),
  );
}

// Looks up the stored file for a document and returns a short-lived signed URL
// that downloads the exact original PDF. Called client-side before redirecting.
export async function getDocumentDownloadUrl(documentName: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data: row, error } = await supabase
    .from('documents')
    .select('file_path')
    .eq('user_id', user.id)
    .eq('document_name', documentName)
    .not('file_path', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const filePath = row?.file_path as string | undefined;
  if (!filePath) {
    throw new Error('Original file is not available for this document.');
  }

  // 60s signed URL; the `download` option forces an attachment with the right name.
  const { data: signed, error: signError } = await supabase.storage
    .from('vault')
    .createSignedUrl(filePath, 60, { download: documentName });

  if (signError || !signed) {
    throw new Error(signError?.message ?? 'Could not create download link.');
  }

  return signed.signedUrl;
}

// Collects the distinct stored file paths for a set of document rows.
async function collectFilePaths(
  rows: { file_path: string | null }[] | null,
): Promise<string[]> {
  return Array.from(
    new Set((rows ?? []).map((r) => r.file_path).filter((p): p is string => !!p)),
  );
}

// Deletes ALL chunks that share the given document_name for this user, and
// removes the original file from storage first to avoid orphaned files.
export async function deleteSingleDocument(documentName: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data: rows } = await supabase
    .from('documents')
    .select('file_path')
    .eq('user_id', user.id)
    .eq('document_name', documentName);

  const paths = await collectFilePaths(rows);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from('vault').remove(paths);
    if (storageError) throw new Error(`Storage cleanup failed: ${storageError.message}`);
  }

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('document_name', documentName)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath('/');
}

// Removes every document for this user from both storage and the table.
export async function purgeAllDocuments(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { data: rows } = await supabase
    .from('documents')
    .select('file_path')
    .eq('user_id', user.id);

  const paths = await collectFilePaths(rows);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from('vault').remove(paths);
    if (storageError) throw new Error(`Storage cleanup failed: ${storageError.message}`);
  }

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath('/');
}
