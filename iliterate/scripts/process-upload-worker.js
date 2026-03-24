#!/usr/bin/env node
/**
 * Simple worker that polls Supabase for pending upload_jobs and calls the
 * Python sidecar to process them. Uses the service role key so it can read
 * and update the jobs table.
 */
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const PYTHON_BASE = process.env.PYTHON_API_BASE_URL || "http://localhost:8000";
const PYTHON_SECRET = process.env.PYTHON_API_SHARED_SECRET || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false },
});

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchNextJob() {
  // Use PostgREST-style filtering via RPC or select with limit
  const { data: jobs, error } = await supabase
    .from("upload_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.warn("Failed to fetch jobs:", error);
    return null;
  }
  return jobs && jobs.length > 0 ? jobs[0] : null;
}

async function markJob(jobId, changes) {
  const { error } = await supabase.from("upload_jobs").update(changes).eq("id", jobId);
  if (error) console.warn("Failed to update job:", error);
}

async function processJob(job) {
  const jobId = job.id;
  try {
    await markJob(jobId, { status: "processing", attempts: (job.attempts || 0) + 1, updated_at: new Date().toISOString() });

    // Call Python sidecar to process
    const resp = await fetch(`${PYTHON_BASE}/process-upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: PYTHON_SECRET ? `Bearer ${PYTHON_SECRET}` : "",
      },
      body: JSON.stringify({
        storage_path: job.storage_path,
        public_url: job.public_url,
        upload_id: job.upload_id,
        user_id: job.user_id,
        language: job.language,
        job_id: jobId,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`Processor returned ${resp.status}: ${body}`);
    }

    // Mark done
    await markJob(jobId, { status: "done", processed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    console.log(`Processed job ${jobId}`);
  } catch (e) {
    console.error(`Job ${jobId} failed:`, e?.message || e);
    const attempts = (job.attempts || 0) + 1;
    const status = attempts >= 5 ? "failed" : "pending";
    await markJob(jobId, { status, last_error: String(e?.message || e), attempts, updated_at: new Date().toISOString() });
  }
}

async function mainLoop() {
  console.log("Upload worker starting — polling for jobs...");
  while (true) {
    try {
      const job = await fetchNextJob();
      if (job) {
        await processJob(job);
      } else {
        await sleep(3000);
      }
    } catch (e) {
      console.error("Worker loop error:", e);
      await sleep(5000);
    }
  }
}

mainLoop();
