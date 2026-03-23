import {
  createClient as createAdminSupabaseClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

import type {
  ConversationSummary,
  DirectConversation,
  DirectMessage,
  DirectMessageAttachment,
  FriendRequestSummary,
  FriendSummary,
  Friendship,
  PublicProfile,
  SocialRelationshipState,
} from "@/types/database";

type JsonRecord = Record<string, unknown>;

const LIST_USERS_PAGE_SIZE = 200;
const MAX_LIST_USERS_PAGES = 10;

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asJsonRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null
    ? (value as JsonRecord)
    : null;
}

export function normalizeSocialPair(userId: string, otherUserId: string) {
  return userId < otherUserId
    ? ([userId, otherUserId] as const)
    : ([otherUserId, userId] as const);
}

export function defaultDisplayName(user: User) {
  const metadata = asJsonRecord(user.user_metadata);
  const fullName = asString(metadata?.full_name)?.trim();

  if (fullName) {
    return fullName.slice(0, 50);
  }

  const emailPrefix = user.email?.split("@")[0]?.trim();
  if (emailPrefix) {
    return emailPrefix.slice(0, 50);
  }

  return "Learner";
}

export function defaultAvatarSeed(userId: string) {
  return userId.replace(/-/g, "").slice(0, 8) || "learner";
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables");
  }

  return createAdminSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function findUserByExactEmail(email: string) {
  const admin = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();

  for (let page = 1; page <= MAX_LIST_USERS_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PAGE_SIZE,
    });

    if (error) {
      throw error;
    }

    const matchedUser =
      data.users.find(
        (candidate) => candidate.email?.toLowerCase() === normalizedEmail
      ) ?? null;

    if (matchedUser) {
      return matchedUser;
    }

    if (data.users.length < LIST_USERS_PAGE_SIZE) {
      break;
    }
  }

  return null;
}

export function mapPublicProfile(row: JsonRecord): PublicProfile {
  return {
    id: String(row.id),
    username: asString(row.username),
    display_name: asString(row.display_name) ?? "Learner",
    avatar_seed: asString(row.avatar_seed),
    created_at: asString(row.created_at) ?? new Date(0).toISOString(),
    updated_at: asString(row.updated_at) ?? new Date(0).toISOString(),
  };
}

export function mapFriendship(row: JsonRecord): Friendship {
  return {
    id: String(row.id),
    requester_id: String(row.requester_id),
    recipient_id: String(row.recipient_id),
    user_one_id: String(row.user_one_id),
    user_two_id: String(row.user_two_id),
    status: row.status as Friendship["status"],
    responded_at: asString(row.responded_at),
    created_at: asString(row.created_at) ?? new Date(0).toISOString(),
    updated_at: asString(row.updated_at) ?? new Date(0).toISOString(),
  };
}

export function mapDirectConversation(row: JsonRecord): DirectConversation {
  return {
    id: String(row.id),
    user_one_id: String(row.user_one_id),
    user_two_id: String(row.user_two_id),
    last_message_at: asString(row.last_message_at),
    last_message_preview: asString(row.last_message_preview),
    created_at: asString(row.created_at) ?? new Date(0).toISOString(),
    updated_at: asString(row.updated_at) ?? new Date(0).toISOString(),
  };
}

export function mapDirectMessage(row: JsonRecord): DirectMessage {
  return {
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    sender_id: String(row.sender_id),
    body: asString(row.body) ?? "",
    message_kind:
      (asString(row.message_kind) as DirectMessage["message_kind"]) ?? "text",
    primary_attachment_type:
      (asString(row.primary_attachment_type) as DirectMessage["primary_attachment_type"]) ??
      null,
    attachment_count: asNumber(row.attachment_count) ?? 0,
    created_at: asString(row.created_at) ?? new Date(0).toISOString(),
  };
}

export function mapDirectMessageAttachment(
  row: JsonRecord
): DirectMessageAttachment {
  return {
    id: String(row.id),
    message_id: String(row.message_id),
    upload_id: String(row.upload_id),
    attachment_type:
      (asString(row.attachment_type) as DirectMessageAttachment["attachment_type"]) ??
      "image",
    file_name: asString(row.file_name),
    mime_type: asString(row.mime_type),
    extracted_text: asString(row.extracted_text),
    detected_language: asString(row.detected_language),
    storage_path: asString(row.storage_path),
    created_at: asString(row.created_at) ?? new Date(0).toISOString(),
  };
}

