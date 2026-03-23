"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  Download,
  FileImage,
  FileText,
  Languages,
  Loader2,
  MessageCircle,
  Search,
  UserRoundPlus,
} from "lucide-react";
import { toast } from "sonner";

import { useIsMobile } from "@/hooks/use-mobile";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageComposer,
  type MessageComposerSubmitPayload,
} from "@/components/social/MessageComposer";
import { SocialProfileGate } from "@/components/social/SocialProfileGate";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type {
  DirectConversation,
  DirectMessage,
  DirectMessageAttachment,
  DirectMessageAttachmentType,
  FriendshipWithProfile,
  PublicProfile,
  RelationshipState,
  SocialSearchResult,
} from "@/types/database";

interface ConversationListItem extends DirectConversation {
  friend: PublicProfile;
  unread_count: number;
}

interface FriendshipsPayload {
  incoming_requests?: FriendshipWithProfile[];
  outgoing_requests?: FriendshipWithProfile[];
  friends?: FriendshipWithProfile[];
  incomingRequests?: FriendshipWithProfile[];
  outgoingRequests?: FriendshipWithProfile[];
}

interface ConversationsPayload {
  conversations?: ConversationListItem[];
}

interface ConversationDetailsPayload {
  conversation?: ConversationListItem;
  messages?: DirectMessage[];
}

interface ViewerLanguages {
  nativeLanguage: string;
  targetLanguage: string;
}

interface UploadAttachmentPayload {
  uploadId: string;
  attachmentType: DirectMessageAttachmentType;
  fileName: string | null;
  mimeType: string | null;
  extractedText: string | null;
  detectedLanguage: string | null;
}

interface TranslationState {
  loading: boolean;
  text: string | null;
  sourceLanguage: string | null;
  error: string | null;
}

interface AttachmentUrlState {
  loading: boolean;
  url: string | null;
  error: string | null;
}

const MAX_TRANSLATION_CHARS = 4000;

const relationshipLabel: Record<RelationshipState, string> = {
  none: "New",
  incoming: "Incoming",
  outgoing: "Pending",
  friends: "Friends",
};

function inferAttachmentType(file: File): DirectMessageAttachmentType | null {
  const mimeType = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }

  return null;
}

function attachmentLabel(type: DirectMessageAttachmentType) {
  switch (type) {
    case "image":
      return "Image";
    case "pdf":
      return "PDF";
    case "docx":
      return "Document";
  }
}

function attachmentIcon(type: DirectMessageAttachmentType) {
  switch (type) {
    case "image":
      return FileImage;
    case "pdf":
      return FileText;
    case "docx":
      return FileText;
  }
}

function normalizeFriendshipItems(items: unknown[]): FriendshipWithProfile[] {
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    if (record.friendship && record.profile) {
      return [record as unknown as FriendshipWithProfile];
    }

    const profile = (record.person ?? record.profile) as PublicProfile | undefined;
    if (!profile || !record.id) {
      return [];
    }

    return [
      {
        friendship: {
          id: String(record.id),
          requester_id: String(record.requester_id),
          recipient_id: String(record.recipient_id),
          user_one_id: String(record.user_one_id),
          user_two_id: String(record.user_two_id),
          status: record.status as FriendshipWithProfile["friendship"]["status"],
          responded_at:
            typeof record.responded_at === "string" ? record.responded_at : null,
          created_at: String(record.created_at),
          updated_at: String(record.updated_at),
        },
        profile,
      },
    ];
  });
}

