import { createClient } from '@/utils/supabase/server';
import { NavBar } from '@/components/NavBar';
import { EvalTrigger } from '@/components/EvalTrigger';
import { ClearEvalHistory } from '@/components/ClearEvalHistory';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type EvalRun = {
  id: string;
  created_at: string;
  average_score: number;
};

type EvalDetail = {
  id: string;
  run_id: string;
  question: string;
  expected_answer: string;
  actual_answer: string;
  score: number;
  reasoning: string;
};

function fmt(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

// Colorful badge palette: green 8-10, yellow 5-7, red 0-4.
function scoreBadge(score: number) {
  if (score >= 8) return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300';
  if (score >= 5) return 'border-amber-500/30 bg-amber-500/15 text-amber-300';
  return 'border-red-500/30 bg-red-500/15 text-red-300';
}

function scoreBar(score: number) {
  if (score >= 8) return 'bg-emerald-500';
  if (score >= 5) return 'bg-amber-500';
  return 'bg-red-500';
}

function avgColor(score: number) {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 5) return 'text-amber-400';
  return 'text-red-400';
}

function ringStroke(score: number) {
  if (score >= 8) return '#34d399';
  if (score >= 5) return '#fbbf24';
  return '#f87171';
}

export default async function EvaluationDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Strictly scope eval_runs to the authenticated user (cross-tenant fix).
  const { data: runs } = user
    ? await supabase
        .from('eval_runs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .returns<EvalRun[]>()
    : { data: null };

  const latestRun = runs?.[0] ?? null;

  // latestRun already belongs to this user, so its details are implicitly scoped.
  const { data: latestDetails } = latestRun
    ? await supabase
        .from('eval_details')
        .select('*')
        .eq('run_id', latestRun.id)
        .order('score', { ascending: false })
        .returns<EvalDetail[]>()
    : { data: null };

  return (
    <div className="min-h-screen text-foreground flex flex-col">
      <NavBar />
      <div className="px-8 pt-7 pb-1 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Evaluations</p>
          <h1 className="text-2xl font-bold mt-0.5 bg-gradient-to-r from-violet-300 via-fuchsia-300 to-indigo-300 bg-clip-text text-transparent">
            Evaluation Dashboard
          </h1>
        </div>
        {runs && runs.length > 0 && <ClearEvalHistory />}
      </div>

      <main className="px-8 py-8 space-y-10 max-w-5xl w-full">

        {/* ── Trigger section — always visible ── */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Actions
          </h2>
          <EvalTrigger />
        </section>

        {/* ── Empty state ── */}
        {!latestRun && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center mb-4">
              <span className="text-2xl">📊</span>
            </div>
            <p className="text-foreground font-medium mb-1">No evaluation runs yet</p>
            <p className="text-sm text-muted-foreground">
              Ingest a PDF, then click{' '}
              <span className="text-foreground font-medium">Trigger Live Evaluation Pipeline</span>{' '}
              above.
            </p>
          </div>
        )}

        {latestRun && (
          <>
            {/* ── Metric card ── */}
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                Latest Run
              </h2>
              <Card className="p-6 flex flex-row items-center justify-between gap-6 bg-card/50 backdrop-blur-xl border-white/10 shadow-[0_10px_50px_-12px_rgba(139,92,246,0.5)]">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Average Score</p>
                  <p className={`text-5xl font-bold tabular-nums ${avgColor(latestRun.average_score)}`}>
                    {latestRun.average_score.toFixed(1)}
                    <span className="text-2xl font-normal text-muted-foreground/60 ml-1">/ 10</span>
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-2">{fmt(latestRun.created_at)}</p>
                </div>
                <div className="shrink-0 w-28 h-28 relative">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="oklch(0.3 0.05 285)" strokeWidth="2.8" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={ringStroke(latestRun.average_score)}
                      strokeWidth="2.8"
                      strokeDasharray={`${latestRun.average_score * 10}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <p className={`absolute inset-0 flex items-center justify-center text-xl font-bold ${avgColor(latestRun.average_score)}`}>
                    {Math.round(latestRun.average_score * 10)}%
                  </p>
                </div>
              </Card>
            </section>

            {/* ── Run history table ── */}
            {runs && runs.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Run History
                </h2>
                <Card className="py-0 overflow-hidden bg-card/50 backdrop-blur-xl border-white/10 shadow-[0_10px_50px_-12px_rgba(99,102,241,0.4)]">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-white/10">
                        <TableHead className="uppercase tracking-wider text-xs">Date</TableHead>
                        <TableHead className="uppercase tracking-wider text-xs">Run ID</TableHead>
                        <TableHead className="text-right uppercase tracking-wider text-xs">Avg Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.map((run, i) => (
                        <TableRow key={run.id} className={`border-white/5 ${i === 0 ? 'bg-violet-500/5' : ''}`}>
                          <TableCell className="text-foreground/90">{fmt(run.created_at)}</TableCell>
                          <TableCell>
                            <code className="text-xs text-muted-foreground font-mono">{run.id.slice(0, 8)}…</code>
                            {i === 0 && (
                              <Badge className="ml-2 border-violet-500/30 bg-violet-500/15 text-violet-300">
                                latest
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={scoreBadge(run.average_score)}>
                              {run.average_score.toFixed(1)} / 10
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </section>
            )}

            {/* ── Latest run detail cards ── */}
            {latestDetails && latestDetails.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  Question Breakdown — Latest Run
                </h2>
                <div className="space-y-4">
                  {latestDetails.map((detail) => (
                    <Card key={detail.id} className="py-0 overflow-hidden gap-0 bg-card/50 backdrop-blur-xl border-white/10">
                      <div className="flex items-start gap-4 px-6 py-5">
                        <Badge className={`shrink-0 text-sm font-bold px-2.5 py-1 ${scoreBadge(detail.score)}`}>
                          {detail.score}/10
                        </Badge>
                        <p className="text-sm font-medium text-foreground/90 leading-relaxed pt-0.5">
                          {detail.question}
                        </p>
                      </div>
                      <div className="mx-6 mb-1 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${scoreBar(detail.score)}`}
                          style={{ width: `${detail.score * 10}%` }}
                        />
                      </div>
                      <div className="px-6 py-4 border-t border-white/10 mt-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                          Judge&apos;s Reasoning
                        </p>
                        <p className="text-sm text-foreground/80 leading-relaxed">{detail.reasoning}</p>
                      </div>
                      <details className="group border-t border-white/10">
                        <summary className="flex items-center gap-2 px-6 py-3 text-xs text-muted-foreground cursor-pointer hover:text-foreground/80 transition-colors select-none list-none">
                          <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7.293 4.293a1 1 0 011.414 0L14.414 10l-5.707 5.707a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          View expected vs actual answer
                        </summary>
                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10">
                          <div className="px-6 py-4">
                            <p className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider mb-2">Expected</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">{detail.expected_answer}</p>
                          </div>
                          <div className="px-6 py-4">
                            <p className="text-xs font-semibold text-violet-400/80 uppercase tracking-wider mb-2">Actual</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">{detail.actual_answer}</p>
                          </div>
                        </div>
                      </details>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
