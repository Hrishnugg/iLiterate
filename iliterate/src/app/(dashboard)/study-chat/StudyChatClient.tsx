"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Check,
  FileImage,
  FileText,
  Languages,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import type {
  StudyChatAction,
  StudyChatAttachedUpload,
  StudyChatSessionSummary,
  StudyChatThread,
  StudyChatViewerLanguages,
} from "@/lib/study-chat/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/I18nProvider";
import { StudyChatMarkdown } from "./StudyChatMarkdown";

interface SessionsResponse {
  sessions: StudyChatSessionSummary[];
  viewerLanguages: StudyChatViewerLanguages;
}

interface SessionResponse extends StudyChatThread {
  sessions?: StudyChatSessionSummary[];
  viewerLanguages?: StudyChatViewerLanguages;
}

interface UploadResponse {
  id: string;
}

interface StreamDeltaPayload {
  delta: string;
}

interface StreamErrorPayload {
  error?: string;
}

const ACCEPTED_STUDY_UPLOADS =
  "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp";

const QUICK_ACTIONS: Array<{
  action: StudyChatAction;
  label: string;
  prompt: string;
  Icon: ComponentType<{ className?: string }>;
}> = [
  {
    action: "summary",
    label: "studyChat.summarize",
    prompt:
      "Summarize the uploaded material for me. Focus on the main ideas, structure, and details I should study first.",
    Icon: Sparkles,
  },
  {
    action: "translation",
    label: "studyChat.translate",
    prompt:
      "Translate the uploaded material into my native language. If it is too long, translate the most important sections and explain the rest at a high level.",
    Icon: Languages,
  },
  {
    action: "vocabulary",
    label: "studyChat.keyVocab",
    prompt:
      "Pull out the most useful vocabulary and phrases from the uploaded material for a learner.",
    Icon: NotebookPen,
  },
];

function uploadIcon(upload: StudyChatAttachedUpload) {
  return upload.kind === "image" ? FileImage : FileText;
}

function isSessionResponse(payload: unknown): payload is SessionResponse {
  return (
    !!payload &&
    typeof payload === "object" &&
    "session" in payload &&
    "messages" in payload &&
    "uploads" in payload
  );
}

function extractSseEvents(buffer: string) {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const blocks = normalized.split("\n\n");
  const remainder = blocks.pop() ?? "";
  const events = blocks.flatMap((block) => {
    const lines = block.split("\n").filter(Boolean);
    if (lines.length === 0) {
      return [];
    }

    let event = "message";
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trimStart());
      }
    }

    const rawData = dataLines.join("\n");
    if (!rawData) {
      return [];
    }

    try {
      return [{ event, payload: JSON.parse(rawData) as unknown }];
    } catch {
      return [];
    }
  });

  return {
    events,
    remainder,
  };
}

