import { act, fireEvent, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReadingProgress } from "../useReadingProgress";

function createScrollContainer(initialScrollTop = 0) {
  const container = document.createElement("div");
  Object.defineProperty(container, "scrollTop", {
    value: initialScrollTop,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(container, "scrollHeight", {
    value: 2000,
    configurable: true,
  });
  Object.defineProperty(container, "clientHeight", {
    value: 1000,
    configurable: true,
  });

  const scrollTo = vi.fn(({ top }: { top: number }) => {
    container.scrollTop = top;
  });

  Object.defineProperty(container, "scrollTo", {
    value: scrollTo,
    writable: true,
    configurable: true,
  });

  document.body.appendChild(container);
  return { container, scrollTo };
}

describe("useReadingProgress", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("calculates progress from scroll position and reports reading estimates", async () => {
    const onProgressUpdate = vi.fn();
    const { container } = createScrollContainer(500);
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const ref = { current: container };
    const { result } = renderHook(() =>
      useReadingProgress({
        contentId: "content-1",
        wordCount: 1000,
        scrollContainerRef: ref,
        onProgressUpdate,
      })
    );

    await waitFor(() => {
      expect(result.current.progress).toBe(50);
    });

    expect(result.current.wordsRead).toBe(500);
    expect(result.current.getTimeRemaining(200)).toBe("3 min");
    expect(onProgressUpdate).toHaveBeenCalledWith(50);
  });

  it("restores last saved position with context offset", async () => {
    const { container, scrollTo } = createScrollContainer(0);
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ last_position: 400 }),
    } as Response);

    const ref = { current: container };
    renderHook(() =>
      useReadingProgress({
        contentId: "content-2",
        wordCount: 800,
        scrollContainerRef: ref,
      })
    );

    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith({
        top: 300,
        behavior: "smooth",
      });
    });
  });

  it("saves current progress on interval with expected payload", async () => {
    vi.useFakeTimers();
    const { container } = createScrollContainer(0);
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const ref = { current: container };
    const { result } = renderHook(() =>
      useReadingProgress({
        contentId: "content-3",
        wordCount: 1000,
        scrollContainerRef: ref,
        saveInterval: 1000,
      })
    );

    act(() => {
      container.scrollTop = 500;
      fireEvent.scroll(container);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    act(() => {
      container.scrollTop = 500;
      fireEvent.scroll(container);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
      await result.current.saveProgress();
    });

    const postCalls = fetchMock.mock.calls.filter(
      ([url, init]) =>
        url === "/api/reading-progress" &&
        (init as RequestInit | undefined)?.method === "POST"
    );
    expect(postCalls.length).toBeGreaterThan(0);

    const latestPost = postCalls[postCalls.length - 1];
    const postBody = JSON.parse((latestPost[1] as RequestInit).body as string);
    expect(postBody).toMatchObject({
      contentId: "content-3",
      progress: 50,
      position: 500,
      wordsRead: 500,
    });
  });

  it("forces save on beforeunload even before interval elapses", async () => {
    vi.useFakeTimers();
    const { container } = createScrollContainer(250);
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const ref = { current: container };
    renderHook(() =>
      useReadingProgress({
        contentId: "content-4",
        wordCount: 1000,
        scrollContainerRef: ref,
        saveInterval: 60_000,
      })
    );

    act(() => {
      window.dispatchEvent(new Event("beforeunload"));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reading-progress",
      expect.objectContaining({ method: "POST" })
    );
  });
});
