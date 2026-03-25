#!/usr/bin/env node
/**
 * Poll pending karaoke lyric jobs and hydrate karaoke items with normalized lyrics.
 * This worker is intentionally conservative:
 * - if no licensed lyrics service is configured, jobs fall back to needs_lyrics
 * - if a provider is Spotify, the item can still become ready without timeline sync
 */
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const LYRICS_SERVICE_URL = process.env.KARAOKE_LYRICS_SERVICE_URL || "";
const LYRICS_SERVICE_API_KEY = process.env.KARAOKE_LYRICS_SERVICE_API_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitLyricsTextToLines(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      id: `line-${index + 1}`,
      text: line,
    }));
}

function getReadyStatus(provider, hasTimeline) {
  if (provider === "spotify") {
    return "ready";
  }

  return hasTimeline ? "ready" : "needs_timing";
}

function getTimingStatus(provider, hasTimeline) {
  if (provider === "spotify") {
    return "not_applicable";
  }

  return hasTimeline ? "ready" : "draft";
}

async function fetchNextJob() {
  const { data, error } = await supabase
    .from("karaoke_lyrics_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.warn("Failed to fetch karaoke lyric jobs:", error.message);
    return null;
  }

  return data && data.length > 0 ? data[0] : null;
}

async function updateJob(jobId, changes) {
  const { error } = await supabase
    .from("karaoke_lyrics_jobs")
    .update(changes)
    .eq("id", jobId);

  if (error) {
    console.warn("Failed to update karaoke lyric job:", error.message);
  }
}

async function loadBundle(job) {
  const [{ data: item }, { data: track }, { data: timeline }] = await Promise.all([
    supabase
      .from("karaoke_items")
      .select("*")
      .eq("id", job.karaoke_item_id)
      .eq("user_id", job.user_id)
      .maybeSingle(),
    supabase
      .from("karaoke_item_tracks")
      .select("*")
      .eq("karaoke_item_id", job.karaoke_item_id)
      .eq("user_id", job.user_id)
      .eq("provider", job.provider)
      .maybeSingle(),
    supabase
      .from("karaoke_item_timelines")
      .select("id")
      .eq("karaoke_item_id", job.karaoke_item_id)
      .eq("user_id", job.user_id)
      .eq("provider", job.provider)
      .maybeSingle(),
  ]);

  return {
    item,
    track,
    hasTimeline: Boolean(timeline),
  };
}

async function requestLyrics(bundle, job) {
  if (!LYRICS_SERVICE_URL) {
    throw new Error(
      "KARAOKE_LYRICS_SERVICE_URL is not configured. Use manual lyrics entry for now."
    );
  }

  const response = await fetch(LYRICS_SERVICE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(LYRICS_SERVICE_API_KEY
        ? { Authorization: `Bearer ${LYRICS_SERVICE_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      karaokeItemId: job.karaoke_item_id,
      provider: job.provider,
      providerTrackId:
        bundle.track?.provider_track_id || job.metadata?.providerTrackId || null,
      url: bundle.track?.url || job.metadata?.url || null,
      title: bundle.track?.title || bundle.item?.title || job.metadata?.title || null,
      artist:
        bundle.track?.artist || bundle.item?.artist || job.metadata?.artist || null,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Lyrics service returned ${response.status}: ${body}`);
  }

  return response.json();
}

async function processJob(job) {
  const nextAttempts = (job.attempts || 0) + 1;

  await updateJob(job.id, {
    status: "processing",
    attempts: nextAttempts,
    last_error: null,
    updated_at: new Date().toISOString(),
  });
  await supabase
    .from("karaoke_items")
    .update({
      status: "fetching_lyrics",
      lyrics_status: "matching",
    })
    .eq("id", job.karaoke_item_id)
    .eq("user_id", job.user_id);

  try {
    const bundle = await loadBundle(job);

    if (!bundle.item) {
      throw new Error("Karaoke item not found");
    }

    const payload = await requestLyrics(bundle, job);
    const text = typeof payload?.text === "string" ? payload.text : "";
    const lines = Array.isArray(payload?.lines) && payload.lines.length > 0
      ? payload.lines
          .map((line, index) =>
            line && typeof line.text === "string"
              ? { id: line.id || `line-${index + 1}`, text: line.text.trim() }
              : null
          )
          .filter(Boolean)
      : splitLyricsTextToLines(text);

    if (!text.trim() || lines.length === 0) {
      throw new Error("No lyrics were returned for this track");
    }

    const confidence =
      typeof payload?.confidence === "number" ? payload.confidence : null;
    const nextLyricsStatus =
      confidence !== null && confidence < 0.65 ? "needs_review" : "ready";
    const nextTimingStatus = getTimingStatus(job.provider, bundle.hasTimeline);
    const nextStatus =
      nextLyricsStatus === "needs_review"
        ? "needs_timing"
        : getReadyStatus(job.provider, bundle.hasTimeline);

    const [{ error: lyricsError }, { error: itemError }, { error: jobError }] =
      await Promise.all([
        supabase.from("karaoke_lyrics").upsert(
          {
            user_id: job.user_id,
            karaoke_item_id: job.karaoke_item_id,
            source:
              typeof payload?.source === "string" && payload.source.trim()
                ? payload.source.trim()
                : "licensed_service",
            text,
            lines,
            metadata: {
              provider: job.provider,
              importedAt: new Date().toISOString(),
              confidence,
            },
          },
          { onConflict: "karaoke_item_id" }
        ),
        supabase
          .from("karaoke_items")
          .update({
            status: nextStatus,
            lyrics_status: nextLyricsStatus,
            timing_status: nextTimingStatus,
            last_match_confidence: confidence,
            last_match_source:
              typeof payload?.source === "string" && payload.source.trim()
                ? payload.source.trim()
                : "licensed_service",
            last_match_metadata: {
              matchedAt: new Date().toISOString(),
              confidence,
            },
          })
          .eq("id", job.karaoke_item_id)
          .eq("user_id", job.user_id),
        supabase
          .from("karaoke_lyrics_jobs")
          .update({
            status: "completed",
            last_error: null,
            processed_at: new Date().toISOString(),
            metadata: {
              ...(job.metadata || {}),
              outcome: "lyrics_imported",
            },
          })
          .eq("id", job.id),
      ]);

    if (lyricsError) throw lyricsError;
    if (itemError) throw itemError;
    if (jobError) throw jobError;

    console.log(`Imported lyrics for karaoke item ${job.karaoke_item_id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Karaoke lyric job ${job.id} failed:`, message);

    const exhausted = nextAttempts >= 3;
    const nextJobStatus = exhausted ? "failed" : "pending";

    await Promise.all([
      updateJob(job.id, {
        status: nextJobStatus,
        attempts: nextAttempts,
        last_error: message,
        updated_at: new Date().toISOString(),
      }),
      supabase
        .from("karaoke_items")
        .update({
          status: exhausted ? "needs_lyrics" : "fetching_lyrics",
          lyrics_status: exhausted ? "manual_fallback" : "matching",
        })
        .eq("id", job.karaoke_item_id)
        .eq("user_id", job.user_id),
    ]);
  }
}

async function mainLoop() {
  console.log("Karaoke lyrics worker starting...");

  while (true) {
    try {
      const job = await fetchNextJob();
      if (!job) {
        await sleep(3000);
        continue;
      }

      await processJob(job);
    } catch (error) {
      console.error("Karaoke worker loop error:", error);
      await sleep(5000);
    }
  }
}

mainLoop();
