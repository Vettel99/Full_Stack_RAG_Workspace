'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { clearEvaluationHistory } from '@/app/actions/eval';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export function ClearEvalHistory() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirmClear() {
    setIsDeleting(true);
    setIsModalOpen(false);
    try {
      await clearEvaluationHistory();
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsModalOpen(true)}
        disabled={isDeleting}
        className="border-white/10 bg-white/5"
      >
        {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
        {isDeleting ? 'Clearing…' : 'Clear History'}
      </Button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-card/80 backdrop-blur-xl border-red-500/20">
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/15 border border-red-500/25 mx-auto mb-1">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <DialogTitle className="text-center">Clear Evaluation History</DialogTitle>
            <DialogDescription className="text-center">
              This will permanently delete all evaluation runs, scores, and judge
              reasoning. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmClear}
            >
              Clear All History
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
