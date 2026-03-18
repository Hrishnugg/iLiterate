import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FriendRequestsList } from "../FriendRequestsList";
import type { FriendRequestSummary, Friendship, PublicProfile } from "@/types/database";

function makeProfile(id: string, name: string): PublicProfile {
  return {
    id,
    username: name.toLowerCase().replace(/\s+/g, "_"),
    display_name: name,
    avatar_seed: name.slice(0, 2).toLowerCase(),
    created_at: "2026-03-18T12:00:00.000Z",
    updated_at: "2026-03-18T12:00:00.000Z",
  };
}

function makeFriendship(
  id: string,
  requesterId: string,
  recipientId: string
): Friendship {
  const [userOne, userTwo] = [requesterId, recipientId].sort();

  return {
    id,
    requester_id: requesterId,
    recipient_id: recipientId,
    user_one_id: userOne,
    user_two_id: userTwo,
    status: "pending",
    responded_at: null,
    created_at: "2026-03-18T12:00:00.000Z",
    updated_at: "2026-03-18T12:00:00.000Z",
  };
}

function makeRequest(
  id: string,
  direction: "incoming" | "outgoing",
  profile: PublicProfile
): FriendRequestSummary {
  return {
    friendship:
      direction === "incoming"
        ? makeFriendship(id, profile.id, "current-user")
        : makeFriendship(id, "current-user", profile.id),
    profile,
    direction,
  };
}

describe("FriendRequestsList", () => {
  it("shows the empty state when there are no pending requests", () => {
    render(
      <FriendRequestsList
        incoming={[]}
        outgoing={[]}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/no pending friend requests/i)).toBeInTheDocument();
  });

  it("wires accept, decline, and cancel actions to the correct request ids", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    const onCancel = vi.fn();

    render(
      <FriendRequestsList
        incoming={[makeRequest("incoming-1", "incoming", makeProfile("user-2", "Ana"))]}
        outgoing={[makeRequest("outgoing-1", "outgoing", makeProfile("user-3", "Marco"))]}
        onAccept={onAccept}
        onDecline={onDecline}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole("button", { name: /accept ana/i }));
    await user.click(screen.getByRole("button", { name: /decline ana/i }));
    await user.click(screen.getByRole("button", { name: /cancel marco/i }));

    expect(onAccept).toHaveBeenCalledWith("incoming-1");
    expect(onDecline).toHaveBeenCalledWith("incoming-1");
    expect(onCancel).toHaveBeenCalledWith("outgoing-1");
  });
});
