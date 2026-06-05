'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { isTextUIPart, UIMessage } from 'ai';
import {
  Upload, Send, Loader2, CheckCircle, AlertCircle,
  MessageSquare, FileText, X, Trash2, AlertTriangle, Download,
} from 'lucide-react';
import { NavBar } from '@/components/NavBar';
import { MarkdownMessage, type CitationSource } from '@/components/CitationBubble';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { deleteChat } from '@/app/actions/chat';
import {
  getIngestedDocuments,
  getDocumentDownloadUrl,
  deleteSingleDocument,
  purgeAllDocuments,
  type DocumentGroup,
} from '@/app/actions/documents';

type IngestStatus = 'idle' | 'loading' | 'success' | 'error';
type LeftTab = 'upload' | 'manage';

function getMessageText(message: UIMessage): string {
  return message.parts.filter(isTextUIPart).map((p) => p.text).join('');
}

// Pull the source list out of the `data-sources` part attached by the chat API.
function getMessageSources(message: UIMessage): CitationSource[] {
  const part = message.parts.find((p) => p.type === 'data-sources');
  return part && 'data' in part ? (part.data as CitationSource[]) : [];
}

interface Props {
  initialMessages: UIMessage[];
  initialChatId: string | null;
}

export function ChatWorkspace({ initialMessages, initialChatId }: Props) {
  // ── Upload state ──────────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<IngestStatus>('idle');
  const [ingestMessage, setIngestMessage] = useState('');

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<LeftTab>('upload');

  // ── Document management state ─────────────────────────────────────────────
  const [documents, setDocuments] = useState<DocumentGroup[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [pendingDeleteName, setPendingDeleteName] = useState<string | null>(null);
  const [downloadingName, setDownloadingName] = useState<string | null>(null);
  // Document name currently highlighted via a hovered citation in the chat panel.
  const [highlightedDoc, setHighlightedDoc] = useState<string | null>(null);

  // ── Chat state ────────────────────────────────────────────────────────────
  const [chatInput, setChatInput] = useState('');
  const [chatId, setChatId] = useState<string>(() => initialChatId ?? crypto.randomUUID());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Modals ────────────────────────────────────────────────────────────────
  const [isClearChatModalOpen, setIsClearChatModalOpen] = useState(false);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);

  const { messages, sendMessage, status, setMessages } = useChat({ messages: initialMessages });
  const isStreaming = status === 'submitted' || status === 'streaming';

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // ── Load documents when manage tab is selected ────────────────────────────
  useEffect(() => {
    if (activeTab !== 'manage') return;
    let cancelled = false;
    (async () => {
      setDocsLoading(true);
      try {
        const docs = await getIngestedDocuments();
        if (!cancelled) setDocuments(docs);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setDocsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  // ── Upload handlers ───────────────────────────────────────────────────────
  function handleFileSelect(file: File | null) {
    if (file && file.type !== 'application/pdf') return;
    setSelectedFile(file);
    if (ingestStatus !== 'idle') setIngestStatus('idle');
  }

  async function handleIngest() {
    if (!selectedFile) return;
    setIngestStatus('loading');
    setIngestMessage('');
    try {
      const body = new FormData();
      body.append('file', selectedFile);
      const res = await fetch('/api/ingest', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) {
        setIngestStatus('error');
        setIngestMessage(data.error ?? 'Ingestion failed');
      } else {
        setIngestStatus('success');
        setIngestMessage(`${data.ingested} chunk${data.ingested !== 1 ? 's' : ''} added`);
        setSelectedFile(null);
      }
    } catch {
      setIngestStatus('error');
      setIngestMessage('Network error');
    }
  }

  // ── Document management handlers ──────────────────────────────────────────
  async function downloadDocument(documentName: string) {
    setDownloadingName(documentName);
    try {
      // Server returns a short-lived signed URL to the original PDF in storage.
      const url = await getDocumentDownloadUrl(documentName);
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloadingName(null);
    }
  }

  async function handleDeleteDocument(documentName: string) {
    await deleteSingleDocument(documentName);
    setDocuments((prev) => prev.filter((d) => d.document_name !== documentName));
    setPendingDeleteName(null);
  }

  async function confirmPurgeAll() {
    setIsPurgeModalOpen(false);
    await purgeAllDocuments();
    setDocuments([]);
  }

  // ── Chat handlers ─────────────────────────────────────────────────────────
  function handleChatSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!chatInput.trim() || isStreaming) return;
    sendMessage({ text: chatInput }, { body: { chatId } });
    setChatInput('');
  }

  async function confirmClearChat() {
    setIsClearChatModalOpen(false);
    await deleteChat(chatId);
    setMessages([]);
    setChatId(crypto.randomUUID());
  }

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden text-foreground">
      <NavBar />

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-hidden">

        {/* ════════════════ LEFT: Knowledge Base panel ════════════════ */}
        <Card className="h-full flex flex-col overflow-hidden gap-0 py-0 bg-card/50 backdrop-blur-xl border-white/10 shadow-[0_10px_50px_-12px_rgba(139,92,246,0.5)]">

          {/* Panel header */}
          <div className="flex items-center gap-2 px-5 pt-5 shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30">
              <Upload className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-wider bg-gradient-to-r from-violet-200 to-fuchsia-200 bg-clip-text text-transparent">
              Knowledge Base
            </h2>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 px-5 mt-4 border-b border-white/10 shrink-0">
            {(['upload', 'manage'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 -mb-px transition-colors cursor-pointer ${
                  activeTab === tab
                    ? 'text-foreground border-violet-500'
                    : 'text-muted-foreground border-transparent hover:text-foreground/80'
                }`}
              >
                {tab === 'upload' ? 'Upload File' : 'Manage Knowledge Base'}
              </button>
            ))}
          </div>

          {/* ── Tab content wrapper ── */}
          <div className="flex-1 flex flex-col overflow-hidden p-5">

            {/* ─── Upload File tab ─── */}
            {activeTab === 'upload' && (
              <>
                <p className="text-xs text-muted-foreground mb-4 shrink-0">
                  Upload a PDF — text will be extracted, split into chunks, and embedded into Supabase.
                </p>

                {/* Drop zone */}
                <label
                  htmlFor="pdf-upload"
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFileSelect(e.dataTransfer.files[0] ?? null);
                  }}
                  className={`flex-1 min-h-0 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                    isDragging
                      ? 'border-violet-500 bg-violet-500/10'
                      : selectedFile
                      ? 'border-white/20 bg-white/5'
                      : 'border-white/10 bg-white/[0.02] hover:border-violet-500/50 hover:bg-white/5'
                  }`}
                >
                  {selectedFile ? (
                    <>
                      <div className="relative">
                        <FileText className="w-10 h-10 text-violet-400" />
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); handleFileSelect(null); }}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                      <span className="text-sm font-medium text-foreground max-w-[80%] truncate text-center">
                        {selectedFile.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {isDragging ? 'Drop your PDF here' : 'Click or drag a PDF to upload'}
                      </span>
                      <span className="text-xs text-muted-foreground/60">PDF files only</span>
                    </>
                  )}
                  <input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                  />
                </label>

                <div className="mt-4 flex items-center gap-3 flex-wrap shrink-0">
                  <Button
                    onClick={handleIngest}
                    disabled={ingestStatus === 'loading' || !selectedFile}
                  >
                    {ingestStatus === 'loading' ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Upload />
                    )}
                    {ingestStatus === 'loading' ? 'Ingesting…' : 'Ingest PDF'}
                  </Button>
                  {ingestStatus === 'success' && (
                    <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      {ingestMessage}
                    </span>
                  )}
                  {ingestStatus === 'error' && (
                    <span className="flex items-center gap-1.5 text-sm text-red-400">
                      <AlertCircle className="w-4 h-4" />
                      {ingestMessage}
                    </span>
                  )}
                </div>
              </>
            )}

            {/* ─── Manage Knowledge Base tab ─── */}
            {activeTab === 'manage' && (
              <>
                {/* Document list — scrollable */}
                <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
                  {docsLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <FileText className="w-8 h-8 text-muted-foreground/50 mb-3" />
                      <p className="text-sm text-muted-foreground">No documents ingested yet.</p>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => setActiveTab('upload')}
                        className="text-violet-400"
                      >
                        Upload a PDF
                      </Button>
                    </div>
                  ) : (
                    documents.map((doc) => {
                      const isHighlighted = highlightedDoc === doc.document_name;
                      return (
                      <div
                        key={doc.document_name}
                        className={`border rounded-xl p-3 transition-all duration-200 ${
                          isHighlighted
                            ? 'bg-violet-500/15 border-violet-500/50 ring-1 ring-violet-500/30 shadow-lg shadow-violet-500/10'
                            : 'bg-white/[0.03] border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1 flex items-center gap-2.5">
                            <FileText className={`w-4 h-4 shrink-0 transition-colors ${isHighlighted ? 'text-violet-300' : 'text-violet-400'}`} />
                            <div className="min-w-0">
                              <p className={`text-xs font-semibold truncate transition-colors ${isHighlighted ? 'text-violet-100' : 'text-foreground/90'}`}>
                                {doc.document_name}
                              </p>
                              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                                {doc.chunk_count} chunk{doc.chunk_count !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {pendingDeleteName === doc.document_name ? (
                              <>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                  onClick={() => handleDeleteDocument(doc.document_name)}
                                >
                                  Confirm
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setPendingDeleteName(null)}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => downloadDocument(doc.document_name)}
                                  disabled={downloadingName === doc.document_name}
                                  title="Download full document as .txt"
                                >
                                  {downloadingName === doc.document_name ? (
                                    <Loader2 className="animate-spin" />
                                  ) : (
                                    <Download />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="hover:text-red-400"
                                  onClick={() => setPendingDeleteName(doc.document_name)}
                                  title="Delete document"
                                >
                                  <Trash2 />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>

                {/* Purge Vector Index button */}
                {documents.length > 0 && (
                  <div className="pt-4 mt-1 border-t border-white/10 shrink-0">
                    <Button
                      variant="destructive"
                      className="w-full bg-destructive text-white hover:bg-destructive/90 shadow-lg shadow-red-900/30"
                      onClick={() => setIsPurgeModalOpen(true)}
                    >
                      <Trash2 />
                      Purge Vector Index
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        {/* ════════════════ RIGHT: Chat panel ════════════════ */}
        <Card className="h-full flex flex-col overflow-hidden gap-0 py-0 bg-card/50 backdrop-blur-xl border-white/10 shadow-[0_10px_50px_-12px_rgba(99,102,241,0.5)]">
          <div className="flex items-center justify-between px-5 pt-5 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/30">
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-sm font-semibold uppercase tracking-wider bg-gradient-to-r from-indigo-200 to-violet-200 bg-clip-text text-transparent">
                Chat
              </h2>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsClearChatModalOpen(true)}
                className="text-muted-foreground hover:text-amber-400"
                title="Clear chat history"
              >
                <Trash2 />
                Clear Chat History
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground px-5 mt-1 mb-4 shrink-0">
            Answers are grounded exclusively in your ingested content.
          </p>

          {/* Messages — scrollable */}
          <div className="flex-1 overflow-y-auto space-y-3 px-5 pb-4">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground/70 text-center max-w-xs">
                  Ingest some content on the left, then ask a question here.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const text = getMessageText(m);
                if (!text) return null;
                const isUser = m.role === 'user';
                const sources = isUser ? [] : getMessageSources(m);
                return (
                  <div
                    key={m.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        isUser
                          ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-br-sm shadow-lg shadow-violet-600/25'
                          : 'bg-white/5 border border-white/10 text-foreground rounded-bl-sm backdrop-blur-sm'
                      }`}
                    >
                      <MarkdownMessage
                        text={text}
                        sources={sources}
                        isUser={isUser}
                        onCitationHover={setHighlightedDoc}
                      />
                    </div>
                  </div>
                );
              })
            )}
            {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleChatSubmit} className="flex gap-2 p-4 border-t border-white/10 shrink-0">
            <Input
              className="flex-1 bg-white/5 border-white/10"
              placeholder="Ask a question about your content…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isStreaming}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isStreaming || !chatInput.trim()}
              className="shadow-lg shadow-violet-600/25"
            >
              {isStreaming ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </form>
        </Card>
      </div>

      {/* ════════════════ Dialogs ════════════════ */}

      {/* Clear Chat History */}
      <Dialog open={isClearChatModalOpen} onOpenChange={setIsClearChatModalOpen}>
        <DialogContent className="bg-card/80 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/25 mx-auto mb-1">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <DialogTitle className="text-center">Clear Chat History</DialogTitle>
            <DialogDescription className="text-center">
              This will permanently erase your conversation log. Your ingested
              documents will not be affected. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setIsClearChatModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmClearChat}
            >
              Clear History
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Purge Vector Index */}
      <Dialog open={isPurgeModalOpen} onOpenChange={setIsPurgeModalOpen}>
        <DialogContent className="bg-card/80 backdrop-blur-xl border-red-500/20">
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30 mx-auto mb-1">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <DialogTitle className="text-center">Purge Vector Index</DialogTitle>
            <DialogDescription className="text-center">
              This will permanently delete all {documents.length} document chunk
              {documents.length !== 1 ? 's' : ''} from your vector database. Your AI
              will have no context until you re-upload a PDF. Chat history is not affected.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setIsPurgeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmPurgeAll}
            >
              Purge All Documents
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
