"use client";

import type {
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

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

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
    requester_id: asString(raw.requester_id),
    recipient_id: asString(raw.recipient_id),
    created_at: asString(raw.created_at) || undefined,
    updated_at: asString(raw.updated_at) || undefined,
    responded_at: asString(raw.responded_at),
    person,
  };
}

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

function normalizeMessage(raw: unknown): ChatMessage {
  if (!isRecord(raw)) {
    return {
      id: "",
      conversation_id: "",
      sender_id: "",
      body: "",
      created_at: "",
    };
  }

  return {
    id: asString(raw.id) || "",
    conversation_id:
      asString(raw.conversation_id) || asString(raw.conversationId) || "",
    sender_id: asString(raw.sender_id) || asString(raw.senderId) || "",
    body: asString(raw.body) || "",
    created_at: asString(raw.created_at) || asString(raw.createdAt) || "",
    sender: raw.sender ? normalizePerson(raw.sender) : null,
  };
}

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

export async function updateFriendship(
  friendshipId: string,
  action: "accept" | "decline" | "cancel"
): Promise<void> {
  await fetchJson(`/api/social/friendships/${friendshipId}`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}

export async function unfriend(friendshipId: string): Promise<void> {
  await fetchJson(`/api/social/friendships/${friendshipId}`, {
    method: "DELETE",
  });
}

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

export async function sendMessage(
  conversationId: string,
  body: string
): Promise<ChatMessage> {
  const payload = await fetchJson<ChatMessage | { message: ChatMessage }>(
    `/api/social/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
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
