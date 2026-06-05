import { NextRequest } from 'next/server';
import {
  streamText,
  generateText,
  embed,
  convertToModelMessages,
  isTextUIPart,
  createUIMessageStream,
  createUIMessageStreamResponse,
  UIMessage,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { createClient } from '@/utils/supabase/server';

// One source reference per retrieved chunk, matching the [^n] citation index.
type CitationSource = {
  index: number;
  document_name: string | null;
  snippet: string;
};

const SNIPPET_MAX = 280;

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const {
    messages,
    chatId: incomingChatId,
  }: { messages: UIMessage[]; chatId?: string } = await req.json();

  const chatId = incomingChatId ?? crypto.randomUUID();

  // Ensure a chat row exists for this session
  const { data: existingChat } = await supabase
    .from('chats')
    .select('id')
    .eq('id', chatId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existingChat) {
    const firstText =
      messages
        .find((m) => m.role === 'user')
        ?.parts.filter(isTextUIPart)
        .map((p) => p.text)
        .join('')
        .slice(0, 60) ?? 'New Chat';

    await supabase.from('chats').insert({
      id: chatId,
      user_id: user.id,
      title: firstText || 'New Chat',
    });
  }

  // Save the incoming user message (always the last one in the array)
  const lastMessage = messages[messages.length - 1];
  const lastText = lastMessage.parts.filter(isTextUIPart).map((p) => p.text).join('');

  await supabase.from('messages').insert({
    chat_id: chatId,
    role: lastMessage.role,
    content: { parts: lastMessage.parts },
  });

  // HyDE: expand query into a hypothetical document for better retrieval
  const { text: hypotheticalDoc } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt:
      `The user is about to search a vector database with this query: ${lastText}\n\n` +
      `Generate a short, hypothetical paragraph containing the keywords and concepts ` +
      `that would likely be found in a document answering this query. ` +
      `Do not answer the question, just provide the expected document text.`,
  });

  console.log('Original query:', lastText);
  console.log('HyDE hypothetical document:', hypotheticalDoc);

  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: hypotheticalDoc,
  });

  const { data: documents, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_count: 15,
    match_threshold: 0.3,
    filter_user_id: user.id,
  });

  console.log('Supabase Error:', error);
  console.log('Retrieved chunks count:', documents?.length);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!documents || documents.length === 0) {
    console.warn('No context retrieved for query:', lastText);
  }

  const matched = (documents ?? []) as { id: string; content: string; similarity: number }[];

  // The RPC returns only id/content/similarity — fetch parent document names separately.
  let nameById = new Map<string, string | null>();
  if (matched.length > 0) {
    const { data: meta } = await supabase
      .from('documents')
      .select('id, document_name')
      .in('id', matched.map((m) => m.id));
    nameById = new Map((meta ?? []).map((row) => [row.id as string, (row.document_name as string | null) ?? null]));
  }

  // Context packing: retrieval now returns up to 15 chunks, but we cap the
  // combined context at ~15k chars (~3.5k tokens) to avoid prompt bloat and
  // latency spikes. Chunks are already ordered most-relevant-first, so we pack
  // greedily and stop before the budget is exceeded (always keeping ≥1 chunk).
  const MAX_CONTEXT_CHARS = 15_000;
  const packed: typeof matched = [];
  let totalChars = 0;
  for (const m of matched) {
    if (packed.length > 0 && totalChars + m.content.length > MAX_CONTEXT_CHARS) break;
    packed.push(m);
    totalChars += m.content.length;
  }

  console.log(`Context packed: ${packed.length}/${matched.length} chunks, ${totalChars} chars`);

  // Build the 1-indexed source list that the [^n] citations refer to.
  // Derived from `packed` so citation indices match exactly what the model sees.
  const sources: CitationSource[] = packed.map((m, i) => ({
    index: i + 1,
    document_name: nameById.get(m.id) ?? null,
    snippet: m.content.length > SNIPPET_MAX ? m.content.slice(0, SNIPPET_MAX).trimEnd() + '…' : m.content,
  }));

  // Numbered context so the model can cite chunks by their index.
  const numberedContext = packed
    .map((m, i) => `[${i + 1}] ${m.content}`)
    .join('\n\n');

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system:
      `You are a helpful assistant. Answer the user's question using ONLY the context below. ` +
      `If the context does not contain the answer, say you don't have enough information to answer.\n\n` +
      `You must back up your statements using the provided context chunks. Every time you use ` +
      `information from a chunk, append an inline citation in the format [^1], [^2], etc., ` +
      `corresponding to the index of that chunk in the context list below.\n` +
      `Do not invent citations. Only cite the specific documents provided.\n\n` +
      `Context:\n${numberedContext}`,
    messages: await convertToModelMessages(messages),
    async onFinish({ text }) {
      // Persist both the text and the source list so citations survive a reload.
      await supabase.from('messages').insert({
        chat_id: chatId,
        role: 'assistant',
        content: { parts: [{ type: 'text', text }, { type: 'data-sources', data: sources }] },
      });
    },
  });

  // Wrap the text stream so we can also push the source metadata as a data part.
  const stream = createUIMessageStream<UIMessage>({
    execute: ({ writer }) => {
      writer.write({ type: 'data-sources', id: 'sources', data: sources });
      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream });
}
