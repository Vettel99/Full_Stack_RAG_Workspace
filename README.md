# 🧠 Enterprise RAG Workspace with Dynamic Evals

A production-grade, multi-tenant **Retrieval-Augmented Generation** platform where teams upload their own documents, chat against them with **inline source citations**, and measure answer quality with a **self-generating LLM evaluation harness** — all behind per-user data isolation.

This isn't a toy "chat with your PDF" demo. It's a full-stack AI application that takes RAG seriously: query transformation (HyDE), overlapping recursive chunking, a character-budgeted context window, citation-grounded responses, original-file storage, and an automated **eval pipeline** that builds golden datasets from your own data and scores the system with an LLM judge.

> Built with Next.js 16 (App Router), the Vercel AI SDK v6, Supabase (pgvector + Auth + Storage), OpenAI, and Anthropic Claude.

---

## ✨ Features

| Capability | What it does |
|---|---|
| 🔐 **Multi-Tenant Security** | Supabase Auth (email/password) + middleware-protected routes. Every document, chat, message, and eval run is scoped to the owning `user_id`; vector search is filtered per-user and Supabase Storage uses per-folder RLS policies so tenants can never read each other's data. |
| 📄 **PDF → Vector Pipeline** | Upload a PDF; the original is stored in a private Storage bucket, the text is extracted (`pdf-parse`), chunked, embedded with OpenAI, and written to a `pgvector` column for cosine-similarity search. |
| 🧬 **Advanced RAG (HyDE + Chunking)** | **HyDE** (Hypothetical Document Embeddings): the user's query is expanded into a hypothetical answer paragraph before embedding, dramatically improving recall on sparse questions. Text is split with LangChain's `RecursiveCharacterTextSplitter` (1000-char chunks, 200-char overlap) so context that spans boundaries is never lost. Retrieval pulls the top 15 matches, then a character-budgeted packer fills ~15k chars of the most relevant context without overflowing the prompt. |
| 🔗 **Inline Citations** | The model is instructed to cite chunks as `[^1]`, `[^2]`. The UI parses these into interactive citation badges — hover to see the exact source passage in a popover, and the corresponding file highlights in the Knowledge Base panel. |
| 🧪 **Synthetic Evaluation Engine** | A one-click (or CLI) pipeline that samples your ingested chunks, has an LLM **generate a golden Q&A dataset** from them, runs each question through the full RAG stack, then uses **GPT-4o as an LLM judge** to score accuracy 0–10 with reasoning. Results are persisted and visualized on an admin dashboard with run history and per-question breakdowns. |
| 🎨 **Premium UI/UX** | Built on **shadcn/ui** (New York / Radix) with a vibrant custom dark theme, glassmorphism cards, an animated **Aurora / masked-grid** background, and full **Markdown rendering** (GFM tables, lists, code) in chat. |

---

## 🛠 Tech Stack

**Frontend**
- [Next.js 16](https://nextjs.org/) (App Router, Server Components, Server Actions) on Turbopack
- React 19 + TypeScript
- Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com/) (Radix primitives)
- `react-markdown` + `remark-gfm` + `@tailwindcss/typography` for rich chat rendering
- `lucide-react` icons, CSS-only animated aurora/grid backgrounds