function groupAttachmentsByMessage(
  rows: JsonRecord[]
): Map<string, DirectMessageAttachment[]> {
  const byMessage = new Map<string, DirectMessageAttachment[]>();

  for (const row of rows) {
    const attachment = mapDirectMessageAttachment(row);
    const existing = byMessage.get(attachment.message_id) ?? [];
    existing.push(attachment);
    byMessage.set(attachment.message_id, existing);
  }

  return byMessage;
}

export async function listConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
  limit = 50
) {
  const { data: messageRows, error: messagesError } = await supabase
    .from("direct_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (messagesError) {
    throw messagesError;
  }

  const reversedRows = [...(messageRows ?? [])].reverse();
  if (reversedRows.length === 0) {
    return [] as DirectMessage[];
  }

  const messageIds = reversedRows.map((row) => String(row.id));
  const { data: attachmentRows, error: attachmentsError } = await supabase
    .from("direct_message_attachments")
    .select("*")
    .in("message_id", messageIds)
    .order("created_at", { ascending: true });

  if (attachmentsError) {
    throw attachmentsError;
  }

  const attachmentLookup = groupAttachmentsByMessage(
    (attachmentRows ?? []) as JsonRecord[]
  );

  return reversedRows.map((row) => ({
    ...mapDirectMessage(row as JsonRecord),
    attachments: attachmentLookup.get(String(row.id)) ?? [],
  }));
}

function resolveStorageLocation(storagePath: string) {
  const normalized = storagePath.trim().replace(/^\/+/, "");

  if (normalized.includes("::")) {
    const [bucket, ...rest] = normalized.split("::");
    return {
      bucket,
      path: rest.join("::"),
    };
  }

  return {
    bucket: "user-uploads",
    path: normalized,
  };
}

export async function getSignedUploadUrl(storagePath: string, expiresIn = 300) {
  const admin = createAdminClient();
  const { bucket, path } = resolveStorageLocation(storagePath);
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw error ?? new Error("Failed to create signed attachment URL");
  }

  return data.signedUrl;
}

export async function getOrCreatePublicProfile(
  supabase: SupabaseClient,
  user: User
) {
  const { data: existingProfile, error: selectError } = await supabase
    .from("public_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existingProfile) {
    return mapPublicProfile(existingProfile as JsonRecord);
  }

  const payload = {
    id: user.id,
    display_name: defaultDisplayName(user),
    avatar_seed: defaultAvatarSeed(user.id),
  };

  const { data: insertedProfile, error: insertError } = await supabase
    .from("public_profiles")
    .insert(payload)
    .select("*")
    .single();

  if (insertError) {
    throw insertError;
  }

  return mapPublicProfile(insertedProfile as JsonRecord);
}

export async function getPublicProfilesByIds(
  supabase: SupabaseClient,
  ids: string[]
) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return new Map<string, PublicProfile>();
  }

  const { data, error } = await supabase
    .from("public_profiles")
    .select("*")
    .in("id", uniqueIds);

  if (error) {
    throw error;
  }

  return new Map(
    (data ?? []).map((row) => {
      const profile = mapPublicProfile(row as JsonRecord);
      return [profile.id, profile] as const;
    })
  );
}

export function getFriendIdFromFriendship(
  friendship: Friendship,
  currentUserId: string
) {
  return friendship.requester_id === currentUserId
    ? friendship.recipient_id
    : friendship.requester_id;
}

export function mapFriendRequestSummary(
  friendship: Friendship,
  profile: PublicProfile,
  currentUserId: string
): FriendRequestSummary {
  return {
    friendship,
    profile,
    direction:
      friendship.requester_id === currentUserId ? "outgoing" : "incoming",
  };
}

export function mapFriendSummary(
  friendship: Friendship,
  profile: PublicProfile,
  unreadCount: number
): FriendSummary {
  return {
    friendship,
    profile,
    conversation_id: null,
    unread_count: unreadCount,
  };
}

export function mapConversationSummary(
  conversation: DirectConversation,
  profile: PublicProfile,
  unreadCount: number,
  lastReadAt: string | null
): ConversationSummary {
  return {
    conversation,
    profile,
    unread_count: unreadCount,
    last_read_at: lastReadAt,
  };
}

export function relationshipFromFriendship(
  friendship: Friendship | undefined,
  currentUserId: string
): SocialRelationshipState {
  if (!friendship || friendship.status === "declined") {
    return "none";
  }

  if (friendship.status === "accepted") {
    return "friends";
  }

  return friendship.requester_id === currentUserId ? "outgoing" : "incoming";
}

export async function getUnreadCountForConversation(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
  lastReadAt: string | null
) {
  let query = supabase
    .from("direct_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId);

  if (lastReadAt) {
    query = query.gt("created_at", lastReadAt);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}
