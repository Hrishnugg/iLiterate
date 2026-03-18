import {
  createClient as createAdminSupabaseClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

import type {
  ConversationSummary,
  DirectConversation,
  DirectMessage,
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
    created_at: asString(row.created_at) ?? new Date(0).toISOString(),
  };
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