export function StudyChatClient() {
  const isMobile = useIsMobile();
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [sessions, setSessions] = useState<StudyChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [thread, setThread] = useState<StudyChatThread | null>(null);
  const [draft, setDraft] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteTitle, setConfirmDeleteTitle] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread?.messages.length]);

  useEffect(() => {
    let cancelled = false;

    async function loadSessions() {
      try {
        setLoadingSessions(true);
        const response = await fetch("/api/study-chat/sessions");
        const payload = (await response.json().catch(() => null)) as
          | SessionsResponse
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error(payload && "error" in payload ? payload.error : "Failed to load sessions");
        }

        if (cancelled || !payload || !("sessions" in payload)) {
          return;
        }

        setSessions(payload.sessions);
        if (payload.sessions.length === 0) {
          setActiveSessionId(null);
          setThread(null);
          return;
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load study chat");
        }
      } finally {
        if (!cancelled) {
          setLoadingSessions(false);
        }
      }
    }

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    if (thread?.session.id === activeSessionId) {
      return;
    }

    let cancelled = false;

    async function loadThread() {
      try {
        const response = await fetch(`/api/study-chat/sessions/${activeSessionId}/messages`);
        const payload = (await response.json().catch(() => null)) as
          | SessionResponse
          | { error?: string }
          | null;

        if (!response.ok) {
          throw new Error(payload && "error" in payload ? payload.error : "Failed to load thread");
        }

        if (cancelled || !payload || !("session" in payload)) {
          return;
        }

        setThread({
          session: payload.session,
          messages: payload.messages,
          uploads: payload.uploads,
        });
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load thread");
        }
      }
    }

    void loadThread();

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, thread?.session.id]);

  async function createSession(input?: { title?: string; uploadIds?: string[] }) {
    const response = await fetch("/api/study-chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    });
    const payload = (await response.json().catch(() => null)) as
      | SessionResponse
      | { error?: string }
      | null;

    if (!response.ok || !payload || !("session" in payload)) {
      throw new Error(payload && "error" in payload ? payload.error : "Failed to create study chat");
    }

    if (payload.sessions) {
      setSessions(payload.sessions);
    }

    setActiveSessionId(payload.session.id);
    setThread({
      session: payload.session,
      messages: payload.messages,
      uploads: payload.uploads,
    });
    setShowMobileDetail(true);

    return payload.session.id;
  }

  async function sendPromptStreaming(input: {
    sessionId: string;
    body: string;
    action?: StudyChatAction;
    uploadIds?: string[];
    tempAssistantId: string;
  }) {
    const response = await fetch(`/api/study-chat/sessions/${input.sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: input.body,
        action: input.action ?? "chat",
        uploadIds: input.uploadIds,
        stream: true,
      }),
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Failed to send message");
      }

      throw new Error((await response.text().catch(() => "")) || "Failed to send message");
    }

    if (!response.body) {
      throw new Error("Streaming response body was empty");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

      const parsed = extractSseEvents(buffer);
      buffer = parsed.remainder;

      for (const event of parsed.events) {
        if (event.event === "delta") {
          const payload = event.payload as StreamDeltaPayload;
          if (typeof payload?.delta === "string" && payload.delta.length > 0) {
            setThread((current) => {
              if (!current || current.session.id !== input.sessionId) {
                return current;
              }

              return {
                ...current,
                messages: current.messages.map((message) =>
                  message.id === input.tempAssistantId
                    ? { ...message, body: message.body + payload.delta }
                    : message
                ),
              };
            });
          }
        } else if (event.event === "done") {
          if (isSessionResponse(event.payload)) {
            if (event.payload.sessions) {
              setSessions(event.payload.sessions);
            }

            setActiveSessionId(event.payload.session.id);
            setThread({
              session: event.payload.session,
              messages: event.payload.messages,
              uploads: event.payload.uploads,
            });
            setShowMobileDetail(true);
            return;
          }
        } else if (event.event === "error") {
          const payload = event.payload as StreamErrorPayload;
          throw new Error(payload?.error || "Failed to send message");
        }
      }

      if (done) {
        break;
      }
    }

    throw new Error("The streamed reply ended before the final payload arrived");
  }

  function handleNewSession() {
    setActiveSessionId(null);
    setThread(null);
    setShowMobileDetail(true);
  }

  async function handleSend(action: StudyChatAction = "chat", promptText?: string) {
    const filesToUpload = promptText ? [] : pendingFiles;
    const body =
      (promptText ?? draft).trim() ||
      (filesToUpload.length > 0
        ? t("studyChat.defaultUploadMessage")
        : "");
    if (!body) {
      return;
    }

    try {
      setIsSending(true);

      let uploadedIds: string[] = [];
      if (filesToUpload.length > 0) {
        setIsUploading(true);
        uploadedIds = await Promise.all(
          filesToUpload.map(async (file) => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("scope", "study_chat");
            const response = await fetch("/api/uploads", {
              method: "POST",
              body: formData,
            });
            const payload = (await response.json().catch(() => null)) as
              | UploadResponse
              | { error?: string }
              | null;
            if (!response.ok || !payload || !("id" in payload)) {
              throw new Error(payload && "error" in payload ? payload.error : "Failed to upload file");
            }
            return payload.id;
          })
        );
        setPendingFiles([]);
      }

      let sessionId = activeSessionId;
      if (!sessionId) {
        sessionId = await createSession(uploadedIds.length ? { uploadIds: uploadedIds } : undefined);
        // uploads are already grounded via createSession — don't re-attach
        uploadedIds = [];
      }

      const now = new Date().toISOString();
      const optimisticUserId = `temp-user-${Date.now()}`;
      const optimisticAssistantId = `temp-assistant-${Date.now()}`;

      setThread((current) => {
        if (!current || current.session.id !== sessionId) {
          return current;
        }

        return {
          ...current,
          messages: [
            ...current.messages,
            {
              id: optimisticUserId,
              session_id: sessionId,
              role: "user",
              body,
              created_at: now,
            },
            {
              id: optimisticAssistantId,
              session_id: sessionId,
              role: "assistant",
              body: "",
              created_at: now,
            },
          ],
        };
      });

      await sendPromptStreaming({
        sessionId,
        body,
        action,
        uploadIds: uploadedIds.length ? uploadedIds : undefined,
        tempAssistantId: optimisticAssistantId,
      });

      if (!promptText) {
        setDraft("");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  }

  async function handleRename(sessionId: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    try {
      setIsRenaming(true);
      const response = await fetch(`/api/study-chat/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const payload = await response.json().catch(() => null) as { sessions?: StudyChatSessionSummary[] } | { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload && "error" in payload ? payload.error : "Failed to rename");
      }
      if (payload && "sessions" in payload && payload.sessions) {
        setSessions(payload.sessions);
      }
      if (thread?.session.id === sessionId) {
        setThread((t) => t ? { ...t, session: { ...t.session, title: trimmed } } : t);
      }
      setRenamingId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename session");
    } finally {
      setIsRenaming(false);
    }
  }

  async function handleDelete(sessionId: string) {
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/study-chat/sessions/${sessionId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null) as { sessions?: StudyChatSessionSummary[] } | { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload && "error" in payload ? payload.error : "Failed to delete");
      }
      const remaining = (payload && "sessions" in payload && payload.sessions) ? payload.sessions : sessions.filter((s) => s.id !== sessionId);
      setSessions(remaining);
      setConfirmDeleteId(null);
      if (activeSessionId === sessionId) {
        setActiveSessionId(remaining[0]?.id ?? null);
        setThread(null);
        setShowMobileDetail(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete session");
    } finally {
      setIsDeleting(false);
    }
  }

  const leftRail = (
    <div className="flex h-full min-h-0 flex-col" style={{ background: "hsl(var(--sidebar-background, var(--background)))" }}>
      {/* Rail header */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1 size-8 text-muted-foreground md:hidden" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold tracking-tight">{t("studyChat.title")}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleNewSession()}
            title={t("studyChat.newSession")}
            className="flex h-7 items-center gap-1.5 rounded-lg bg-primary/15 px-2.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/25"
          >
            <MessageSquarePlus className="size-3.5" />
            {t("studyChat.new")}
          </button>
        </div>

      </div>

      {/* Divider */}
      <div className="h-px bg-border/40" />

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loadingSessions ? (
          <div className="space-y-0.5">
            {[40, 56, 32, 48, 36].map((w, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-2">
                <div
                  className="h-3 animate-pulse rounded-md bg-muted-foreground/15"
                  style={{ width: `${w}%` }}
                />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 px-4 py-6 text-center">
            <p className="text-[12px] text-muted-foreground">{t("studyChat.emptyState")}</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sessions.map((session) => {
              const isActive = activeSessionId === session.id;
              const isMenuOpen = menuOpenId === session.id;
              const isRenameMode = renamingId === session.id;

              return (
                <div
                  key={session.id}
                  className={cn(
                    "group relative rounded-lg transition-all duration-150",
                    isActive ? "bg-accent" : "hover:bg-accent/60"
                  )}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenuOpenId(session.id);
                  }}
                >

                  {/* Rename inline mode */}
                  {isRenameMode ? (
                    <div className="flex items-center gap-1 px-2 py-2">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => setRenamingId(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRename(session.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="min-w-0 flex-1 bg-transparent text-[13px] leading-snug text-foreground outline-none border-b border-primary/50"
                        disabled={isRenaming}
                      />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void handleRename(session.id)}
                        disabled={isRenaming || !renameValue.trim()}
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-primary hover:bg-primary/15 disabled:opacity-40"
                      >
                        {isRenaming ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                      </button>
                    </div>
                  ) : (
                    /* Normal session row */
                    <div className="flex items-center gap-1 px-2 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSessionId(session.id);
                          setShowMobileDetail(true);
                          setMenuOpenId(null);
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className={cn(
                          "truncate text-[13px] leading-snug",
                          isActive ? "text-foreground" : "text-foreground/70"
                        )}>
                          {session.title}
                        </p>
                      </button>

                      {/* Actions menu trigger + popover */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(isMenuOpen ? null : session.id);
                          }}
                          className={cn(
                            "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all",
                            "opacity-0 group-hover:opacity-100",
                            isMenuOpen && "bg-accent opacity-100",
                            "hover:bg-accent hover:text-foreground"
                          )}
                        >
                          <MoreHorizontal className="size-3.5" />
                        </button>

                        {isMenuOpen && (
                          <>
                            {/* Backdrop */}
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setMenuOpenId(null)}
                            />
                            <div className="absolute right-0 top-7 z-20 w-36 overflow-hidden rounded-xl border border-border/60 bg-popover shadow-lg">
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  setRenamingId(session.id);
                                  setRenameValue(session.title);
                                }}
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-foreground hover:bg-accent"
                              >
                                <Pencil className="size-3.5 text-muted-foreground" />
                                {t("studyChat.rename")}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  setConfirmDeleteTitle(session.title);
                                  setConfirmDeleteId(session.id);
                                }}
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-destructive hover:bg-destructive/8"
                              >
                                <Trash2 className="size-3.5" />
                                {t("studyChat.delete")}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const isIdle = !thread && !activeSessionId;

  // Shared compose input content
  const composeInner = (
    <>
      {/* Pending file previews — animated expand/collapse */}
      <AnimatePresence>
        {pendingFiles.length > 0 && (
          <motion.div
            key="file-previews"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{ overflow: "hidden" }}
          >
            <div className="grid grid-cols-3 gap-2 pb-2.5 pt-0.5">
              <AnimatePresence mode="popLayout">
                {pendingFiles.map((file, index) => {
                  const isImage = file.type.startsWith("image/");
                  const Icon = isImage ? FileImage : FileText;
                  const typeLabel = isImage
                    ? t("studyChat.image")
                    : file.name.toLowerCase().endsWith(".pdf")
                    ? "PDF"
                    : t("studyChat.document");
                  return (
                    <motion.div
                      key={`${file.name}-${index}`}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 380, damping: 26 }}
                      className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-2.5 py-2"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium leading-tight text-foreground">
                          {file.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{typeLabel}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingFiles((prev) => prev.filter((_, i) => i !== index))
                        }
                        className="ml-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-muted-foreground/25 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
                      >
                        <X className="size-2.5" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input row */}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isSending}
          title={t("studyChat.attachFile")}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          {isUploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
        </button>
        <textarea
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            const el = event.target;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 180) + "px";
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend("chat");
            }
          }}
          placeholder={t("studyChat.placeholder")}
          rows={1}
          className="flex-1 resize-none bg-transparent text-[13px] leading-[1.6] outline-none placeholder:text-muted-foreground/60"
          style={{ minHeight: "24px", maxHeight: "180px" }}
          disabled={isSending}
        />
        <div className="flex shrink-0 items-center gap-1.5 pb-0.5">
          {!isIdle && !!thread?.uploads.length && (
            <div className="mr-1 text-[11px] text-muted-foreground/50">
              {t("studyChat.grounded").replace("{count}", String(thread.uploads.length))}
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleSend("chat")}
            disabled={isSending || (!draft.trim() && pendingFiles.length === 0)}
            className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/85 disabled:opacity-35 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </button>
        </div>
      </div>
    </>
  );

  const rightPane = (
    <div className="relative flex h-full min-h-0 flex-col bg-background">
      {/* Header + messages: only when active, takes flex-1 */}
      {/* No AnimatePresence — unmounts immediately so layout animation starts at the same time */}
        {!isIdle && (
          <motion.div
            key="active-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {/* Header */}
            <div className="border-b border-border/40 px-5 py-3">
              <div className="flex items-center gap-3">
                {isMobile ? (
                  <button
                    type="button"
                    onClick={() => setShowMobileDetail(false)}
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">
                    {thread?.session.title || activeSession?.title || t("studyChat.title")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {thread
                      ? thread.uploads.length === 1
                        ? t("studyChat.uploadsGrounded").replace("{count}", "1")
                        : t("studyChat.uploadsGroundedPlural").replace("{count}", String(thread.uploads.length))
                      : t("studyChat.uploadHint")}
                  </p>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-1.5">
                  {QUICK_ACTIONS.map(({ action, label, prompt, Icon }) => (
                    <button
                      key={action}
                      type="button"
                      disabled={isSending || isUploading || !thread?.uploads.length}
                      onClick={() => void handleSend(action, prompt)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all duration-150",
                        "border border-border/50 bg-background text-muted-foreground",
                        "hover:border-primary/40 hover:bg-primary/8 hover:text-primary",
                        "disabled:pointer-events-none disabled:opacity-35"
                      )}
                    >
                      <Icon className="size-3.5" />
                      {t(label)}
                    </button>
                  ))}
                </div>

              </div>

              {/* Upload chips */}
              {thread?.uploads.length ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {thread.uploads.map((upload) => {
                    const Icon = uploadIcon(upload);
                    return (
                      <div
                        key={upload.id}
                        className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-[11px] text-foreground/70"
                      >
                        <Icon className="size-3 shrink-0 text-primary/70" />
                        <span className="max-w-[160px] truncate">{upload.title || upload.original_filename || t("studyChat.untitledUpload")}</span>
                        {upload.language_detected && (
                          <span className="text-muted-foreground/60">{upload.language_detected}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {/* Message area */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {thread?.messages.length ? (
                <div className="mx-auto flex max-w-3xl flex-col gap-10">
                  {thread.messages.map((message) => (
                    <div key={message.id} className="flex flex-col">
                      {message.role === "user" ? (
                        <div className="flex justify-end">
                          <div className="max-w-[86%] rounded-2xl bg-primary px-4 py-3 text-primary-foreground">
                            <p className="whitespace-pre-wrap text-[13px] leading-[1.65]">{message.body}</p>
                          </div>
                        </div>
                      ) : (
                        message.body.trim() ? (
                          <StudyChatMarkdown content={message.body} className="text-foreground" />
                        ) : (
                          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                            <Loader2 className="size-3.5 animate-spin" />
                            Thinking…
                          </div>
                        )
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              ) : null}
            </div>
          </motion.div>
        )}

      {/* Motto: absolutely positioned so layout changes in the wrapper don't affect its exit position */}
      <AnimatePresence>
        {isIdle && (
          <motion.p
            key="motto"
            initial={{ opacity: 0, filter: "blur(8px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(8px)" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="pointer-events-none absolute inset-x-0 top-[calc(50%-80px)] text-center text-2xl font-semibold text-foreground"
          >
            {t("studyChat.idleMessage")}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Outer wrapper: plain div that instantly resizes — no animation on the container */}
      <div
        className={cn(
          isIdle ? "relative flex-1" : "px-4 pb-6 pt-3"
        )}
      >
        <motion.div
          layout="position"
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          className={cn(
            "w-full max-w-3xl",
            isIdle
              ? "absolute left-1/2 -translate-x-1/2 px-6"
              : "mx-auto"
          )}
          style={isIdle ? { top: "calc(50% - 22px)" } : undefined}
        >
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2.5 transition-colors focus-within:border-primary/40 focus-within:bg-background">
            {composeInner}
          </div>
        </motion.div>
      </div>
    </div>
  );

  return (
    <div className={cn("flex h-full min-h-0 bg-background [&_button]:cursor-pointer", isMobile ? "flex-col" : "flex-row")}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_STUDY_UPLOADS}
        className="hidden"
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? []);
          if (selected.length > 0) {
            setPendingFiles((prev) => [...prev, ...selected]);
          }
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />
      {isMobile ? (
        showMobileDetail && (thread || activeSessionId) ? (
          rightPane
        ) : (
          leftRail
        )
      ) : (
        <>
          <div className="w-[240px] shrink-0 border-r border-border/40">{leftRail}</div>
          <div className="min-w-0 flex-1">{rightPane}</div>
        </>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("studyChat.deleteSession")}</DialogTitle>
            <DialogDescription>
              {t("studyChat.deleteSessionConfirm").replace("{title}", confirmDeleteTitle)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmDeleteId(null)}
              disabled={isDeleting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => confirmDeleteId && void handleDelete(confirmDeleteId)}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
