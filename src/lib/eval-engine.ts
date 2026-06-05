import { generateText, generateObject, embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared Supabase client (anon key — eval tables have no RLS requirement)
// ---------------------------------------------------------------------------

function makeSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
}

// ---------------------------------------------------------------------------
// Dynamic golden dataset — generated from actual ingested documents
// userId is optional: passed from API routes for user isolation,
// omitted from the CLI so it can query across all documents.
// ---------------------------------------------------------------------------

const qaGenerationSchema = z.object({
  pairs: z
    .array(
      z.object({
        question: z.string().describe('A specific, answerable question derivable from the text'),
        expectedAnswer: z
          .string()
          .describe('The ideal answer, derived strictly from the provided text'),
      }),
    )
    .min(1)
    .max(3),
});

async function generateGoldenDataset(
  userId?: string,
): Promise<{ question: string; expectedAnswer: string }[]> {
  const supabase = makeSupabase();

  let query = supabase.from('documents').select('content').limit(10);
  if (userId) query = query.eq('user_id', userId);

  const { data: rows, error } = await query;

  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
  if (!rows || rows.length === 0) {
    throw new Error(
      'No documents found in the knowledge base. Ingest content before running eval.',
    );
  }

  const shuffled = [...rows].sort(() => Math.random() - 0.5);
  const sampled = shuffled.slice(0, Math.min(3, shuffled.length));
  const targetCount = sampled.length;

  console.log(`[Dataset]  Generating ${targetCount} Q&A pairs from ${rows.length} available chunks…`);

  const chunksText = sampled
    .map((c, i) => `--- Chunk ${i + 1} ---\n${c.content}`)
    .join('\n\n');

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: qaGenerationSchema,
    prompt:
      `You are building a golden evaluation dataset for a RAG system.\n\n` +
      `Here are ${targetCount} text excerpt(s) from the knowledge base:\n\n` +
      `${chunksText}\n\n` +
      `Based STRICTLY on the information in these excerpts, generate exactly ${targetCount} realistic ` +
      `test questions and their ideal golden answers. Questions must be specific and fully answerable ` +
      `from the text. Do not invent any information not present in the excerpts.`,
  });

  console.log(`[Dataset]  Generated ${object.pairs.length} Q&A pair(s).`);
  return object.pairs;
}

// ---------------------------------------------------------------------------
// Judge schema
// ---------------------------------------------------------------------------

const judgeSchema = z.object({
  score: z
    .number()
    .min(0)
    .max(10)
    .describe('Accuracy score: 0 = completely wrong, 10 = perfect match'),
  reasoning: z.string().describe('One sentence explaining the score'),
});

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type EvalDetailResult = {
  question: string;
  expectedAnswer: string;
  actualAnswer: string;
  score: number;
  reasoning: string;
};

export type EvalEngineResult = {
  runId: string;
  averageScore: number;
  details: EvalDetailResult[];
};

// ---------------------------------------------------------------------------
// Pipeline helpers
// ---------------------------------------------------------------------------

async function getRagAnswer(question: string, userId?: string): Promise<string> {
  const supabase = makeSupabase();

  const { text: hypotheticalDoc } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt:
      `The user is about to search a vector database with this query: ${question}\n\n` +
      `Generate a short, hypothetical paragraph containing the keywords and concepts ` +
      `that would likely be found in a document answering this query. ` +
      `Do not answer the question, just provide the expected document text.`,
  });

  console.log(`  [HyDE]      ${hypotheticalDoc.slice(0, 110).replace(/\n/g, ' ')}…`);

  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: hypotheticalDoc,
  });

  const rpcParams: Record<string, unknown> = {
    query_embedding: embedding,
    match_count: 5,
    match_threshold: 0.3,
  };
  if (userId) rpcParams.filter_user_id = userId;

  const { data: documents, error } = await supabase.rpc('match_documents', rpcParams);

  if (error) throw new Error(`Supabase RPC error: ${error.message}`);

  const chunks = (documents ?? []) as { content: string }[];
  console.log(`  [Retrieved]  ${chunks.length} chunk(s)`);

  const context = chunks.map((d) => d.content).join('\n\n---\n\n');

  const { text: answer } = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    system:
      `You are a helpful assistant. Answer the user's question using ONLY the context below. ` +
      `If the context does not contain the answer, say you don't have enough information to answer.\n\n` +
      `Context:\n${context}`,
    prompt: question,
  });

  return answer;
}

async function judgeAnswer(
  question: string,
  expectedAnswer: string,
  actualAnswer: string,
): Promise<{ score: number; reasoning: string }> {
  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: judgeSchema,
    prompt:
      `You are an objective evaluator for a RAG (Retrieval-Augmented Generation) system.\n\n` +
      `Question: ${question}\n` +
      `Expected Answer: ${expectedAnswer}\n` +
      `Actual Answer: ${actualAnswer}\n\n` +
      `Score the actual answer from 0 to 10 based on factual accuracy and completeness ` +
      `relative to the expected answer.`,
  });

  return object;
}

// ---------------------------------------------------------------------------
// Exportable engine
// userId is optional: pass it from API routes for user isolation;
// omit it from the CLI to query across all documents.
// ---------------------------------------------------------------------------

export async function runEvaluationEngine(userId?: string): Promise<EvalEngineResult> {
  // eval_runs.user_id is NOT NULL, so persistence requires a user. Fail fast
  // before spending on LLM calls rather than hitting a DB constraint at the end.
  if (!userId) {
    throw new Error(
      'runEvaluationEngine requires a userId to persist results (eval_runs.user_id is NOT NULL). ' +
        'Run evaluations from the authenticated dashboard, or pass a user id explicitly.',
    );
  }

  const supabase = makeSupabase();
  const scored: EvalDetailResult[] = [];

  const goldenDataset = await generateGoldenDataset(userId);

  for (let i = 0; i < goldenDataset.length; i++) {
    const item = goldenDataset[i];
    console.log(`[${i + 1}/${goldenDataset.length}] ${item.question}`);

    const actualAnswer = await getRagAnswer(item.question, userId);
    console.log(`  [Answer]    ${actualAnswer.slice(0, 110).replace(/\n/g, ' ')}…`);

    const judgment = await judgeAnswer(item.question, item.expectedAnswer, actualAnswer);
    console.log(`  [Judge]     ${judgment.score}/10 — ${judgment.reasoning}\n`);

    scored.push({
      question: item.question,
      expectedAnswer: item.expectedAnswer,
      actualAnswer,
      score: judgment.score,
      reasoning: judgment.reasoning,
    });
  }

  const averageScore = scored.reduce((sum, s) => sum + s.score, 0) / scored.length;

  const { data: run, error: runError } = await supabase
    .from('eval_runs')
    .insert({ average_score: averageScore, user_id: userId })
    .select()
    .single();

  if (runError) throw new Error(`Failed to insert eval_run: ${runError.message}`);

  const { error: detailError } = await supabase.from('eval_details').insert(
    scored.map((s) => ({
      run_id: run.id,
      question: s.question,
      expected_answer: s.expectedAnswer,
      actual_answer: s.actualAnswer,
      score: s.score,
      reasoning: s.reasoning,
    })),
  );

  if (detailError) throw new Error(`Failed to insert eval_details: ${detailError.message}`);

  console.log(`✓ Saved — run ID: ${run.id}`);

  return { runId: run.id as string, averageScore, details: scored };
}
