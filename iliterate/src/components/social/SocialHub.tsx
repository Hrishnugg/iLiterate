"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  AtSign,
  BellDot,
  Loader2,
  MessageCircle,
  Search,
  Sparkles,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { useIsMobile } from "@/hooks/use-mobile";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageComposer } from "@/components/social/MessageComposer";
import { SocialProfileGate } from "@/components/social/SocialProfileGate";
import type {
  DirectConversation,
  DirectMessage,
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

const relationshipLabel: Record<RelationshipState, string> = {
  none: "New",
  incoming: "Incoming",
  outgoing: "Pending",
  friends: "Friends",
};

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
  return items.flatMap((item) => {
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
  const [incomingRequests, setIncomingRequests] = useState<FriendshipWithProfile[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendshipWithProfile[]>([]);
  const [friends, setFriends] = useState<FriendshipWithProfile[]>([]);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationListItem | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [activeTab, setActiveTab] = useState("requests");
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const profileLookup = useMemo(() => {
    const entries = friends.map(({ profile }) => [profile.id, profile] as const);
    return Object.fromEntries(entries);
  }, [friends]);

  const unreadCount = useMemo(
    () => conversations.reduce((total, conversation) => total + (conversation.unread_count ?? 0), 0),
    [conversations]
  );

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

  const loadMessages = async (conversationId: string) => {
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
  };

  const refreshLists = async () => {
    await loadFriendships();
    if (publicProfile?.username) {
      await loadConversations();
    }
  };

  const bootSocialHub = useEffectEvent(async () => {
    try {
      setIsLoading(true);
      await loadPublicProfile();
      await loadFriendships();
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
        (payload) => {
          const nextMessage = payload.new as DirectMessage;
          setMessages((current) => (
            current.some((message) => message.id === nextMessage.id)
              ? current
              : [...current, nextMessage]
          ));
          void refreshConversationList().catch(() => null);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeConversation?.id, supabase]);

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

  const handleSendMessage = async (body: string) => {
    if (!activeConversation) {
      return;
    }

    setIsSendingMessage(true);
    try {
      const response = await fetch(`/api/social/conversations/${activeConversation.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
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
      <div className="space-y-8">
        <SocialProfileGate
          initialDisplayName={derivedDisplayName}
          initialUsername={publicProfile?.username}
          onSaved={(profile) => {
            setPublicProfile(profile);
            toast.success("Your social workspace is ready");
          }}
        />
      </div>
    );
  }

  const activeConversationFriend = activeConversation?.friend;

  const leftColumn = (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" />
          Social workspace
        </CardTitle>
        <CardDescription>
          Search learners, manage requests, and jump into active chats.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-5 py-5">
        <div className="space-y-3">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-9"
              placeholder="Search by username, name, or exact email"
            />
          </div>

          {searchQuery.trim() ? (
            <div className="rounded-2xl border bg-background/80">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <p className="text-sm font-medium">Search results</p>
                {isSearching ? <Loader2 className="size-4 animate-spin text-primary" /> : null}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map((result) => (
                    <div
                      key={result.profile.id}
                      className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{result.profile.display_name}</p>
                        <p className="text-muted-foreground flex items-center gap-1 text-xs">
                          <AtSign className="size-3" />
                          {result.profile.username ?? "pending"}
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]">
                            {result.matched_by}
                          </span>
                        </p>
                      </div>
                      {result.relationship === "none" ? (
                        <Button size="sm" onClick={() => void handleSendFriendRequest(result.profile.id).catch((error) => {
                          const message = error instanceof Error ? error.message : "Failed to send friend request";
                          toast.error(message);
                        })}>
                          <UserRoundPlus className="size-4" />
                          Add
                        </Button>
                      ) : result.relationship === "incoming" && result.friendship_id ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => void handleFriendshipAction(result.friendship_id!, "accept").catch((error) => {
                              const message = error instanceof Error ? error.message : "Failed to accept friend request";
                              toast.error(message);
                            })}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleFriendshipAction(result.friendship_id!, "decline").catch((error) => {
                              const message = error instanceof Error ? error.message : "Failed to decline friend request";
                              toast.error(message);
                            })}
                          >
                            Decline
                          </Button>
                        </div>
                      ) : result.relationship === "outgoing" && result.friendship_id ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleFriendshipAction(result.friendship_id!, "cancel").catch((error) => {
                            const message = error instanceof Error ? error.message : "Failed to cancel request";
                            toast.error(message);
                          })}
                        >
                          Cancel
                        </Button>
                      ) : (
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          {relationshipLabel[result.relationship]}
                        </span>
                      )}
                    </div>
                  ))
                ) : !isSearching ? (
                  <p className="text-muted-foreground px-4 py-6 text-sm">
                    No matching learners yet.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="requests">Requests ({pendingCount})</TabsTrigger>
            <TabsTrigger value="friends">Friends ({friends.length})</TabsTrigger>
            <TabsTrigger value="chats">Chats ({conversations.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-4">
            <div className="rounded-2xl border">
              <div className="border-b px-4 py-3 text-sm font-medium">Incoming requests</div>
              {incomingRequests.length ? (
                incomingRequests.map(({ friendship, profile }) => (
                  <div key={friendship.id} className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{profile.display_name}</p>
                      <p className="text-muted-foreground text-xs">@{profile.username ?? "pending"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void handleFriendshipAction(friendship.id, "accept").catch((error) => {
                        const message = error instanceof Error ? error.message : "Failed to accept friend request";
                        toast.error(message);
                      })}>
                        Accept
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void handleFriendshipAction(friendship.id, "decline").catch((error) => {
                        const message = error instanceof Error ? error.message : "Failed to decline friend request";
                        toast.error(message);
                      })}>
                        Decline
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground px-4 py-6 text-sm">No incoming requests right now.</p>
              )}
            </div>

            <div className="rounded-2xl border">
              <div className="border-b px-4 py-3 text-sm font-medium">Outgoing requests</div>
              {outgoingRequests.length ? (
                outgoingRequests.map(({ friendship, profile }) => (
                  <div key={friendship.id} className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{profile.display_name}</p>
                      <p className="text-muted-foreground text-xs">@{profile.username ?? "pending"}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void handleFriendshipAction(friendship.id, "cancel").catch((error) => {
                      const message = error instanceof Error ? error.message : "Failed to cancel request";
                      toast.error(message);
                    })}>
                      Cancel
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground px-4 py-6 text-sm">No outgoing requests yet.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="friends" className="space-y-3">
            {friends.length ? (
              friends.map(({ friendship, profile }) => (
                <div
                  key={friendship.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-4 transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{profile.display_name}</p>
                    <p className="text-muted-foreground text-xs">@{profile.username ?? "pending"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void openConversationWithFriend(profile.id).catch((error) => {
                        const message = error instanceof Error ? error.message : "Failed to open conversation";
                        toast.error(message);
                      })}
                    >
                      <MessageCircle className="size-4" />
                      Message
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleFriendshipAction(friendship.id, "remove").catch((error) => {
                          const message = error instanceof Error ? error.message : "Failed to remove friend";
                          toast.error(message);
                        });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed px-4 py-8 text-center">
                <p className="font-medium">No study partners yet</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Search by username or exact email to start building your circle.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="chats" className="space-y-3">
            {conversations.length ? (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => void openConversation(conversation.id).catch((error) => {
                    const message = error instanceof Error ? error.message : "Failed to load conversation";
                    toast.error(message);
                  })}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition-colors hover:bg-muted/30",
                    activeConversation?.id === conversation.id && "border-primary/40 bg-primary/5"
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{conversation.friend.display_name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {conversation.last_message_preview || "No messages yet"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground text-xs">
                      {formatTimestamp(conversation.last_message_at)}
                    </p>
                    {conversation.unread_count ? (
                      <span className="mt-2 inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                        {conversation.unread_count}
                      </span>
                    ) : null}
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed px-4 py-8 text-center">
                <p className="font-medium">No active chats yet</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Once a friend request is accepted, conversations show up here automatically.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );

  const rightColumn = (
    <Card className="overflow-hidden">
      {activeConversationFriend ? (
        <>
          <CardHeader className="border-b bg-muted/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">{activeConversationFriend.display_name}</CardTitle>
                <CardDescription className="mt-1 flex items-center gap-2">
                  <span>@{activeConversationFriend.username ?? "pending"}</span>
                  <span className="hidden sm:inline">•</span>
                  <span>{formatTimestamp(activeConversation?.last_message_at)}</span>
                </CardDescription>
              </div>
              {isMobile ? (
                <Button variant="outline" size="sm" onClick={() => setActiveConversation(null)}>
                  Back
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="flex min-h-[28rem] flex-col px-0 py-0">
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
              {messages.length ? (
                messages.map((message) => {
                  const isOwnMessage = message.sender_id === publicProfile.id;

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        isOwnMessage ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                          isOwnMessage
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{message.body}</p>
                        <p
                          className={cn(
                            "mt-2 text-[11px]",
                            isOwnMessage
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {formatTimestamp(message.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex h-full min-h-60 items-center justify-center rounded-2xl border border-dashed">
                  <div className="max-w-sm text-center">
                    <p className="font-medium">Start the first conversation</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Use the composer below to open the chat with a quick hello.
                    </p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <MessageComposer
              disabled={!activeConversation}
              isSending={isSendingMessage}
              onSend={async (body) => {
                try {
                  await handleSendMessage(body);
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Failed to send message";
                  toast.error(message);
                }
              }}
            />
          </CardContent>
        </>
      ) : (
        <CardContent className="flex min-h-[32rem] items-center justify-center px-8 py-12">
          <div className="max-w-md text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageCircle className="size-6" />
            </div>
            <h2 className="mt-5 text-xl font-semibold">Pick a conversation</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              Open a chat from your friends list or accept a request to start messaging another learner.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Social</h1>
        <p className="text-muted-foreground mt-1">
          Build a small circle of study partners and keep your language practice moving between sessions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-card to-primary/5">
          <CardContent className="flex items-center justify-between py-6">
            <div>
              <p className="text-muted-foreground text-sm">Study partners</p>
              <p className="mt-2 text-3xl font-semibold">{friends.length}</p>
            </div>
            <Users className="size-5 text-primary" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-card to-amber-500/5">
          <CardContent className="flex items-center justify-between py-6">
            <div>
              <p className="text-muted-foreground text-sm">Pending requests</p>
              <p className="mt-2 text-3xl font-semibold">{pendingCount}</p>
            </div>
            <BellDot className="size-5 text-amber-600" />
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-card to-sky-500/5">
          <CardContent className="flex items-center justify-between py-6">
            <div>
              <p className="text-muted-foreground text-sm">Unread messages</p>
              <p className="mt-2 text-3xl font-semibold">{unreadCount}</p>
            </div>
            <MessageCircle className="size-5 text-sky-600" />
          </CardContent>
        </Card>
      </div>

      <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "lg:grid-cols-[360px_minmax(0,1fr)]")}>
        {isMobile ? (activeConversation ? rightColumn : leftColumn) : leftColumn}
        {!isMobile ? rightColumn : null}
      </div>
    </div>
  );
}