function normalizeSearchResults(items: unknown[]): SocialSearchResult[] {
  return items.flatMap<SocialSearchResult>((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    if (record.profile) {
      return [record as unknown as SocialSearchResult];
    }

    const friendshipRecord =
      record.friendship && typeof record.friendship === "object"
        ? (record.friendship as Record<string, unknown>)
        : null;

    return [
      {
        profile: {
          id: String(record.id),
          username:
            typeof record.username === "string" ? record.username : null,
          display_name:
            typeof record.display_name === "string"
              ? record.display_name
              : "Learner",
          avatar_seed:
            typeof record.avatar_seed === "string" ? record.avatar_seed : null,
          created_at: typeof record.created_at === "string" ? record.created_at : new Date(0).toISOString(),
          updated_at: typeof record.updated_at === "string" ? record.updated_at : new Date(0).toISOString(),
        },
        relationship: (record.relationship as RelationshipState) ?? "none",
        matched_by:
          (record.matched_by as SocialSearchResult["matched_by"]) ?? "display_name",
        friendship:
          friendshipRecord
            ? ({
                id: typeof friendshipRecord.id === "string" ? friendshipRecord.id : "",
                requester_id:
                  typeof friendshipRecord.requester_id === "string"
                    ? friendshipRecord.requester_id
                    : "",
                recipient_id:
                  typeof friendshipRecord.recipient_id === "string"
                    ? friendshipRecord.recipient_id
                    : "",
                user_one_id:
                  typeof friendshipRecord.user_one_id === "string"
                    ? friendshipRecord.user_one_id
                    : "",
                user_two_id:
                  typeof friendshipRecord.user_two_id === "string"
                    ? friendshipRecord.user_two_id
                    : "",
                status:
                  typeof friendshipRecord.status === "string"
                    ? (friendshipRecord.status as NonNullable<SocialSearchResult["friendship"]>["status"])
                    : "pending",
                responded_at:
                  typeof friendshipRecord.responded_at === "string"
                    ? friendshipRecord.responded_at
                    : null,
                created_at:
                  typeof friendshipRecord.created_at === "string"
                    ? friendshipRecord.created_at
                    : new Date(0).toISOString(),
                updated_at:
                  typeof friendshipRecord.updated_at === "string"
                    ? friendshipRecord.updated_at
                    : new Date(0).toISOString(),
              })
            : null,
        friendship_id:
          friendshipRecord && typeof friendshipRecord.id === "string"
            ? friendshipRecord.id
            : null,
      },
    ];
  });
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "No activity yet";
  }

  const date = new Date(value);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString();
}

function getFriendFromConversation(
  conversation: DirectConversation,
  currentUserId: string,
  knownProfiles: Record<string, PublicProfile>
): PublicProfile | undefined {
  if (conversation.friend) {
    return conversation.friend;
  }

  const friendId =
    conversation.user_one_id === currentUserId
      ? conversation.user_two_id
      : conversation.user_one_id;

  return knownProfiles[friendId];
}

