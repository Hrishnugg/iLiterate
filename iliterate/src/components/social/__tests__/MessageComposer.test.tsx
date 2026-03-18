import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MessageComposer } from "@/components/social/MessageComposer";

describe("MessageComposer", () => {
  it("does not submit empty or whitespace-only messages", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<MessageComposer onSend={onSend} />);

    await user.type(screen.getByPlaceholderText(/write a message/i), "   ");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(onSend).not.toHaveBeenCalled();
  });

  it("submits the trimmed message and clears the field", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);

    render(<MessageComposer onSend={onSend} />);

    const textarea = screen.getByPlaceholderText(/write a message/i);
    await user.type(textarea, "  hello there  ");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(onSend).toHaveBeenCalledWith("hello there");
    expect(textarea).toHaveValue("");
  });

  it("sends on enter and preserves new line on shift enter", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);

    render(<MessageComposer onSend={onSend} />);

    const textarea = screen.getByPlaceholderText(/write a message/i);
    await user.type(textarea, "hello{enter}");
    expect(onSend).toHaveBeenCalledWith("hello");

    await user.type(textarea, "line one{shift>}{enter}{/shift}line two");
    expect(textarea).toHaveValue("line one\nline two");
  });
});
