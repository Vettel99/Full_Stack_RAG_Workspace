'use client';

import { useState, Children, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FileText } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

export type CitationSource = {
  index: number;
  document_name: string | null;
  snippet: string;
};

interface CitationBubbleProps {
  index: number;
  source?: CitationSource;
  /** Notified with the source's document name on hover (null on leave). */
  onHoverChange?: (documentName: string | null) => void;
}

export function CitationBubble({ index, source, onHoverChange }: CitationBubbleProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  function open(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    // Anchor the popover just above the badge, horizontally centered.
    setCoords({ top: rect.top, left: rect.left + rect.width / 2 });
    onHoverChange?.(source?.document_name ?? null);
  }

  function close() {
    setCoords(null);
    onHoverChange?.(null);
  }

  return (
    <span className="relative inline-block align-super">
      <button
        type="button"
        onMouseEnter={open}
        onMouseLeave={close}
        onClick={(e) => (coords ? close() : open(e))}
        className="mx-0.5 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-md bg-indigo-500/20 text-indigo-300 text-[0.65rem] font-semibold leading-none border border-indigo-500/30 hover:bg-indigo-500/30 hover:text-indigo-200 transition-colors cursor-pointer"
      >
        {index}
      </button>

      {coords &&
        source &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{ top: coords.top, left: coords.left }}
            className="fixed z-[100] -translate-x-1/2 -translate-y-full pb-2 pointer-events-none"
          >
            <div className="w-72 max-w-[80vw] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-3 pointer-events-auto">
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-xs font-semibold text-zinc-200 truncate">
                  {source.document_name ?? 'Untitled document'}
                </span>
                <span className="ml-auto text-[0.6rem] text-zinc-600 shrink-0">#{source.index}</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed max-h-40 overflow-y-auto">
                {source.snippet}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}

// Split a plain string on [^n] / [n] markers, injecting a CitationBubble for each.
function splitCitations(
  text: string,
  byIndex: Map<number, CitationSource>,
  onHover: ((name: string | null) => void) | undefined,
  keyBase: string,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\[\^?(\d+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const idx = parseInt(m[1], 10);
    const source = byIndex.get(idx);
    if (source) {
      nodes.push(
        <CitationBubble
          key={`${keyBase}-${k++}`}
          index={idx}
          source={source}
          onHoverChange={onHover}
        />,
      );
    } else {
      nodes.push(m[0]); // unknown marker — keep it raw so nothing silently vanishes
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// ReactMarkdown element overrides that replace [^n] markers inside any
// text-bearing element with interactive CitationBubbles.
function citationComponents(
  sources: CitationSource[],
  onHover?: (name: string | null) => void,
): Components {
  const byIndex = new Map(sources.map((s) => [s.index, s]));
  const wrap = (children: ReactNode): ReactNode =>
    Children.map(children, (child, i) =>
      typeof child === 'string' ? splitCitations(child, byIndex, onHover, `c${i}`) : child,
    );

  return {
    p: ({ children }) => <p>{wrap(children)}</p>,
    li: ({ children }) => <li>{wrap(children)}</li>,
    strong: ({ children }) => <strong>{wrap(children)}</strong>,
    em: ({ children }) => <em>{wrap(children)}</em>,
    td: ({ children }) => <td>{wrap(children)}</td>,
    th: ({ children }) => <th>{wrap(children)}</th>,
    h1: ({ children }) => <h1>{wrap(children)}</h1>,
    h2: ({ children }) => <h2>{wrap(children)}</h2>,
    h3: ({ children }) => <h3>{wrap(children)}</h3>,
    blockquote: ({ children }) => <blockquote>{wrap(children)}</blockquote>,
  };
}

interface MarkdownMessageProps {
  text: string;
  sources?: CitationSource[];
  isUser?: boolean;
  onCitationHover?: (documentName: string | null) => void;
}

// Renders a chat message as GitHub-flavored Markdown. Assistant messages also
// turn inline [^n] markers into interactive CitationBubbles.
export function MarkdownMessage({
  text,
  sources = [],
  isUser = false,
  onCitationHover,
}: MarkdownMessageProps) {
  const proseClasses = cn(
    'prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 max-w-none break-words',
    isUser &&
      'prose-headings:text-white prose-p:text-white prose-strong:text-white prose-li:text-white prose-a:text-white prose-code:text-white',
  );

  return (
    <div className={proseClasses}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={sources.length > 0 ? citationComponents(sources, onCitationHover) : undefined}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
