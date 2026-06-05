'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlayCircle, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { EvalEngineResult } from '@/lib/eval-engine';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

function scoreBadge(score: number) {
  if (score >= 8) return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300';
  if (score >= 5) return 'border-amber-500/30 bg-amber-500/15 text-amber-300';
  return 'border-red-500/30 bg-red-500/15 text-red-300';
}

function avgColor(score: number) {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 5) return 'text-amber-400';
  return 'text-red-400';
}

export function EvalTrigger() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [liveResult, setLiveResult] = useState<EvalEngineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function triggerEval() {
    setIsLoading(true);
    setLiveResult(null);
    setError(null);

    try {
      const res = await fetch('/api/admin/eval', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Evaluation failed');
      } else {
        setLiveResult(data as EvalEngineResult);
        router.refresh(); // re-render Server Components to update history table
      }
    } catch {
      setError('Network error — check the server logs');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Trigger button */}
      <Button
        onClick={triggerEval}
        disabled={isLoading}
        size="lg"
        className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500 shadow-lg shadow-violet-600/30"
      >
        {isLoading ? <Loader2 className="animate-spin" /> : <PlayCircle />}
        {isLoading ? 'Running evaluation pipeline…' : 'Trigger Live Evaluation Pipeline'}
      </Button>

      {/* Error banner */}
      {error && (
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/30">
          <AlertCircle />
          <AlertTitle>Evaluation failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Live result card */}
      {liveResult && (
        <Card className="py-0 gap-0 overflow-hidden bg-card/50 backdrop-blur-xl border-white/10 shadow-[0_10px_50px_-12px_rgba(139,92,246,0.4)]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-foreground">Live Result</span>
            </div>
            <span className={`text-2xl font-bold tabular-nums ${avgColor(liveResult.averageScore)}`}>
              {liveResult.averageScore.toFixed(1)}
              <span className="text-sm font-normal text-muted-foreground/60 ml-1">/ 10</span>
            </span>
          </div>

          <div className="divide-y divide-white/5">
            {liveResult.details.map((d, i) => (
              <div key={i} className="px-5 py-3.5 flex items-start gap-3">
                <Badge className={`shrink-0 mt-0.5 ${scoreBadge(d.score)}`}>{d.score}/10</Badge>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground/90 mb-0.5 truncate">{d.question}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{d.reasoning}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 bg-white/[0.03] border-t border-white/10">
            <p className="text-xs text-muted-foreground/70">
              Saved to history — run ID:{' '}
              <code className="font-mono text-muted-foreground">{liveResult.runId.slice(0, 8)}…</code>
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
