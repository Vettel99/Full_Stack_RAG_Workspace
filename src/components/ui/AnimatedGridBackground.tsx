'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * AnimatedGridBackground
 *
 * The "21st.dev" look: a faint SVG grid that pans infinitely, radial-masked so
 * it's crisp in the center and fades to black at the edges, over two large,
 * slowly-drifting blurred glow orbs. Pure CSS — no WebGL. Children render above
 * the background; elevate them with `relative z-10`.
 */
export function AnimatedGridBackground({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative min-h-screen overflow-hidden bg-zinc-950', className)}>
      {/* Ambient drifting glows (behind the grid) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10%] -top-[10%] h-[40rem] w-[40rem] rounded-full bg-indigo-600/20 blur-[120px] animate-[aurora-one_22s_ease-in-out_infinite] will-change-transform" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[38rem] w-[38rem] rounded-full bg-violet-600/20 blur-[120px] animate-[aurora-two_26s_ease-in-out_infinite] will-change-transform" />
      </div>

      {/* Masked animated grid — bright in the center, fades to nothing at the edges */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{
          maskImage: 'radial-gradient(ellipse at center, black, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black, transparent 80%)',
        }}
      >
        {/* Oversized by one cell at the top so the downward pan loops seamlessly */}
        <svg
          aria-hidden="true"
          className="absolute inset-x-0 -top-10 h-[calc(100%+40px)] w-full animate-[grid-pan_20s_linear_infinite] will-change-transform"
        >
          <defs>
            <pattern id="agb-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="white"
                strokeOpacity="0.07"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#agb-grid)" />
        </svg>
      </div>

      {children}
    </div>
  );
}
