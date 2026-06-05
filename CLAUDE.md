# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server at localhost:3000
npm run build     # production build
npm run lint      # ESLint
```

There is no test suite yet.

## Next.js Version Warning

This project uses **Next.js 16.2.7**, which has breaking changes from training data. Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. Key differences:

- **fetch default caching**: The default is now `auto no cache` (not `force-cache`). Use `{ cache: 'force-cache' }` to opt in to caching.
- **Route Handlers** (`app/api/**/route.ts`): Use standard Web `Request`/`Response` APIs — no `NextApiRequest`/`NextApiResponse`.
- **Server Components**: Pages and layouts are `async` by default. Data fetching happens directly in the component with `await fetch(...)`.

## Architecture

**Stack**: Next.js 16 App Router · TypeScript · Tailwind CSS v4 · Vercel AI SDK v6 · Supabase

**Path alias**: `@/*` resolves to `src/*`.

**`src/` layout**:
- `app/` — App Router pages, layouts, and route handlers
- `components/` — shared React components
- `lib/` — utilities; `supabase.ts` exports a pre-configured Supabase client
- `types/` — shared TypeScript types

**Environment** (`.env.local`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`.

**Supabase client** (`src/lib/supabase.ts`): a singleton created with `createClient`. Import it directly — do not instantiate new clients elsewhere.

**AI SDK**: Uses `ai` v6 and `@ai-sdk/openai` v3. The AI SDK v6 API differs from earlier versions; refer to its docs before using streaming helpers or tool-call patterns.

**Tailwind CSS v4**: Configuration is in `postcss.config.mjs` (no `tailwind.config.js`). Directives and plugin APIs differ from v3.
