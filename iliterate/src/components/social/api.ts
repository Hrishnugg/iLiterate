"use client";

/**
 * @module
 * Client-side social API adapter for profile, friendship, conversation, and messaging endpoints.
 */

import type {
  ChatAttachment,
  ChatMessage,
  ConversationPayload,
  ConversationSummary,
  FriendshipRecord,
  RelationshipState,
  SocialPerson,
  SocialProfile,
  SocialSummary,
} from "@/components/social/types";

type JsonRecord = Record<string, unknown>;

/** Error wrapper carrying HTTP status for API requests. */
class ApiError extends Error {
  status: number;

  /**
   * @param message Human-readable error message.
   * @param status HTTP status code returned by the API.
   */
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Fetches JSON from an endpoint and normalizes non-2xx responses into ApiError.
 *
 * @param input Request URL or Request object.
 * @param init Fetch options.
 * @returns Parsed JSON payload.
 * @throws ApiError when response status is non-2xx.
 */
async function fetchJson<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let message = "Request failed";

    try {
      const payload = (await response.json()) as { error?: string };
      message = payload.error || message;
    } catch {
      // Keep generic message.
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

/** Type guard for plain object records. */
function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

/** Safely casts unknown values to string when possible. */
function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Normalizes raw person payloads into SocialPerson. */
function normalizePerson(raw: unknown): SocialPerson {
  if (!isRecord(raw)) {
    return {
      id: "",
      username: null,
      display_name: null,
    };
  }

  return {
    id: asString(raw.id) || "",
    username: asString(raw.username),
    display_name:
      asString(raw.display_name) ||
      asString(raw.displayName) ||
      asString(raw.full_name),
    avatar_seed: asString(raw.avatar_seed),
    relationship: (asString(raw.relationship) as RelationshipState | null) || undefined,
    matched_by:
      (asString(raw.matched_by) as "email" | "username" | "display_name" | null) ||
      undefined,
    subtitle: asString(raw.subtitle),
  };
}

/** Normalizes friendship payloads into a consistent client shape. */
function normalizeFriendship(
  raw: unknown,
  viewerId: string
): FriendshipRecord {
  if (!isRecord(raw)) {
    return {
      id: "",
      status: "pending",
      person: normalizePerson(null),
    };
  }

  const requester = normalizePerson(raw.requester);
  const recipient = normalizePerson(raw.recipient);
  const friend = normalizePerson(raw.friend);

  const person =
    friend.id
      ? friend
      : requester.id && requester.id !== viewerId
        ? requester
        : recipient.id && recipient.id !== viewerId
          ? recipient
          : normalizePerson(raw.person);

  return {
    id: asString(raw.id) || "",
    status:
      (asString(raw.status) as "pending" | "accepted" | "declined" | null) ||
      "pending",
    requester_id: asString(raw.requester_id) || undefined,
    recipient_id: asString(raw.recipient_id) || undefined,
    created_at: asString(raw.created_at) || undefined,
    updated_at: asString(raw.updated_at) || undefined,
    responded_at: asString(raw.responded_at) ?? undefined,
    person,
  };
}

/** Normalizes conversation summary payloads from API responses. */
function normalizeConversation(raw: unknown): ConversationSummary {
  if (!isRecord(raw)) {
    return {
      id: "",
      friend_id: "",
      friend: normalizePerson(null),
      unread_count: 0,
    };
  }

  const friend =
    normalizePerson(raw.friend).id || normalizePerson(raw.person).id
      ? normalizePerson(raw.friend).id
        ? normalizePerson(raw.friend)
        : normalizePerson(raw.person)
      : normalizePerson({
          id: asString(raw.friend_id),
          username: asString(raw.friend_username),
          display_name: asString(raw.friend_display_name),
        });

  return {
    id: asString(raw.id) || "",
    friend_id: asString(raw.friend_id) || friend.id,
    friend,
    last_message_preview:
      asString(raw.last_message_preview) || asString(raw.lastMessagePreview),
    last_message_at:
      asString(raw.last_message_at) || asString(raw.lastMessageAt),
    unread_count:
      typeof raw.unread_count === "number" ? raw.unread_count : 0,
  };
}

/** Normalizes chat message payloads including attachments and sender info. */
function normalizeMessage(raw: unknown): ChatMessage {
  if (!isRecord(raw)) {
    return {
      id: "",
      conversation_id: "",
      sender_id: "",
      body: "",
      message_kind: "text",
      created_at: "",
    };
  }

  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments.flatMap<ChatAttachment>((attachment) => {
        if (!isRecord(attachment)) {
          return [];
        }

        return [
          {
            id: asString(attachment.id) || "",
            message_id:
              asString(attachment.message_id) ||
              asString(attachment.messageId) ||
              "",
            upload_id:
              asString(attachment.upload_id) ||
              asString(attachment.uploadId) ||
              "",
            attachment_type:
              (asString(attachment.attachment_type) ||
                asString(attachment.attachmentType) ||
                "image") as ChatAttachment["attachment_type"],
            file_name:
              asString(attachment.file_name) ||
              asString(attachment.fileName),
            mime_type:
              asString(attachment.mime_type) ||
              asString(attachment.mimeType),
            extracted_text:
              asString(attachment.extracted_text) ||
              asString(attachment.extractedText),
            detected_language:
              asString(attachment.detected_language) ||
              asString(attachment.detectedLanguage),
            storage_path:
              asString(attachment.storage_path) ||
              asString(attachment.storagePath),
            created_at:
              asString(attachment.created_at) ||
              asString(attachment.createdAt) ||
              "",
          },
        ];
      })
    : [];

  return {
    id: asString(raw.id) || "",
    conversation_id:
      asString(raw.conversation_id) || asString(raw.conversationId) || "",
    sender_id: asString(raw.sender_id) || asString(raw.senderId) || "",
    body: asString(raw.body) || "",
    message_kind:
      (asString(raw.message_kind) || asString(raw.messageKind) || "text") as ChatMessage["message_kind"],
    primary_attachment_type:
      (asString(raw.primary_attachment_type) ||
        asString(raw.primaryAttachmentType)) as ChatMessage["primary_attachment_type"],
    attachment_count:
      typeof raw.attachment_count === "number"
        ? raw.attachment_count
        : typeof raw.attachmentCount === "number"
          ? raw.attachmentCount
          : attachments.length,
    attachments,
    created_at: asString(raw.created_at) || asString(raw.createdAt) || "",
    sender: raw.sender ? normalizePerson(raw.sender) : null,
  };
}

/**
 * Retrieves the signed-in user's public social profile.
 *
 * @returns Social profile, or null when profile is not found.
 */
export async function getSocialProfile(): Promise<SocialProfile | null> {
  try {
    const payload = await fetchJson<SocialProfile | { profile?: SocialProfile }>(
      "/api/social/public-profile"
    );

    if (isRecord(payload) && "profile" in payload && payload.profile) {
      return payload.profile as SocialProfile;
    }

    return payload as SocialProfile;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

/**
 * Updates public social profile fields.
 *
 * @param input Profile fields to update.
 * @returns Updated social profile.
 */
export async function updateSocialProfile(input: {
  username: string;
  displayName: string;
}): Promise<SocialProfile> {
  const payload = await fetchJson<SocialProfile | { profile: SocialProfile }>(
    "/api/social/public-profile",
    {
      method: "PUT",
      body: JSON.stringify(input),
    }
  );

  return isRecord(payload) && "profile" in payload
    ? (payload.profile as SocialProfile)
    : (payload as SocialProfile);
}

/**
 * Fetches social dashboard summary payloads and normalizes relationships.
 *
 * @param viewerId Current authenticated user ID used to resolve relationship perspective.
 * @returns Incoming requests, outgoing requests, friends, and conversations.
 */
export async function getSocialSummary(
  viewerId: string
): Promise<SocialSummary> {
  const [friendshipsPayload, conversationsPayload] = await Promise.all([
    fetchJson<
      | {
          incomingRequests?: unknown[];
          outgoingRequests?: unknown[];
          friends?: unknown[];
        }
      | unknown[]
    >("/api/social/friendships"),
    fetchJson<{ conversations?: unknown[] } | unknown[]>(
      "/api/social/conversations"
    ),
  ]);

  const friendshipObject = isRecord(friendshipsPayload)
    ? friendshipsPayload
    : {};
  const conversationArray = Array.isArray(conversationsPayload)
    ? conversationsPayload
    : Array.isArray(conversationsPayload.conversations)
      ? conversationsPayload.conversations
      : [];

  return {
    incomingRequests: Array.isArray(friendshipObject.incomingRequests)
      ? friendshipObject.incomingRequests.map((item) =>
          normalizeFriendship(item, viewerId)
        )
      : [],
    outgoingRequests: Array.isArray(friendshipObject.outgoingRequests)
      ? friendshipObject.outgoingRequests.map((item) =>
          normalizeFriendship(item, viewerId)
        )
      : [],
    friends: Array.isArray(friendshipObject.friends)
      ? friendshipObject.friends.map((item) =>
          normalizeFriendship(item, viewerId)
        )
      : [],
    conversations: conversationArray.map((item) => normalizeConversation(item)),
  };
}

/**
 * Searches discoverable users by free-text query.
 *
 * @param query Search text.
 * @returns Matching people records.
 */
export async function searchPeople(query: string): Promise<SocialPerson[]> {
  if (!query.trim()) {
    return [];
  }

  const payload = await fetchJson<{ results?: unknown[] } | unknown[]>(
    `/api/social/search?q=${encodeURIComponent(query.trim())}`
  );

  const results = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.results)
      ? payload.results
      : [];

  return results.map((item) => normalizePerson(item));
}

/**
 * Sends a friendship request to another user.
 *
 * @param recipientId Target user ID.
 * @returns Created friendship record.
 */
export async function sendFriendRequest(
  recipientId: string
): Promise<FriendshipRecord> {
  const payload = await fetchJson<FriendshipRecord | { friendship: FriendshipRecord }>(
    "/api/social/friendships",
    {
      method: "POST",
      body: JSON.stringify({ recipientId }),
    }
  );

  return isRecord(payload) && "friendship" in payload
    ? (payload.friendship as FriendshipRecord)
    : (payload as FriendshipRecord);
}

/**
 * Updates an existing friendship request state.
 *
 * @param friendshipId Friendship record ID.
 * @param action State transition action.
 */
export async function updateFriendship(
  friendshipId: string,
  action: "accept" | "decline" | "cancel"
): Promise<void> {
  await fetchJson(`/api/social/friendships/${friendshipId}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}

/**
 * Removes an existing friendship.
 *
 * @param friendshipId Friendship record ID.
 */
export async function unfriend(friendshipId: string): Promise<void> {
  await fetchJson(`/api/social/friendships/${friendshipId}`, {
    method: "DELETE",
  });
}

/**
 * Loads or creates a conversation thread with a friend.
 *
 * @param friendId Target friend user ID.
 * @returns Conversation summary and normalized messages.
 */
export async function getConversation(
  friendId: string
): Promise<ConversationPayload> {
  const payload = await fetchJson<{
    conversation?: unknown;
    messages?: unknown[];
  }>("/api/social/conversations", {
    method: "POST",
    body: JSON.stringify({ friendId }),
  });

  return {
    conversation: normalizeConversation(payload.conversation),
    messages: Array.isArray(payload.messages)
      ? payload.messages.map((item) => normalizeMessage(item))
      : [],
  };
}

/**
 * Sends a chat message, optionally with upload attachments.
 *
 * @param conversationId Conversation record ID.
 * @param body Message text.
 * @param attachments Optional attachment metadata to persist with message.
 * @returns Normalized message record.
 */
export async function sendMessage(
  conversationId: string,
  body: string,
  attachments: Array<{
    uploadId: string;
    attachmentType: ChatAttachment["attachment_type"];
    fileName?: string | null;
    mimeType?: string | null;
    extractedText?: string | null;
    detectedLanguage?: string | null;
  }> = []
): Promise<ChatMessage> {
  const payload = await fetchJson<ChatMessage | { message: ChatMessage }>(
    `/api/social/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ body, attachments }),
    }
  );

  return isRecord(payload) && "message" in payload
    ? normalizeMessage(payload.message)
    : normalizeMessage(payload);
}

export async function markConversationRead(
  conversationId: string
): Promise<void> {
  await fetchJson(`/api/social/conversations/${conversationId}/read`, {
    method: "POST",
  });
}