export function SocialHub() {
  const supabase = createClient();
  const isMobile = useIsMobile();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SocialSearchResult[]>([]);

  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [viewerLanguages, setViewerLanguages] = useState<ViewerLanguages | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<FriendshipWithProfile[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendshipWithProfile[]>([]);
  const [friends, setFriends] = useState<FriendshipWithProfile[]>([]);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationListItem | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [activeTab, setActiveTab] = useState("requests");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageTranslations, setMessageTranslations] = useState<Record<string, TranslationState>>({});
  const [attachmentTranslations, setAttachmentTranslations] = useState<Record<string, TranslationState>>({});
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, AttachmentUrlState>>({});
  const [expandedAttachmentIds, setExpandedAttachmentIds] = useState<Record<string, boolean>>({});

  const profileLookup = useMemo(() => {
    const entries = friends.map(({ profile }) => [profile.id, profile] as const);
    return Object.fromEntries(entries);
  }, [friends]);

  const pendingCount = incomingRequests.length + outgoingRequests.length;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadPublicProfile = async () => {
    const response = await fetch("/api/social/public-profile");
    if (response.status === 404) {
      setPublicProfile(null);
      return;
    }

    if (!response.ok) {
      throw new Error("Failed to load social profile");
    }

    const payload = await response.json();
    setPublicProfile((payload.public_profile ?? payload.publicProfile ?? payload) as PublicProfile);
  };

  const loadViewerLanguages = async () => {
    const response = await fetch("/api/profile");
    if (!response.ok) {
      throw new Error("Failed to load profile languages");
    }

    const payload = (await response.json()) as {
      native_language?: string;
      target_language?: string;
    };

    setViewerLanguages({
      nativeLanguage: payload.native_language ?? "en",
      targetLanguage: payload.target_language ?? "en",
    });
  };

  const loadFriendships = async () => {
    const response = await fetch("/api/social/friendships");
    if (!response.ok) {
      throw new Error("Failed to load friendships");
    }

    const payload = (await response.json()) as FriendshipsPayload;
    setIncomingRequests(
      normalizeFriendshipItems(
        (payload.incoming_requests ?? payload.incomingRequests ?? []) as unknown[]
      )
    );
    setOutgoingRequests(
      normalizeFriendshipItems(
        (payload.outgoing_requests ?? payload.outgoingRequests ?? []) as unknown[]
      )
    );
    setFriends(normalizeFriendshipItems((payload.friends ?? []) as unknown[]));
  };

  const loadConversations = async () => {
    const response = await fetch("/api/social/conversations");
    if (!response.ok) {
      throw new Error("Failed to load conversations");
    }

    const payload = (await response.json()) as ConversationsPayload;
    const nextConversations = (payload.conversations ?? []).map((conversation) => ({
      ...conversation,
      friend:
        conversation.friend ??
        getFriendFromConversation(conversation, publicProfile?.id ?? "", profileLookup) ??
        {
          id:
            conversation.user_one_id === publicProfile?.id
              ? conversation.user_two_id
              : conversation.user_one_id,
          username: null,
          display_name: "Study partner",
          avatar_seed: null,
          created_at: conversation.created_at,
          updated_at: conversation.updated_at,
        },
      unread_count: conversation.unread_count ?? 0,
    }));

    setConversations(nextConversations);

    if (!activeConversation && !isMobile && nextConversations.length > 0) {
      void openConversation(nextConversations[0].id);
    }
  };

  const loadMessages = useCallback(async (conversationId: string) => {
    const response = await fetch(`/api/social/conversations/${conversationId}/messages`);
    if (!response.ok) {
      throw new Error("Failed to load messages");
    }

    const payload = (await response.json()) as ConversationDetailsPayload;
    if (payload.conversation) {
      const friend =
        payload.conversation.friend ??
        getFriendFromConversation(payload.conversation, publicProfile?.id ?? "", profileLookup) ??
        activeConversation?.friend;

      setActiveConversation({
        ...payload.conversation,
        friend:
          friend ??
          {
            id:
              payload.conversation.user_one_id === publicProfile?.id
                ? payload.conversation.user_two_id
                : payload.conversation.user_one_id,
            username: null,
            display_name: "Study partner",
            avatar_seed: null,
            created_at: payload.conversation.created_at,
            updated_at: payload.conversation.updated_at,
          },
        unread_count: payload.conversation.unread_count ?? 0,
      });
    }

    setMessages(payload.messages ?? []);
    setTimeout(scrollToBottom, 0);
  }, [activeConversation?.friend, profileLookup, publicProfile?.id]);

  const ensureAttachmentUrl = useCallback(async (attachmentId: string) => {
    const existing = attachmentUrls[attachmentId];
    if (existing?.url) {
      return existing.url;
    }

    setAttachmentUrls((current) => ({
      ...current,
      [attachmentId]: {
        loading: true,
        url: current[attachmentId]?.url ?? null,
        error: null,
      },
    }));

    try {
      const response = await fetch(`/api/social/attachments/${attachmentId}`);
      const payload = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "Failed to load attachment");
      }

      setAttachmentUrls((current) => ({
        ...current,
        [attachmentId]: {
          loading: false,
          url: payload.url ?? null,
          error: null,
        },
      }));

      return payload.url;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load attachment";
      setAttachmentUrls((current) => ({
        ...current,
        [attachmentId]: {
          loading: false,
          url: null,
          error: message,
        },
      }));
      throw error;
    }
  }, [attachmentUrls]);

  const detectLanguage = useCallback(async (text: string) => {
    const response = await fetch("/api/content/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const payload = (await response.json().catch(() => null)) as {
      language?: string;
      error?: string;
    } | null;

    if (!response.ok || !payload?.language) {
      throw new Error(payload?.error || "Failed to detect language");
    }

    return payload.language;
  }, []);

  const translateSnippet = useCallback(async (
    text: string,
    detectedLanguage: string | null | undefined
  ) => {
    if (!viewerLanguages) {
      throw new Error("Profile languages are not available yet");
    }

    const trimmed = text.trim().slice(0, MAX_TRANSLATION_CHARS);
    if (!trimmed) {
      throw new Error("No text available to translate");
    }

    const sourceLang =
      detectedLanguage?.trim() || (await detectLanguage(trimmed.slice(0, 1500)));

    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: trimmed,
        sourceLang,
        targetLang: viewerLanguages.nativeLanguage,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      translation?: string;
      error?: string;
    } | null;

    if (!response.ok || !payload?.translation) {
      throw new Error(payload?.error || "Failed to translate content");
    }

    return {
      text: payload.translation,
      sourceLanguage: sourceLang,
    };
  }, [detectLanguage, viewerLanguages]);

  const refreshLists = async () => {
    await loadFriendships();
    if (publicProfile?.username) {
      await loadConversations();
    }
  };

  const bootSocialHub = useEffectEvent(async () => {
    try {
      setIsLoading(true);
      await Promise.all([loadPublicProfile(), loadViewerLanguages(), loadFriendships()]);
    } finally {
      setIsLoading(false);
    }
  });

  const refreshConversationList = useEffectEvent(async () => {
    if (!publicProfile?.username) {
      return;
    }

    await loadConversations();
  });

  useEffect(() => {
    void bootSocialHub().catch((error) => {
      const message = error instanceof Error ? error.message : "Failed to load social hub";
      toast.error(message);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!publicProfile?.username) {
      return;
    }

    void refreshConversationList().catch((error) => {
      const message = error instanceof Error ? error.message : "Failed to load conversations";
      toast.error(message);
    });
  }, [publicProfile?.username, publicProfile?.id, friends.length]);

  useEffect(() => {
    if (!activeConversation?.id) {
      return;
    }

    setTimeout(scrollToBottom, 0);
  }, [messages, activeConversation?.id]);

  useEffect(() => {
    const imageAttachments = messages.flatMap((message) =>
      (message.attachments ?? []).filter(
        (attachment) => attachment.attachment_type === "image"
      )
    );

    imageAttachments.forEach((attachment) => {
      if (!attachmentUrls[attachment.id]?.url && !attachmentUrls[attachment.id]?.loading) {
        void ensureAttachmentUrl(attachment.id).catch(() => null);
      }
    });
  }, [attachmentUrls, ensureAttachmentUrl, messages]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!publicProfile?.username) {
      return;
    }

    if (query.length < 2 && !query.includes("@")) {
      setSearchResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setIsSearching(true);
        const response = await fetch(`/api/social/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
          throw new Error("Failed to search for learners");
        }

        const payload = await response.json();
        setSearchResults(normalizeSearchResults(payload.results ?? []));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to search for learners";
        toast.error(message);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchQuery, publicProfile?.username]);

  useEffect(() => {
    if (!activeConversation?.id) {
      return;
    }

    const channel = supabase
      .channel(`social-conversation-${activeConversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=eq.${activeConversation.id}`,
        },
        () => {
          void loadMessages(activeConversation.id).catch(() => null);
          void refreshConversationList().catch(() => null);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeConversation?.id, loadMessages, supabase]);

  const markConversationRead = async (conversationId: string) => {
    const response = await fetch(`/api/social/conversations/${conversationId}/read`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to update read state");
    }

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unread_count: 0 }
          : conversation
      )
    );
  };

  const openConversation = async (conversationId: string) => {
    await loadMessages(conversationId);
    await markConversationRead(conversationId);
  };

  const openConversationWithFriend = async (friendId: string) => {
    const existingConversation = conversations.find((conversation) => conversation.friend.id === friendId);
    if (existingConversation) {
      await openConversation(existingConversation.id);
      setActiveTab("chats");
      return;
    }

    const response = await fetch("/api/social/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ friendId }),
    });

    const payload = (await response.json().catch(() => null)) as ConversationDetailsPayload | null;
    if (!response.ok || !payload?.conversation) {
      throw new Error(payload && "error" in payload ? String((payload as { error?: unknown }).error) : "Failed to open conversation");
    }

    const friend =
      payload.conversation.friend ??
      profileLookup[friendId] ?? {
        id: friendId,
        username: null,
        display_name: "Study partner",
        avatar_seed: null,
        created_at: payload.conversation.created_at,
        updated_at: payload.conversation.updated_at,
      };

    const nextConversation = {
      ...payload.conversation,
      friend,
      unread_count: payload.conversation.unread_count ?? 0,
    };

    setActiveConversation(nextConversation);
    setMessages(payload.messages ?? []);
    setConversations((current) => {
      const filtered = current.filter((conversation) => conversation.id !== nextConversation.id);
      return [nextConversation, ...filtered];
    });
    setActiveTab("chats");
    setTimeout(scrollToBottom, 0);
  };

  const handleFriendshipAction = async (friendshipId: string, action: "accept" | "decline" | "cancel" | "remove") => {
    const request =
      action === "remove"
        ? fetch(`/api/social/friendships/${friendshipId}`, { method: "DELETE" })
        : fetch(`/api/social/friendships/${friendshipId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action }),
          });

    const response = await request;
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error || "Failed to update friend request");
    }

    await refreshLists();
    if (searchQuery.trim()) {
      setSearchQuery((current) => current);
    }
  };

  const handleSendFriendRequest = async (recipientId: string) => {
    const response = await fetch("/api/social/friendships", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipientId }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || "Failed to send friend request");
    }

    toast.success("Friend request sent");
    await refreshLists();
  };

  const handleSendMessage = async ({ body, files }: MessageComposerSubmitPayload) => {
    if (!activeConversation) {
      return;
    }

    setIsSendingMessage(true);
    try {
      const attachments: UploadAttachmentPayload[] = [];

      for (const file of files) {
        const attachmentType = inferAttachmentType(file);
        if (!attachmentType) {
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("scope", "dm_attachment");
        if (attachmentType !== "image") {
          formData.append("extractText", "true");
        }

        const uploadResponse = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });
        const uploadPayload = (await uploadResponse.json().catch(() => null)) as
          | {
              id?: string;
              upload?: {
                id?: string;
                original_filename?: string | null;
                mime_type?: string | null;
                extracted_text?: string | null;
                language_detected?: string | null;
              };
              original_filename?: string | null;
              originalFilename?: string | null;
              mime_type?: string | null;
              mimeType?: string | null;
              extracted_text?: string | null;
              extractedText?: string | null;
              language_detected?: string | null;
              languageDetected?: string | null;
              error?: string;
            }
          | null;

        if (!uploadResponse.ok) {
          throw new Error(uploadPayload?.error || `Failed to upload ${file.name}`);
        }

        const uploadId =
          uploadPayload?.id ||
          uploadPayload?.upload?.id ||
          null;

        if (!uploadId) {
          throw new Error(`Upload response for ${file.name} did not include an id`);
        }

        attachments.push({
          uploadId,
          attachmentType,
          fileName:
            uploadPayload?.original_filename ??
            uploadPayload?.originalFilename ??
            uploadPayload?.upload?.original_filename ??
            file.name,
          mimeType:
            uploadPayload?.mime_type ??
            uploadPayload?.mimeType ??
            uploadPayload?.upload?.mime_type ??
            file.type ??
            null,
          extractedText:
            uploadPayload?.extracted_text ??
            uploadPayload?.extractedText ??
            uploadPayload?.upload?.extracted_text ??
            null,
          detectedLanguage:
            uploadPayload?.language_detected ??
            uploadPayload?.languageDetected ??
            uploadPayload?.upload?.language_detected ??
            null,
        });
      }

      const response = await fetch(`/api/social/conversations/${activeConversation.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body, attachments }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to send message");
      }

      const nextMessage = (payload?.message ?? payload) as DirectMessage;
      if (nextMessage?.id) {
        setMessages((current) => [...current, nextMessage]);
      } else {
        await loadMessages(activeConversation.id);
      }

      await loadConversations();
      setTimeout(scrollToBottom, 0);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleTranslateMessage = async (message: DirectMessage) => {
    setMessageTranslations((current) => ({
      ...current,
      [message.id]: {
        loading: true,
        text: current[message.id]?.text ?? null,
        sourceLanguage: current[message.id]?.sourceLanguage ?? null,
        error: null,
      },
    }));

    try {
      const translated = await translateSnippet(message.body, null);
      setMessageTranslations((current) => ({
        ...current,
        [message.id]: {
          loading: false,
          text: translated.text,
          sourceLanguage: translated.sourceLanguage,
          error: null,
        },
      }));
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : "Failed to translate message";
      setMessageTranslations((current) => ({
        ...current,
        [message.id]: {
          loading: false,
          text: null,
          sourceLanguage: null,
          error: messageText,
        },
      }));
      toast.error(messageText);
    }
  };

  const handleTranslateAttachment = async (attachment: DirectMessageAttachment) => {
    setAttachmentTranslations((current) => ({
      ...current,
      [attachment.id]: {
        loading: true,
        text: current[attachment.id]?.text ?? null,
        sourceLanguage: current[attachment.id]?.sourceLanguage ?? null,
        error: null,
      },
    }));

    try {
      const translated = await translateSnippet(
        attachment.extracted_text ?? "",
        attachment.detected_language
      );
      setAttachmentTranslations((current) => ({
        ...current,
        [attachment.id]: {
          loading: false,
          text: translated.text,
          sourceLanguage: translated.sourceLanguage,
          error: null,
        },
      }));
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : "Failed to translate attachment";
      setAttachmentTranslations((current) => ({
        ...current,
        [attachment.id]: {
          loading: false,
          text: null,
          sourceLanguage: null,
          error: messageText,
        },
      }));
      toast.error(messageText);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const derivedDisplayName =
    publicProfile?.display_name ?? "Learner";

  if (!publicProfile?.username) {
    return (
      <div className="flex justify-center p-8 pt-16">
        <div className="w-full max-w-2xl">
          <SocialProfileGate
            initialDisplayName={derivedDisplayName}
            initialUsername={publicProfile?.username}
            onSaved={(profile) => {
              setPublicProfile(profile);
              toast.success("Your social workspace is ready");
            }}
          />
        </div>
      </div>
    );
  }

  const activeConversationFriend = activeConversation?.friend;

  // Helper: generate avatar initials + color from name
  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };
  const avatarColors = ["bg-primary", "bg-chart-4", "bg-chart-3", "bg-[#5C7A8A]", "bg-[#8A5C7A]"];
  const getAvatarColor = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  const toggleAttachmentExpanded = (attachmentId: string) => {
    setExpandedAttachmentIds((current) => ({
      ...current,
      [attachmentId]: !current[attachmentId],
    }));
  };

  const openAttachment = async (attachment: DirectMessageAttachment) => {
    try {
      const url = await ensureAttachmentUrl(attachment.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open attachment");
    }
  };

  const leftColumn = (
    <div className="flex h-full flex-col">
      {/* Header: Messages + Add Friends */}
      <div className="flex flex-col gap-3 border-b px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="size-7 text-muted-foreground" />
            <span className="text-lg font-semibold tracking-tight">Messages</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            title="Find friends"
            onClick={() => setActiveTab("friends")}
          >
            <UserRoundPlus className="size-4" />
          </Button>
        </div>
        {/* Search — context-aware placeholder */}
        <div className="relative">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-9 h-9 bg-muted/50 border-0"
            placeholder={activeTab === "friends" || activeTab === "requests" ? "Search by username, name, or email..." : "Search conversations..."}
          />
        </div>
      </div>

      {/* Tabs — always visible, below search */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col min-h-0">
        <TabsList variant="line" className="w-full justify-start px-4 shrink-0 border-b">
          <TabsTrigger value="chats" className="text-xs">Chats</TabsTrigger>
          <TabsTrigger value="friends" className="text-xs">Friends ({friends.length})</TabsTrigger>
          <TabsTrigger value="requests" className="text-xs">Requests ({pendingCount})</TabsTrigger>
        </TabsList>

        {/* Chats tab — conversation list */}
        <TabsContent value="chats" className="flex-1 overflow-y-auto mt-0">
          {/* Search results when on chats tab */}
          {searchQuery.trim() && (
            <div className="border-b">
              <div className="flex items-center justify-between px-4 py-2">
                <p className="text-xs font-medium text-muted-foreground">Search results</p>
                {isSearching ? <Loader2 className="size-3 animate-spin text-primary" /> : null}
              </div>
              <div className="max-h-48 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map((result) => (
                    <div key={result.profile.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground", getAvatarColor(result.profile.id))}>
                          {getInitials(result.profile.display_name ?? "?")}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{result.profile.display_name}</p>
                          <p className="text-xs text-muted-foreground">@{result.profile.username ?? "pending"}</p>
                        </div>
                      </div>
                      {result.relationship === "none" ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void handleSendFriendRequest(result.profile.id).catch((error) => {
                          toast.error(error instanceof Error ? error.message : "Failed to send request");
                        })}>
                          Add
                        </Button>
                      ) : result.relationship === "friends" ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void openConversationWithFriend(result.profile.id).catch(() => toast.error("Failed"))}>
                          <MessageCircle className="size-3 mr-1" />
                          Chat
                        </Button>
                      ) : (
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {relationshipLabel[result.relationship]}
                        </span>
                      )}
                    </div>
                  ))
                ) : !isSearching ? (
                  <p className="text-muted-foreground px-4 py-3 text-xs">No matching learners.</p>
                ) : null}
              </div>
            </div>
          )}
          {conversations.length ? (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => void openConversation(conversation.id).catch((error) => {
                  toast.error(error instanceof Error ? error.message : "Failed to load conversation");
                })}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50",
                  activeConversation?.id === conversation.id && "bg-primary/5"
                )}
              >
                <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground", getAvatarColor(conversation.friend.id))}>
                  {getInitials(conversation.friend.display_name ?? "?")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium">{conversation.friend.display_name}</span>
                    <div className="flex shrink-0 items-center gap-1.5 ml-2">
                      <span className="text-xs text-muted-foreground">{formatTimestamp(conversation.last_message_at)}</span>
                      {conversation.unread_count ? (
                        <div className="size-2 rounded-full bg-primary" />
                      ) : null}
                    </div>
                  </div>
                  <p className={cn(
                    "truncate text-xs mt-0.5",
                    conversation.unread_count ? "font-medium text-foreground" : "text-muted-foreground"
                  )}>
                    {conversation.last_message_preview || "No messages yet"}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No conversations yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Add friends to start chatting.</p>
            </div>
          )}
        </TabsContent>

        {/* Friends tab */}
        <TabsContent value="friends" className="flex-1 overflow-y-auto mt-0 px-4 py-3 space-y-2">
          {/* Search results for finding new friends */}
          {searchQuery.trim() && (
            <div className="space-y-1 pb-3 border-b mb-3">
              <div className="flex items-center justify-between pb-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Search Results</p>
                {isSearching ? <Loader2 className="size-3 animate-spin text-primary" /> : null}
              </div>
              {searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <div
                    key={result.profile.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground", getAvatarColor(result.profile.id))}>
                        {getInitials(result.profile.display_name ?? "?")}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{result.profile.display_name}</p>
                        <p className="text-xs text-muted-foreground">@{result.profile.username ?? "pending"}</p>
                      </div>
                    </div>
                    {result.relationship === "none" ? (
                      <Button size="sm" className="h-7 text-xs" onClick={() => void handleSendFriendRequest(result.profile.id).catch((error) => {
                        toast.error(error instanceof Error ? error.message : "Failed to send request");
                      })}>
                        <UserRoundPlus className="size-3 mr-1" />
                        Add
                      </Button>
                    ) : result.relationship === "incoming" && result.friendship_id ? (
                      <Button size="sm" className="h-7 text-xs" onClick={() => void handleFriendshipAction(result.friendship_id!, "accept").catch(() => toast.error("Failed"))}>
                        Accept
                      </Button>
                    ) : result.relationship === "outgoing" ? (
                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Pending</span>
                    ) : (
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Friends</span>
                    )}
                  </div>
                ))
              ) : !isSearching ? (
                <p className="text-xs text-muted-foreground py-2">No matching learners found.</p>
              ) : null}
            </div>
          )}

          {/* Existing friends list */}
          {!searchQuery.trim() && !friends.length && (
            <div className="py-6 text-center">
              <p className="text-sm font-medium">No friends yet</p>
              <p className="text-xs text-muted-foreground mt-1">Type a username or email above to find learners.</p>
            </div>
          )}
          {friends.map(({ friendship, profile }) => (
            <div key={friendship.id} className="flex items-center justify-between gap-2 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground", getAvatarColor(profile.id))}>
                  {getInitials(profile.display_name ?? "?")}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{profile.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{profile.username ?? "pending"}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void openConversationWithFriend(profile.id).catch(() => toast.error("Failed"))}>
                  <MessageCircle className="size-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => void handleFriendshipAction(friendship.id, "remove").catch(() => toast.error("Failed"))}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {!friends.length && (
            <p className="text-xs text-muted-foreground py-4 text-center">No friends yet. Search to find learners.</p>
          )}
        </TabsContent>

        {/* Requests tab */}
        <TabsContent value="requests" className="flex-1 overflow-y-auto mt-0 px-4 py-3 space-y-2">
          {incomingRequests.length > 0 && (
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pb-1">Incoming</p>
          )}
          {incomingRequests.map(({ friendship, profile }) => (
            <div key={friendship.id} className="flex items-center justify-between gap-2 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground", getAvatarColor(profile.id))}>
                  {getInitials(profile.display_name ?? "?")}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{profile.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{profile.username ?? "pending"}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" className="h-7 text-xs" onClick={() => void handleFriendshipAction(friendship.id, "accept").catch(() => toast.error("Failed"))}>Accept</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void handleFriendshipAction(friendship.id, "decline").catch(() => toast.error("Failed"))}>Decline</Button>
              </div>
            </div>
          ))}
          {outgoingRequests.length > 0 && (
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pb-1 pt-2">Outgoing</p>
          )}
          {outgoingRequests.map(({ friendship, profile }) => (
            <div key={friendship.id} className="flex items-center justify-between gap-2 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground", getAvatarColor(profile.id))}>
                  {getInitials(profile.display_name ?? "?")}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{profile.display_name}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void handleFriendshipAction(friendship.id, "cancel").catch(() => toast.error("Failed"))}>Cancel</Button>
            </div>
          ))}
          {!incomingRequests.length && !outgoingRequests.length && (
            <p className="text-xs text-muted-foreground py-4 text-center">No requests.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );

  const rightColumn = (
    <div className="flex h-full flex-col">
      {activeConversationFriend ? (
        <>
          {/* Chat header with avatar */}
          <div className="flex items-center gap-3 border-b px-6 py-4 shrink-0">
            <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground", getAvatarColor(activeConversationFriend.id))}>
              {getInitials(activeConversationFriend.display_name ?? "?")}
            </div>
            <div>
              <p className="text-sm font-semibold">{activeConversationFriend.display_name}</p>
              <p className="text-xs text-muted-foreground">
                @{activeConversationFriend.username ?? "pending"} · {formatTimestamp(activeConversation?.last_message_at)}
              </p>
            </div>
            {isMobile ? (
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => setActiveConversation(null)}>
                Back
              </Button>
            ) : null}
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {messages.length ? (
              messages.map((message) => {
                const isOwnMessage = message.sender_id === publicProfile.id;
                const hasText = message.body.trim().length > 0;
                const messageTranslation = messageTranslations[message.id];

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex flex-col",
                      isOwnMessage ? "items-end" : "items-start"
                    )}
                    >
                    <div className="flex max-w-[78%] flex-col gap-2">
                      {hasText ? (
                        <div
                          className={cn(
                            "px-4 py-2.5 text-sm",
                            isOwnMessage
                              ? "rounded-lg rounded-br-sm bg-primary text-primary-foreground"
                              : "rounded-lg rounded-bl-sm border bg-card text-foreground"
                          )}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{message.body}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={isOwnMessage ? "secondary" : "outline"}
                              className="h-7 text-[11px]"
                              onClick={() => void handleTranslateMessage(message)}
                              disabled={messageTranslation?.loading}
                            >
                              {messageTranslation?.loading ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Languages className="size-3" />
                              )}
                              Translate
                            </Button>
                          </div>
                          {messageTranslation?.text ? (
                            <div
                              className={cn(
                                "mt-3 rounded-md px-3 py-2 text-xs",
                                isOwnMessage
                                  ? "bg-white/15 text-primary-foreground/90"
                                  : "bg-muted text-foreground"
                              )}
                            >
                              <p className="font-medium">
                                Translation
                                {messageTranslation.sourceLanguage
                                  ? ` (${messageTranslation.sourceLanguage})`
                                  : ""}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap">
                                {messageTranslation.text}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {(message.attachments ?? []).map((attachment) => {
                        const AttachmentIcon = attachmentIcon(attachment.attachment_type);
                        const imageUrl = attachmentUrls[attachment.id]?.url;
                        const imageLoading = attachmentUrls[attachment.id]?.loading;
                        const attachmentTranslation = attachmentTranslations[attachment.id];
                        const isExpanded = expandedAttachmentIds[attachment.id];

                        return (
                          <div
                            key={attachment.id}
                            className={cn(
                              "rounded-2xl border px-3 py-3 shadow-sm",
                              isOwnMessage
                                ? "border-primary/20 bg-primary/5"
                                : "bg-card"
                            )}
                          >
                            {attachment.attachment_type === "image" ? (
                              <div className="overflow-hidden rounded-xl border bg-muted">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={attachment.file_name ?? "Shared image"}
                                    className="max-h-64 w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-40 items-center justify-center text-muted-foreground">
                                    {imageLoading ? (
                                      <Loader2 className="size-5 animate-spin" />
                                    ) : (
                                      <FileImage className="size-5" />
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : null}

                            <div className="mt-3 flex items-start gap-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <AttachmentIcon className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {attachment.file_name ?? attachmentLabel(attachment.attachment_type)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {attachmentLabel(attachment.attachment_type)}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px]"
                                onClick={() => void openAttachment(attachment)}
                              >
                                <Download className="size-3" />
                                Open
                              </Button>
                              {attachment.extracted_text ? (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px]"
                                    onClick={() => toggleAttachmentExpanded(attachment.id)}
                                  >
                                    {isExpanded ? "Hide text" : "Show text"}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px]"
                                    onClick={() => void handleTranslateAttachment(attachment)}
                                    disabled={attachmentTranslation?.loading}
                                  >
                                    {attachmentTranslation?.loading ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      <Languages className="size-3" />
                                    )}
                                    Translate text
                                  </Button>
                                </>
                              ) : null}
                            </div>

                            {isExpanded && attachment.extracted_text ? (
                              <div className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-foreground">
                                <p className="font-medium">Extracted text</p>
                                <p className="mt-1 whitespace-pre-wrap">
                                  {attachment.extracted_text.slice(0, MAX_TRANSLATION_CHARS)}
                                  {attachment.extracted_text.length > MAX_TRANSLATION_CHARS ? "..." : ""}
                                </p>
                              </div>
                            ) : null}

                            {attachmentTranslation?.text ? (
                              <div className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-foreground">
                                <p className="font-medium">
                                  Translation
                                  {attachmentTranslation.sourceLanguage
                                    ? ` (${attachmentTranslation.sourceLanguage})`
                                    : ""}
                                </p>
                                <p className="mt-1 whitespace-pre-wrap">
                                  {attachmentTranslation.text}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatTimestamp(message.created_at)}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Send a message to start the conversation.
                </p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t">
            <MessageComposer
              disabled={!activeConversation}
              isSending={isSendingMessage}
              onSend={async (payload) => {
                try {
                  await handleSendMessage(payload);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Failed to send message");
                }
              }}
            />
          </div>
        </>
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="max-w-xs text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageCircle className="size-5" />
            </div>
            <h2 className="mt-4 text-base font-semibold">Pick a conversation</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Select a chat from the left or add friends to start messaging.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={cn(
      "flex flex-col",
      isMobile ? "h-full" : "h-screen"
    )}>
      <div className={cn(
        "flex flex-1 min-h-0",
        isMobile ? "flex-col" : "flex-row"
      )}>
        {isMobile ? (activeConversation ? rightColumn : leftColumn) : (
          <>
            <div className="w-[340px] shrink-0 border-r bg-card overflow-y-auto">
              {leftColumn}
            </div>
            <div className="flex-1 min-w-0">
              {rightColumn}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
