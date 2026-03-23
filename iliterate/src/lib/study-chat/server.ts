import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  selectGroundingChunks,
  chunkTextForGrounding,
  summarizeTextPreview,
} from "@/lib/study-chat/chunking";
import type {
  StudyChatAction,
  StudyChatAttachedUpload,
  StudyChatSessionSummary,
  StudyChatThread,
  StudyChatViewerLanguages,
} from "@/lib/study-chat/types";
import type { StudyChatMessage, StudyChatSession, UserUpload } from "@/types/database";

type DbClient = SupabaseClient;

const DEFAULT_SESSION_TITLE = "New study chat";
const MAX_SESSION_TITLE_LENGTH = 80;
const MAX_MESSAGE_BODY_LENGTH = 12000;

function getGeminiModel() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not set in environment variables");
  }

  const client = new GoogleGenerativeAI(apiKey);
  return client.getGenerativeModel({
    model: "gemini-2.5-flash",
  });
}

function normalizeSessionRow(row: Record<string, unknown>): StudyChatSession {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title:
      typeof row.title === "string" && row.title.trim().length > 0
        ? row.title
        : DEFAULT_SESSION_TITLE,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function normalizeMessageRow(row: Record<string, unknown>): StudyChatMessage {
  return {
    id: String(row.id),
    session_id: String(row.session_id),
    role: (row.role === "assistant" ? "assistant" : "user") as StudyChatMessage["role"],
    body: typeof row.body === "string" ? row.body : "",
    created_at: String(row.created_at),
  };
}

function normalizeUploadRow(row: Record<string, unknown>): UserUpload {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: typeof row.title === "string" ? row.title : null,
    scope: String(row.scope) as UserUpload["scope"],
    status: String(row.status) as UserUpload["status"],
    kind: String(row.kind) as UserUpload["kind"],
    storage_path: String(row.storage_path),
    original_filename:
      typeof row.original_filename === "string" ? row.original_filename : null,
    mime_type: typeof row.mime_type === "string" ? row.mime_type : null,
    file_size_bytes:
      typeof row.file_size_bytes === "number" ? row.file_size_bytes : null,
    source_url: typeof row.source_url === "string" ? row.source_url : null,
    extracted_text:
      typeof row.extracted_text === "string" ? row.extracted_text : null,
    language_detected:
      typeof row.language_detected === "string" ? row.language_detected : null,
    processed_at: typeof row.processed_at === "string" ? row.processed_at : null,
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null,
    created_at: String(row.created_at),
  };
}

function deriveTitle(input: {
  currentTitle?: string | null;
  message?: string;
  uploads?: Array<Pick<UserUpload, "title" | "original_filename">>;
}) {
  const existing = input.currentTitle?.trim();
  if (existing && existing !== DEFAULT_SESSION_TITLE) {
    return existing.slice(0, MAX_SESSION_TITLE_LENGTH);
  }

  const uploadTitle = input.uploads?.find(
    (upload) => upload.title?.trim() || upload.original_filename?.trim()
  );
  if (uploadTitle) {
    return (uploadTitle.title || uploadTitle.original_filename || DEFAULT_SESSION_TITLE).slice(
      0,
      MAX_SESSION_TITLE_LENGTH
    );
  }

  const messageTitle = input.message
    ?.replace(/\s+/g, " ")
    .trim()
    .replace(/[?.!]\s.*$/, "");
  if (messageTitle) {
    return messageTitle.slice(0, MAX_SESSION_TITLE_LENGTH);
  }

  return DEFAULT_SESSION_TITLE;
}

