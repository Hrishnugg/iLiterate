"use client";

export type RelationshipState =
  | "none"
  | "incoming"
  | "outgoing"
  | "friends";

export interface SocialProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_seed?: string | null;
}

export interface SocialPerson extends SocialProfile {
  relationship?: RelationshipState;
  matched_by?: "email" | "username" | "display_name" | null;
  subtitle?: string | null;
}

export interface FriendshipRecord {
  id: string;
  status: "pending" | "accepted" | "declined";
  requester_id?: string;
  recipient_id?: string;
  created_at?: string;
  updated_at?: string;
  responded_at?: string | null;
  person?: SocialPerson;
}

export interface ConversationSummary {
  id: string;
  friend_id: string;
  friend: SocialPerson;
  last_message_preview?: string | null;
  last_message_at?: string | null;
  unread_count?: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: SocialPerson | null;
}

export interface SocialSummary {
  incomingRequests: FriendshipRecord[];
  outgoingRequests: FriendshipRecord[];
  friends: FriendshipRecord[];
  conversations: ConversationSummary[];
}

export interface ConversationPayload {
  conversation: ConversationSummary;
  messages: ChatMessage[];
}
