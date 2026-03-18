"use client";

import { Inbox, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FriendRequestSummary } from "@/types/database";

interface FriendRequestsListProps {
  incoming: FriendRequestSummary[];
  outgoing: FriendRequestSummary[];
  onAccept: (friendshipId: string) => void;
  onDecline: (friendshipId: string) => void;
  onCancel: (friendshipId: string) => void;
}

function RequestIdentity({ request }: { request: FriendRequestSummary }) {
  return (
    <div>
      <div className="font-medium">{request.profile.display_name}</div>
      <div className="text-xs text-muted-foreground">
        {request.profile.username
          ? `@${request.profile.username}`
          : "Username pending"}
      </div>
    </div>
  );
}

export function FriendRequestsList({
  incoming,
  outgoing,
  onAccept,
  onDecline,
  onCancel,
}: FriendRequestsListProps) {
  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="rounded-2xl border bg-muted/30 p-3">
            <Inbox className="size-5" />
          </div>
          <div className="font-medium">No pending friend requests</div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Incoming requests and invitations you have already sent will appear
            here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {incoming.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm font-medium">Incoming requests</div>
          {incoming.map((request) => (
            <div
              key={request.friendship.id}
              className="flex items-center justify-between gap-3 rounded-xl border bg-background px-4 py-4"
            >
              <RequestIdentity request={request} />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => onAccept(request.friendship.id)}
                  aria-label={`Accept ${request.profile.display_name}`}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDecline(request.friendship.id)}
                  aria-label={`Decline ${request.profile.display_name}`}
                >
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {outgoing.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Send className="size-4" />
            Sent by you
          </div>
          {outgoing.map((request) => (
            <div
              key={request.friendship.id}
              className="flex items-center justify-between gap-3 rounded-xl border bg-background px-4 py-4"
            >
              <RequestIdentity request={request} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCancel(request.friendship.id)}
                aria-label={`Cancel ${request.profile.display_name}`}
              >
                Cancel
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
