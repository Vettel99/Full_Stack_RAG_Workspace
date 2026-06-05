'use server';

import { revalidatePath } from 'next/cache';
import type { UIMessage } from 'ai';
import { createClient } from '@/utils/supabase/server';

type HistoryResult = { chatId: string | null; messages: UIMessage[] };

export async function getChatHistory(chatId?: string): Promise<HistoryResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { chatId: null, messages: [] };

  let targetId = chatId ?? null;

  if (!targetId) {
    const { data: recent } = await supabase
      .from('chats')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    targetId = recent?.id ?? null;
  }

  if (!targetId) return { chatId: null, messages: [] };

  // Verify ownership
  const { data: chat } = await supabase
    .from('chats')
    .select('id')
    .eq('id', targetId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!chat) return { chatId: null, messages: [] };

  const { data: rows } = await supabase
    .from('messages')
    .select('id, role, content')
    .eq('chat_id', targetId)
    .order('created_at', { ascending: true });

  const messages: UIMessage[] = (rows ?? []).map((row) => ({
    id: row.id as string,
    role: row.role as 'user' | 'assistant',
    parts: (row.content as { parts: UIMessage['parts'] }).parts,
  }));

  return { chatId: targetId, messages };
}

export async function deleteChat(chatId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  // Delete the chat — messages cascade automatically via FK (documents untouched)
  const { error: chatError } = await supabase
    .from('chats')
    .delete()
    .eq('id', chatId)
    .eq('user_id', user.id);

  if (chatError) throw new Error(chatError.message);

  revalidatePath('/');
}