**Backend**
- Next.js Route Handlers & Server Actions (Node runtime)
- [Vercel AI SDK v6](https://sdk.vercel.ai/) (`ai`, `@ai-sdk/react`) for streaming, structured output, and embeddings
- `@supabase/ssr` for cookie-based auth on the server
- `pdf-parse` (text extraction) + `@langchain/textsplitters` (recursive overlap chunking)
- `zod` for structured-output schemas

**Database & Infrastructure**
- [Supabase](https://supabase.com/) — Postgres + **pgvector**, Auth, and Storage
- `match_documents` SQL function for cosine-similarity vector search (per-user filtered)
- Row-scoped tables (`documents`, `chats`, `messages`, `eval_runs`, `eval_details`) + Storage RLS

**AI / Models**
- **OpenAI** — `text-embedding-3-small` (1536-dim embeddings), `gpt-4o-mini` (HyDE + golden-dataset generation), `gpt-4o` (LLM judge)
- **Anthropic** — `claude-sonnet-4-6` (grounded chat answers + eval answer generation)

---

## 🚀 Local Setup Guide

### Prerequisites
- **Node.js ≥ 20** (developed on v22)
- A free [Supabase](https://supabase.com/) project
- API keys for [OpenAI](https://platform.openai.com/) and [Anthropic](https://console.anthropic.com/)

### 1. Clone & install

```bash
git clone <your-repo-url> eval-driven-rag-workspace
cd eval-driven-rag-workspace
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```bash
# OpenAI — embeddings, HyDE, dataset generation, LLM judge
OPENAI_API_KEY=sk-proj-xxxxxxxx

# Anthropic — grounded chat + eval answer generation
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx

# Supabase — server-side (Project Settings → API)
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>

# Supabase — client-side (same values, exposed to the browser)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

> ⚠️ `.env.local` is git-ignored. Never commit real keys.

### 3. Run the database migrations

Open the **Supabase Dashboard → SQL Editor** and run the files in `supabase/` **in this exact order** (later migrations depend on earlier columns):

| # | File | Purpose |
|---|---|---|
| 1 | `schema.sql` | Enables `pgvector`, creates `documents`, and the `match_documents()` search function |
| 2 | `chat_schema.sql` | `chats` + `messages` tables for persisted conversations |
| 3 | `eval_schema.sql` | `eval_runs` + `eval_details` tables |
| 4 | `update_documents_user.sql` | Adds `documents.user_id` + per-user filtering to `match_documents()` |
| 5 | `add_document_metadata.sql` | Adds `documents.document_name` + `created_at` for the management panel |
| 6 | `secure_evals.sql` | Adds `eval_runs.user_id` for tenant isolation *(note: truncates existing eval rows)* |
| 7 | `storage_schema.sql` | Adds `documents.file_path`, creates the private `vault` Storage bucket, and its RLS policies |

> Skip `add_document_name.sql` — it is superseded by `add_document_metadata.sql` (#5).

Then enable email confirmations under **Authentication → Providers → Email**, and add `http://localhost:3000/auth/callback` to **Authentication → URL Configuration → Redirect URLs**.

### 4. Run the app

```bash
npm run dev
```

Visit **http://localhost:3000** → you'll be redirected to `/login`. Sign up, confirm your email, then upload a PDF and start chatting.

### Available scripts

```bash
npm run dev     # Start the dev server (Turbopack)
npm run build   # Production build
npm run start   # Serve the production build
npm run lint    # ESLint
npm run eval    # Run the evaluation harness from the CLI (reads .env.local)
```

---

## 🏗 Architecture Flow

### A. Ingestion — how a document becomes vectors

```
PDF upload (multipart)
   → Auth check (Supabase session)
   → Store original file in private "vault" bucket  (path: <user_id>/<timestamp>-<file>)
   → Extract raw text with pdf-parse
   → RecursiveCharacterTextSplitter  (1000 chars, 200 overlap)
   → embedMany() → OpenAI text-embedding-3-small (1536-dim)
   → INSERT rows into `documents` { content, embedding, user_id, document_name, file_path }
```
`POST /api/ingest` orchestrates this. If parsing or insertion fails, the uploaded file is removed so no orphans are left in Storage.

### B. Query — how a chat message reaches a grounded, cited answer

```
User message (POST /api/chat)
   → Persist user message → `messages`
   → HyDE: gpt-4o-mini writes a hypothetical answer paragraph
   → Embed the hypothetical doc (text-embedding-3-small)
   → supabase.rpc('match_documents', { match_count: 15, filter_user_id })  ← cosine search, per-user
   → Context packer: greedily fill ~15,000 chars of top chunks
   → streamText() with claude-sonnet-4-6, system prompt = numbered context + "cite as [^n]"
   → Stream answer to the client; attach source metadata as a data part
   → UI renders Markdown + parses [^n] into interactive citation badges
   → onFinish: persist assistant message + sources
```

### C. Evaluation — how the system grades itself

```
POST /api/admin/eval  (or `npm run eval`)
   → Guard: user must have ≥1 ingested document
   → Sample up to 3 of the user's chunks
   → gpt-4o-mini generates a golden Q&A dataset from those chunks (Zod-structured output)
   → For each question: run the FULL RAG pipeline (HyDE → retrieve → Claude answer)
   → gpt-4o judge scores actual vs. expected answer (0–10 + reasoning), Zod-structured
   → Persist `eval_runs` (avg score) + `eval_details` (per-question)
   → Dashboard renders score, run history, and per-question breakdown with the judge's reasoning
```

---

## 📁 Project Structure

```
src/
├─ app/
│  ├─ page.tsx                    # Chat workspace (Server Component → ChatWorkspace)
│  ├─ login/                      # Auth landing page + server actions
│  ├─ evaluation/dashboard/       # Eval results dashboard
│  ├─ auth/callback/              # Supabase email-confirmation handler
│  └─ api/
│     ├─ chat/route.ts            # HyDE → retrieve → pack → stream (with citations)
│     ├─ ingest/route.ts          # PDF → storage → chunk → embed → insert
│     └─ admin/eval/route.ts      # Trigger the evaluation engine
├─ components/
│  ├─ ChatWorkspace.tsx           # Two-panel chat + knowledge-base UI
│  ├─ CitationBubble.tsx          # Markdown renderer + interactive citations
│  ├─ ui/                         # shadcn/ui + Aurora/Grid backgrounds
│  └─ ...
├─ lib/eval-engine.ts             # Reusable evaluation pipeline (web + CLI)
├─ utils/supabase/                # SSR server + browser Supabase clients
├─ app/actions/                   # Server Actions (chat, documents, eval)
└─ middleware.ts                  # Route protection / session refresh
scripts/eval.ts                   # CLI entry point for the eval engine
supabase/*.sql                    # Ordered schema migrations
```

---

## 🧭 Design Highlights (for reviewers)

- **Server-first**: data fetching, auth, and persistence run in Server Components / Server Actions; the client only owns interactive state.
- **Tenant isolation is enforced at every layer** — middleware, query filters, and Storage RLS — not just the UI.
- **The eval engine is shared code** (`lib/eval-engine.ts`) callable from both an authenticated API route and a CLI script, so quality can be measured in CI or locally.
- **Citations are first-class**: source metadata is streamed alongside the answer and survives reloads, keeping answers auditable.

---

*Built as a portfolio project to demonstrate end-to-end Full-Stack AI engineering: retrieval quality, evaluation rigor, multi-tenant security, and polished product UX.*
