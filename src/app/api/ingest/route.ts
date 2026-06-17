import "pdf-parse/worker";
import { NextRequest } from 'next/server';
import { PDFParse } from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createClient } from '@/utils/supabase/server';

// Overlapping chunks preserve context that spans boundaries: each chunk shares
// 200 chars with its neighbours so a sentence cut mid-thought still has continuity.
async function chunkText(text: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunks = await splitter.splitText(text);
  return chunks.map((c) => c.trim()).filter((c) => c.length > 0);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return Response.json({ error: 'A file is required' }, { status: 400 });
  }
  if (file.type !== 'application/pdf') {
    return Response.json({ error: 'Only PDF files are supported' }, { status: 400 });
  }

  // Upload the original file to the "vault" bucket before extracting text.
  // Path is namespaced by user id (matches the storage RLS policy) + timestamp.
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const filePath = `${user.id}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('vault')
    .upload(filePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return Response.json(
      { error: `File upload failed: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const buffer = await file.arrayBuffer();
  const parser = new PDFParse({ data: buffer });
  let rawText: string;
  try {
    const result = await parser.getText();
    rawText = result.text;
  } finally {
    await parser.destroy();
  }

  const chunks = await chunkText(rawText);

  if (chunks.length === 0) {
    // No vectors to store — remove the just-uploaded file so it isn't orphaned.
    await supabase.storage.from('vault').remove([filePath]);
    return Response.json({ error: 'No readable text found in the PDF' }, { status: 400 });
  }

  const { embeddings } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: chunks,
  });

  const rows = chunks.map((content, i) => ({
    content,
    embedding: embeddings[i],
    user_id: user.id,
    document_name: file.name,
    file_path: filePath,
  }));

  const { error } = await supabase.from('documents').insert(rows);

  if (error) {
    // Insert failed — remove the uploaded file to avoid an orphan in storage.
    await supabase.storage.from('vault').remove([filePath]);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ingested: chunks.length });
}
