import type {
  StudyChatMessage,
  StudyChatSession,
  UserUpload,
} from "@/types/database";

export type StudyChatAction =
  | "chat"
  | "summary"
  | "translation"
  | "vocabulary";

export interface StudyChatViewerLanguages {
  nativeLanguage: string;
  targetLanguage: string;
}

export interface StudyChatAttachedUpload extends UserUpload {
  attached_at: string;
}

export interface StudyChatSessionSummary extends StudyChatSession {
  latest_message: string | null;
  message_count: number;
  upload_count: number;
}

export interface StudyChatThread {
  session: StudyChatSessionSummary;
  messages: StudyChatMessage[];
  uploads: StudyChatAttachedUpload[];
}
