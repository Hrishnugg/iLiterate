import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { SocialProfileGate } from "@/components/social/SocialProfileGate";

const updateUser = vi.fn().mockResolvedValue({ data: {}, error: null });

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      updateUser,
    },
  }),
}));

describe("SocialProfileGate", () => {
  beforeEach(() => {
    updateUser.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows a validation error for invalid usernames", async () => {
    const user = userEvent.setup();
    render(
      <SocialProfileGate
        initialDisplayName="Reader"
        onSaved={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/username/i), "bad-name");
    await user.click(screen.getByRole("button", { name: /save social profile/i }));

    expect(screen.getByText(/username must be 3-24 characters/i)).toBeInTheDocument();
  });

  it("submits profile changes and calls onSaved", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          public_profile: {
            id: "user-1",
            username: "study_pal",
            display_name: "Study Pal",
            avatar_seed: "user-1",
            created_at: "2026-03-18T00:00:00.000Z",
            updated_at: "2026-03-18T00:00:00.000Z",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    render(
      <SocialProfileGate
        initialDisplayName="Reader"
        onSaved={onSaved}
      />
    );

    await user.clear(screen.getByLabelText(/display name/i));
    await user.type(screen.getByLabelText(/display name/i), "Study Pal");
    await user.type(screen.getByLabelText(/username/i), "study_pal");
    await user.click(screen.getByRole("button", { name: /save social profile/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/social/public-profile",
        expect.objectContaining({
          method: "PUT",
        })
      );
    });

    expect(updateUser).toHaveBeenCalledWith({
      data: { full_name: "Study Pal" },
    });
    expect(onSaved).toHaveBeenCalled();
  });
});
