'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * AuroraBackground
 *
 * A lightweight, GPU-friendly animated mesh gradient — no WebGL. It layers a
 * handful of intensely-blurred radial-gradient orbs (theme violet / indigo,
 * plus fuchsia and a touch of cyan for contrast) and drifts/rotates/scales them
 * with pure CSS keyframes (defined in globals.css). Children render above the
 * animation; elevate them with `relative z-10`.
 */
export function AuroraBackground({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative min-h-screen overflow-hidden bg-zinc-950', className)}>
      {/* Animated orbs — sit behind the content */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Indigo — top left, slow drift */}
        <div className="absolute -left-[10%] -top-[15%] h-[45rem] w-[45rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.45),transparent_70%)] blur-[120px] animate-[aurora-one_20s_ease-in-out_infinite] will-change-transform" />
        {/* Violet — top right */}
        <div className="absolute -right-[15%] top-[8%] h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.45),transparent_70%)] blur-[120px] animate-[aurora-two_24s_ease-in-out_infinite] will-change-transform" />
        {/* Fuchsia — bottom left, rotating */}
        <div className="absolute -bottom-[20%] left-[18%] h-[42rem] w-[42rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(217,70,239,0.35),transparent_70%)] blur-[120px] animate-[aurora-three_28s_ease-in-out_infinite] will-change-transform" />
        {/* Cyan accent — bottom right, smaller, reversed */}
        <div className="absolute bottom-[4%] right-[8%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.25),transparent_70%)] blur-[100px] animate-[aurora-one_22s_ease-in-out_infinite_reverse] will-change-transform" />
        {/* Anchoring vignette so the glow reads as light from above */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,rgba(99,102,241,0.12),transparent_60%)]" />
      </div>

      {children}
    </div>
  );
}
