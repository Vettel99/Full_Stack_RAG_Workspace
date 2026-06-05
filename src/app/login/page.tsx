import { BookOpen, Sparkles, FileSearch, FlaskConical, ShieldCheck } from 'lucide-react';
import { signIn, signUp } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AnimatedGridBackground } from '@/components/ui/AnimatedGridBackground';

const FEATURES = [
  { icon: FileSearch, label: 'Context-Aware RAG' },
  { icon: FlaskConical, label: 'Synthetic Evaluation Engine' },
  { icon: ShieldCheck, label: 'Multi-Tenant Security' },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <AnimatedGridBackground className="text-zinc-100">
      {/* ════════════ Asymmetrical content grid (elevated above the background) ════════════ */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
        <div className="grid w-full items-center gap-12 lg:grid-cols-2 lg:gap-10">

          {/* ─────────── LEFT: marketing hook ─────────── */}
          <section className="flex flex-col gap-8">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/40">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <span className="text-base font-semibold tracking-tight text-zinc-200">
                RAG Workspace
              </span>
            </div>

            {/* Eyebrow pill */}
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 backdrop-blur">
              <Sparkles className="h-3 w-3 text-indigo-300" />
              Enterprise RAG &amp; Evaluation Platform
            </div>

            {/* Massive gradient-clipped headline */}
            <h1 className="text-5xl font-bold leading-[0.95] tracking-tight sm:text-6xl xl:text-7xl">
              <span className="block bg-gradient-to-r from-white via-indigo-200 to-violet-300 bg-clip-text text-transparent">
                Evaluate.
              </span>
              <span className="block bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                Ingest.
              </span>
              <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
                Synthesize.
              </span>
            </h1>

            <p className="max-w-md text-base leading-relaxed text-zinc-400">
              Ground every answer in your own documents with inline citations, measure
              quality with synthetic evaluations, and keep each tenant&apos;s data
              fully isolated.
            </p>

            {/* Floating glassmorphic feature pills */}
            <div className="flex flex-wrap gap-3">
              {FEATURES.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-indigo-500/10"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-indigo-500/20 to-violet-500/20">
                    <f.icon className="h-3.5 w-3.5 text-indigo-300" />
                  </div>
                  <span className="text-sm font-medium text-zinc-300">{f.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ─────────── RIGHT: auth card ─────────── */}
          <div className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-md gap-0 border border-white/10 bg-zinc-950/50 p-8 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl">
              <div className="mb-6">
                <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
                  Welcome back
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Sign in, or create your account to get started.
                </p>
              </div>

              {/* Feedback banners */}
              {error && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <span className="mt-px">⚠</span>
                  <span>{error}</span>
                </div>
              )}
              {message && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                  <span className="mt-px">✓</span>
                  <span>{message}</span>
                </div>
              )}

              <form className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs font-medium text-zinc-400">
                    Email
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="h-11 border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-xs font-medium text-zinc-400">
                    Password
                  </label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-11 border-white/10 bg-white/5 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <Button
                    formAction={signIn}
                    className="h-11 flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30 transition-all duration-200 hover:scale-[1.02] hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-500/50 active:scale-100"
                  >
                    Sign In
                  </Button>
                  <Button
                    formAction={signUp}
                    variant="secondary"
                    className="h-11 flex-1 border border-white/10 bg-white/5 text-zinc-200 transition-all duration-200 hover:scale-[1.02] hover:bg-white/10 active:scale-100"
                  >
                    Sign Up
                  </Button>
                </div>
              </form>

              <p className="mt-6 text-center text-xs text-zinc-500">
                New users must confirm their email before signing in.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </AnimatedGridBackground>
  );
}