function truncateMessageBody(body: string) {
  const trimmed = body.trim();
  if (trimmed.length <= MAX_MESSAGE_BODY_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_MESSAGE_BODY_LENGTH - 1).trimEnd()}…`;
}

export async function getViewerLanguages(
  supabase: DbClient,
  userId: string
): Promise<StudyChatViewerLanguages> {
  const { data, error } = await supabase
    .from("profiles")
    .select("native_language, target_language")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    nativeLanguage:
      typeof data?.native_language === "string" ? data.native_language : "english",
    targetLanguage:
      typeof data?.target_language === "string" ? data.target_language : "english",
  };
}

export async function listStudyChatSessions(
  supabase: DbClient,
  userId: string
): Promise<StudyChatSessionSummary[]> {
  const { data: sessionRows, error: sessionError } = await supabase
    .from("study_chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(40);

  if (sessionError) {
    throw sessionError;
  }

  const sessions = (sessionRows ?? []).map((row) =>
    normalizeSessionRow(row as Record<string, unknown>)
  );

  if (sessions.length === 0) {
    return [];
  }

  const sessionIds = sessions.map((session) => session.id);

  const [{ data: messageRows, error: messageError }, { data: uploadRows, error: uploadError }] =
    await Promise.all([
      supabase
        .from("study_chat_messages")
        .select("id, session_id, role, body, created_at")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("study_chat_session_uploads")
        .select("session_id, upload_id")
        .in("session_id", sessionIds),
    ]);

  if (messageError) {
    throw messageError;
  }

  if (uploadError) {
    throw uploadError;
  }

  const latestMessageBySession = new Map<string, string | null>();
  const messageCountBySession = new Map<string, number>();

  for (const row of messageRows ?? []) {
    const sessionId = String(row.session_id);
    messageCountBySession.set(
      sessionId,
      (messageCountBySession.get(sessionId) ?? 0) + 1
    );

    if (!latestMessageBySession.has(sessionId)) {
      latestMessageBySession.set(
        sessionId,
        typeof row.body === "string" ? summarizeTextPreview(row.body, 120) : null
      );
    }
  }

  const uploadCountBySession = new Map<string, number>();
  for (const row of uploadRows ?? []) {
    const sessionId = String(row.session_id);
    uploadCountBySession.set(sessionId, (uploadCountBySession.get(sessionId) ?? 0) + 1);
  }

  return sessions.map((session) => ({
    ...session,
    latest_message: latestMessageBySession.get(session.id) ?? null,
    message_count: messageCountBySession.get(session.id) ?? 0,
    upload_count: uploadCountBySession.get(session.id) ?? 0,
  }));
}

export async function getStudyChatThread(
  supabase: DbClient,
  userId: string,
  sessionId: string
): Promise<StudyChatThread | null> {
  const { data: sessionRow, error: sessionError } = await supabase
    .from("study_chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (sessionError) {
    throw sessionError;
  }

  if (!sessionRow) {
    return null;
  }

  const session = normalizeSessionRow(sessionRow as Record<string, unknown>);

  const [{ data: messageRows, error: messageError }, { data: attachedRows, error: attachedError }] =
    await Promise.all([
      supabase
        .from("study_chat_messages")
        .select("*")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("study_chat_session_uploads")
        .select("*")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true }),
    ]);

  if (messageError) {
    throw messageError;
  }

  if (attachedError) {
    throw attachedError;
  }

  const attachmentRows = (attachedRows ?? []) as Array<Record<string, unknown>>;
  const uploadIds = attachmentRows.map((row) => String(row.upload_id));

  let uploads: StudyChatAttachedUpload[] = [];
  if (uploadIds.length > 0) {
    const { data: uploadRows, error: uploadError } = await supabase
      .from("user_uploads")
      .select("*")
      .in("id", uploadIds);

    if (uploadError) {
      throw uploadError;
    }

    const uploadMap = new Map(
      (uploadRows ?? []).map((row) => {
        const upload = normalizeUploadRow(row as Record<string, unknown>);
        return [upload.id, upload] as const;
      })
    );

    uploads = attachmentRows.flatMap((row) => {
      const upload = uploadMap.get(String(row.upload_id));
      if (!upload) {
        return [];
      }

      return [
        {
          ...upload,
          attached_at: String(row.created_at),
        },
      ];
    });
  }

  const messages = (messageRows ?? []).map((row) =>
    normalizeMessageRow(row as Record<string, unknown>)
  );

  return {
    session: {
      ...session,
      latest_message:
        messages.length > 0 ? summarizeTextPreview(messages[messages.length - 1].body, 120) : null,
      message_count: messages.length,
      upload_count: uploads.length,
    },
    messages,
    uploads,
  };
}

async function validateStudyChatUploads(
  supabase: DbClient,
  userId: string,
  uploadIds: string[]
) {
  const { data: uploadRows, error } = await supabase
    .from("user_uploads")
    .select("*")
    .eq("user_id", userId)
    .eq("scope", "study_chat")
    .in("id", uploadIds);

  if (error) {
    throw error;
  }

  const uploads = (uploadRows ?? []).map((row) =>
    normalizeUploadRow(row as Record<string, unknown>)
  );

  if (uploads.length !== uploadIds.length) {
    throw new Error("One or more uploads could not be attached to study chat");
  }

  return uploads;
}

export async function attachUploadsToSession(
  supabase: DbClient,
  userId: string,
  sessionId: string,
  uploadIds: string[]
) {
  const dedupedIds = Array.from(new Set(uploadIds));
  if (dedupedIds.length === 0) {
    return;
  }

  await validateStudyChatUploads(supabase, userId, dedupedIds);

  const { error } = await supabase
    .from("study_chat_session_uploads")
    .upsert(
      dedupedIds.map((uploadId) => ({
        session_id: sessionId,
        upload_id: uploadId,
      })),
      {
        onConflict: "session_id,upload_id",
        ignoreDuplicates: true,
      }
    );

  if (error) {
    throw error;
  }

  const { error: sessionUpdateError } = await supabase
    .from("study_chat_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (sessionUpdateError) {
    throw sessionUpdateError;
  }
}

export async function createStudyChatSession(
  supabase: DbClient,
  userId: string,
  input?: {
    title?: string;
    uploadIds?: string[];
  }
) {
  const uploadIds = Array.from(new Set(input?.uploadIds ?? []));
  const uploads = uploadIds.length
    ? await validateStudyChatUploads(supabase, userId, uploadIds)
    : [];

  const title = deriveTitle({
    currentTitle: input?.title,
    uploads,
  });

  const { data: sessionRow, error: sessionError } = await supabase
    .from("study_chat_sessions")
    .insert({
      user_id: userId,
      title,
    })
    .select("*")
    .single();

  if (sessionError || !sessionRow) {
    throw sessionError ?? new Error("Failed to create study chat session");
  }

  const session = normalizeSessionRow(sessionRow as Record<string, unknown>);

  if (uploadIds.length > 0) {
    await attachUploadsToSession(supabase, userId, session.id, uploadIds);
  }

  const thread = await getStudyChatThread(supabase, userId, session.id);
  if (!thread) {
    throw new Error("Failed to load study chat session");
  }

  return thread;
}

function formatConversationHistory(messages: StudyChatMessage[]) {
  return messages
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${message.body}`)
    .join("\n\n");
}

