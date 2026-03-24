type KaraokeErrorLike = {
  code?: string;
  message?: string;
  hint?: string | null;
  details?: string | null;
};

function isKaraokeErrorLike(value: unknown): value is KaraokeErrorLike {
  return Boolean(value) && typeof value === "object";
}

export function getKaraokeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (isKaraokeErrorLike(error)) {
    const parts = [error.message, error.hint, error.details].filter(
      (part): part is string => typeof part === "string" && part.trim().length > 0
    );

    if (parts.length > 0) {
      return parts.join(" ");
    }
  }

  return "Karaoke is temporarily unavailable.";
}

export function isMissingKaraokeSchemaError(error: unknown): boolean {
  if (!isKaraokeErrorLike(error)) {
    return false;
  }

  const code = error.code ?? "";
  const message = error.message ?? "";
  const hint = error.hint ?? "";
  const details = error.details ?? "";
  const combined = `${message} ${hint} ${details}`.toLowerCase();

  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "42703" ||
    combined.includes("karaoke_items") ||
    combined.includes("karaoke_item_tracks") ||
    combined.includes("karaoke_lyrics") ||
    combined.includes("karaoke_item_timelines") ||
    combined.includes("karaoke_lyrics_jobs")
  );
}

export function toKaraokeError(error: unknown): Error {
  const wrapped = new Error(getKaraokeErrorMessage(error)) as Error & KaraokeErrorLike;

  if (isKaraokeErrorLike(error)) {
    wrapped.code = error.code;
    wrapped.hint = error.hint ?? null;
    wrapped.details = error.details ?? null;
  }

  return wrapped;
}
