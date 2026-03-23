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

    expect(onSend).toHaveBeenCalledWith({ body: "hello there", files: [] });
    expect(textarea).toHaveValue("");
  });

  it("sends on enter and preserves new line on shift enter", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);

    render(<MessageComposer onSend={onSend} />);

    const textarea = screen.getByPlaceholderText(/write a message/i);
    await user.type(textarea, "hello{enter}");
    expect(onSend).toHaveBeenCalledWith({ body: "hello", files: [] });

    await user.type(textarea, "line one{shift>}{enter}{/shift}line two");
    expect(textarea).toHaveValue("line one\nline two");
  });

  it("allows attachment-only sends", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);

    render(<MessageComposer onSend={onSend} />);

    const fileInput = screen.getByLabelText(/attach/i, { selector: "input" });
    const imageFile = new File(["image"], "photo.png", { type: "image/png" });

    await user.upload(fileInput, imageFile);
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(onSend).toHaveBeenCalledWith({
      body: "",
      files: [imageFile],
    });
  });

  it("accepts pdf attachments even when the browser reports an empty mime type", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);

    render(<MessageComposer onSend={onSend} />);

    const fileInput = screen.getByLabelText(/attach/i, { selector: "input" });
    const pdfFile = new File(["pdf"], "lesson.PDF", { type: "" });

    await user.upload(fileInput, pdfFile);
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(onSend).toHaveBeenCalledWith({
      body: "",
      files: [pdfFile],
    });
  });

  it("preserves the draft when send fails", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockRejectedValue(new Error("upload failed"));

    render(<MessageComposer onSend={onSend} />);

    const textarea = screen.getByPlaceholderText(/write a message/i);
    const fileInput = screen.getByLabelText(/attach/i, { selector: "input" });
    const pdfFile = new File(["pdf"], "lesson.pdf", { type: "application/pdf" });

    await user.type(textarea, "please review");
    await user.upload(fileInput, pdfFile);
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(textarea).toHaveValue("please review");
    expect(screen.getByText("lesson.pdf")).toBeInTheDocument();
  });
});