function buildGroundingContext(
  uploads: StudyChatAttachedUpload[],
  prompt: string,
  action: StudyChatAction
) {
  const groundedUploads = uploads.filter(
    (upload) => upload.extracted_text && upload.extracted_text.trim().length > 0
  );

  if (groundedUploads.length === 0) {
    return {
      context: "",
      hasGrounding: false,
    };
  }

  const sections = groundedUploads.map((upload) => {
    const chunks = chunkTextForGrounding(upload.extracted_text ?? "");
    const selected = selectGroundingChunks(chunks, prompt, {
      maxChunks: action === "translation" ? 6 : 4,
      mode: action,
    });
    const header = [
      `Upload: ${upload.title || upload.original_filename || "Untitled upload"}`,
      `Language: ${upload.language_detected || "unknown"}`,
      `Kind: ${upload.kind}`,
      `Status: ${upload.status}`,
    ].join(" | ");

    const chunkText = selected
      .map(
        (chunk) =>
          `[chunk ${chunk.index + 1}, chars ${chunk.startOffset}-${chunk.endOffset}]\n${chunk.text}`
      )
      .join("\n\n");

    return `${header}\n${chunkText}`;
  });

  return {
    context: sections.join("\n\n---\n\n"),
    hasGrounding: true,
  };
}

function actionInstructions(action: StudyChatAction, languages: StudyChatViewerLanguages) {
  switch (action) {
    case "summary":
      return `Reply in ${languages.nativeLanguage}. Provide a concise study summary with:
- a 2-3 sentence overview
- key details or arguments
- 3 follow-up prompts the learner could ask next`;
    case "translation":
      return `Reply in ${languages.nativeLanguage}. Translate the grounded material into clear learner-friendly language.
If the full document is too long for a complete line-by-line translation, translate the most important sections, explain the structure, and tell the learner to ask for a specific passage next.`;
    case "vocabulary":
      return `Reply in ${languages.nativeLanguage}. Extract 6-10 useful vocabulary items from the grounded material.
For each item, include:
- the source term or phrase
- a concise meaning in ${languages.nativeLanguage}
- why it matters in context
- a short quoted example from the material`;
    case "chat":
    default:
      return "Answer the learner's question directly. Use the grounded material first and say clearly when the answer is not present in the uploaded text.";
  }
}

async function generateAssistantReply(input: {
  prompt: string;
  action: StudyChatAction;
  uploads: StudyChatAttachedUpload[];
  conversation: StudyChatMessage[];
  viewerLanguages: StudyChatViewerLanguages;
}) {
  const grounding = buildGroundingContext(input.uploads, input.prompt, input.action);

  if (!grounding.hasGrounding) {
    return "I don't have extracted study material in this session yet. Upload a PDF, DOCX, or image with readable text first, then ask me to summarize, translate, or explain it.";
  }

  const prompt = [
    "You are iLiterate Study Chat, a document-grounded language-learning assistant.",
    "Rules:",
    "- Use only the grounded material below when making factual claims.",
    "- If the material does not contain the answer, say so plainly.",
    "- Cite upload titles when referring to specific evidence.",
    "- Keep the response practical for a language learner.",
    "",
    `Learner native language: ${input.viewerLanguages.nativeLanguage}`,
    `Learner target language: ${input.viewerLanguages.targetLanguage}`,
    `Requested mode: ${input.action}`,
    actionInstructions(input.action, input.viewerLanguages),
    "",
    "Recent conversation:",
    formatConversationHistory(input.conversation) || "No prior messages.",
    "",
    "Grounded material:",
    grounding.context,
    "",
    `Latest learner request:\n${input.prompt}`,
  ].join("\n");

  const result = await getGeminiModel().generateContent(prompt);
  const text = result.response.text().trim();
  return truncateMessageBody(text || "I couldn't produce a response for that request.");
}

export async function createStudyChatReply(params: {
  supabase: DbClient;
  userId: string;
  sessionId: string;
  body: string;
  action: StudyChatAction;
  uploadIds?: string[];
}) {
  const threadBefore = await getStudyChatThread(
    params.supabase,
    params.userId,
    params.sessionId
  );

  if (!threadBefore) {
    throw new Error("Study chat session not found");
  }

  if (params.uploadIds && params.uploadIds.length > 0) {
    await attachUploadsToSession(
      params.supabase,
      params.userId,
      params.sessionId,
      params.uploadIds
    );
  }

  const { data: userMessageRow, error: userMessageError } = await params.supabase
    .from("study_chat_messages")
    .insert({
      session_id: params.sessionId,
      role: "user",
      body: truncateMessageBody(params.body),
    })
    .select("*")
    .single();

  if (userMessageError || !userMessageRow) {
    throw userMessageError ?? new Error("Failed to save study chat message");
  }

  const threadWithUserMessage = await getStudyChatThread(
    params.supabase,
    params.userId,
    params.sessionId
  );

  if (!threadWithUserMessage) {
    throw new Error("Study chat session not found after saving message");
  }

  const viewerLanguages = await getViewerLanguages(params.supabase, params.userId);

  let assistantBody: string;
  try {
    assistantBody = await generateAssistantReply({
      prompt: params.body,
      action: params.action,
      uploads: threadWithUserMessage.uploads,
      conversation: threadWithUserMessage.messages,
      viewerLanguages,
    });
  } catch (error) {
    console.error("Study chat generation failed:", error);
    assistantBody =
      "I couldn't analyze that material just now. Please try again in a moment, or narrow the request to a smaller passage.";
  }

  const { error: assistantError } = await params.supabase
    .from("study_chat_messages")
    .insert({
      session_id: params.sessionId,
      role: "assistant",
      body: assistantBody,
    });

  if (assistantError) {
    throw assistantError;
  }

  const title = deriveTitle({
    currentTitle: threadWithUserMessage.session.title,
    message: params.body,
    uploads: threadWithUserMessage.uploads,
  });

  const { error: sessionUpdateError } = await params.supabase
    .from("study_chat_sessions")
    .update({
      title,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.sessionId)
    .eq("user_id", params.userId);

  if (sessionUpdateError) {
    throw sessionUpdateError;
  }

  const thread = await getStudyChatThread(params.supabase, params.userId, params.sessionId);
  if (!thread) {
    throw new Error("Failed to reload study chat thread");
  }

  return thread;
}

export function summarizeUploadForBadge(upload: StudyChatAttachedUpload) {
  return upload.title || upload.original_filename || "Untitled upload";
}
