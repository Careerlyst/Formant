// Authenticated bridge to the isolated Showcase renderer. Source PDFs never
// leave the private server path except as a request body to the renderer.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_PAGES = 12;
const MAX_PREVIEW_BYTES = 3 * 1024 * 1024;
const STALE_JOB_AFTER_MS = 10 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function message(error: unknown) {
  const value = error as { message?: string } | null;
  return String(value?.message || "Preview generation failed.").slice(0, 900);
}

function decodeWebp(value: unknown): Uint8Array {
  if (typeof value !== "string" || value.length > Math.ceil(MAX_PREVIEW_BYTES * 4 / 3) + 8) {
    throw new Error("Renderer returned an invalid or oversized preview.");
  }
  const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  if (bytes.byteLength < 16 || bytes.byteLength > MAX_PREVIEW_BYTES
    || String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF"
    || String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP") {
    throw new Error("Renderer output was not a supported WebP preview.");
  }
  return bytes;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const rendererUrl = Deno.env.get("SHOWCASE_RENDERER_URL") || "";
  const rendererToken = Deno.env.get("SHOWCASE_RENDERER_TOKEN") || "";
  if (!supabaseUrl || !serviceKey || !anonKey || !rendererUrl || !rendererToken) {
    return json({ error: "Preview generation is not configured. Ask an administrator to configure the private renderer." }, 503);
  }

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "A signed-in Showcase editor is required." }, 401);

  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await service.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "The signed-in session is invalid or expired." }, 401);
  const { data: roleRow, error: roleError } = await service.from("user_roles")
    .select("role").eq("user_id", authData.user.id).maybeSingle();
  if (roleError) return json({ error: "Staff authorization could not be verified." }, 500);
  if (!["admin", "expert", "support"].includes(String(roleRow?.role || "").toLowerCase())) {
    return json({ error: "Showcase editor access is required." }, 403);
  }

  let payload: { kind?: string; projectId?: string; sourceMediaId?: string };
  try {
    payload = await request.json() as typeof payload;
  } catch {
    return json({ error: "A valid JSON request is required." }, 400);
  }
  const { kind, projectId, sourceMediaId } = payload || {};
  if (!UUID.test(String(projectId || "")) || !["pdf", "website"].includes(String(kind))) {
    return json({ error: "Choose a valid Showcase project and preview source." }, 400);
  }
  if (kind === "pdf" && !UUID.test(String(sourceMediaId || ""))) {
    return json({ error: "Choose an existing private PDF media record." }, 400);
  }
  if (kind === "website" && sourceMediaId) return json({ error: "Website previews do not accept a media source." }, 400);

  const { data: project, error: projectError } = await service.from("showcase_projects")
    .select("id,title,service_category,portfolio_url")
    .eq("id", projectId).maybeSingle();
  if (projectError || !project) return json({ error: "Showcase project was not found." }, 404);
  if (kind === "website" && (project.service_category !== "portfolio_website_demo" || !project.portfolio_url)) {
    return json({ error: "Save a portfolio website URL before generating a website preview." }, 400);
  }

  let source: { storage_path: string; content_type: string; byte_size: number } | null = null;
  if (kind === "pdf") {
    const { data, error } = await service.from("showcase_project_images")
      .select("id,project_id,storage_path,content_type,byte_size,presentation")
      .eq("id", sourceMediaId).maybeSingle();
    if (error || !data || data.project_id !== project.id || data.content_type !== "application/pdf"
      || !["document", "document_before", "document_after"].includes(data.presentation)) {
      return json({ error: "The selected PDF is not a supported private document for this project." }, 400);
    }
    source = data;
  }

  // The renderer request has a 110 second timeout. Recover any older job that
  // was left processing by a terminated Edge Function invocation so staff can
  // retry it without keeping a permanent project/source lock.
  const staleBefore = new Date(Date.now() - STALE_JOB_AFTER_MS).toISOString();
  let staleQuery = service.from("showcase_preview_jobs").update({
    status: "failed",
    error_message: "Preview generation stopped before completion. Retry the request.",
    finished_at: new Date().toISOString(),
  }).eq("project_id", project.id).eq("source_kind", kind).eq("status", "processing").lt("started_at", staleBefore);
  staleQuery = kind === "pdf"
    ? staleQuery.eq("source_media_id", sourceMediaId)
    : staleQuery.is("source_media_id", null);
  const { error: staleJobError } = await staleQuery;
  if (staleJobError) return json({ error: "An earlier preview job could not be checked. Retry later or ask an administrator to inspect the job state." }, 500);

  const { data: job, error: jobError } = await service.from("showcase_preview_jobs").insert({
    project_id: project.id,
    source_kind: kind,
    source_media_id: sourceMediaId || null,
    status: "processing",
    created_by: authData.user.id,
    started_at: new Date().toISOString(),
  }).select("id").single();
  if (jobError?.code === "23505") {
    return json({ error: "A matching preview is already processing. Wait for it to finish before starting another." }, 409);
  }
  if (jobError || !job) return json({ error: `Preview job could not be recorded: ${message(jobError)}` }, 500);

  const uploadedPaths: string[] = [];
  const insertedMediaIds: string[] = [];
  try {
    const renderer = new URL(rendererUrl);
    if (renderer.protocol !== "https:" || renderer.username || renderer.password) {
      throw new Error("The private renderer URL must use HTTPS and contain no embedded credentials.");
    }

    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 110_000);
    let response: Response;
    try {
      if (kind === "pdf" && source) {
        const { data: blob, error: storageError } = await service.storage.from("showcase-media").download(source.storage_path);
        if (storageError || !blob || blob.size > 15 * 1024 * 1024) throw new Error("Private source PDF could not be loaded or exceeds the supported size.");
        response = await fetch(new URL("/render/pdf", renderer), {
          method: "POST", signal: abort.signal,
          headers: { Authorization: `Bearer ${rendererToken}`, "Content-Type": "application/pdf" },
          body: await blob.arrayBuffer(),
        });
      } else {
        response = await fetch(new URL("/render/website", renderer), {
          method: "POST", signal: abort.signal,
          headers: { Authorization: `Bearer ${rendererToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: project.portfolio_url }),
        });
      }
    } finally {
      clearTimeout(timeout);
    }
    let result: { previews?: unknown[]; overview?: { title?: unknown; description?: unknown }; error?: unknown };
    try {
      result = await response.json();
    } catch {
      throw new Error(`Private renderer returned an unreadable response (HTTP ${response.status}).`);
    }
    if (!response.ok) {
      const rendererMessage = String(result?.error || "").replace(/\s+/g, " ").slice(0, 500);
      throw new Error(`Private renderer returned HTTP ${response.status}.${rendererMessage ? ` ${rendererMessage}` : ""}`);
    }
    const previews = Array.isArray(result?.previews) ? result.previews : [];
    if (previews.length < 1 || previews.length > MAX_PAGES) throw new Error("Renderer returned an invalid preview count.");

    const { data: existingMedia, error: existingMediaError } = await service.from("showcase_project_images")
      .select("sort_order").eq("project_id", project.id);
    if (existingMediaError) throw new Error("Existing Showcase media order could not be read.");
    const firstSortOrder = (existingMedia || []).reduce((max, item) => Math.max(max, Number(item.sort_order) || 0), -1) + 1;
    const mediaRows = [];
    for (let index = 0; index < previews.length; index += 1) {
      const preview = previews[index];
      const bytes = decodeWebp(preview?.dataBase64);
      const pageNumber = Number(preview?.pageNumber || index + 1);
      if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > MAX_PAGES) throw new Error("Renderer returned an invalid page number.");
      const path = `${project.id}/${job.id}-preview-${pageNumber}.webp`;
      uploadedPaths.push(path);
      const { error: uploadError } = await service.storage.from("showcase-media").upload(path, bytes, {
        contentType: "image/webp", upsert: false, cacheControl: "3600",
      });
      if (uploadError) throw new Error(`Private preview page ${pageNumber} could not be stored: ${message(uploadError)}`);
      mediaRows.push({
        id: crypto.randomUUID(),
        project_id: project.id,
        storage_path: path,
        // Generated PDF pages are WebP image derivatives, not PDF media rows.
        // `document` is reserved by the schema for application/pdf files.
        presentation: kind === "pdf" ? "gallery" : "desktop",
        sort_order: firstSortOrder + pageNumber - 1,
        content_type: "image/webp",
        byte_size: bytes.byteLength,
        alt_text: kind === "pdf" ? `${project.title}, page ${pageNumber} preview` : `${project.title}, website screenshot preview`,
        caption: "Generated preview · pending human review",
        created_by: authData.user.id,
        is_public_preview: false,
      });
    }

    insertedMediaIds.push(...mediaRows.map((row) => row.id));
    const { data: inserted, error: mediaError } = await service.from("showcase_project_images")
      .insert(mediaRows).select("id,sort_order");
    if (mediaError || !inserted || inserted.length !== mediaRows.length) throw new Error(`Preview media metadata could not be saved: ${message(mediaError)}`);
    const outputs = mediaRows.map((row, index) => ({ job_id: job.id, media_id: row.id, page_number: Number(previews[index]?.pageNumber || index + 1) }));
    const { error: outputError } = await service.from("showcase_preview_job_outputs").insert(outputs);
    if (outputError) throw new Error(`Preview output links could not be saved: ${message(outputError)}`);

    const overviewTitle = String(result?.overview?.title || "").slice(0, 200) || null;
    const overviewDescription = String(result?.overview?.description || "").slice(0, 1000) || null;
    const { error: finishError } = await service.from("showcase_preview_jobs").update({
      status: "succeeded", overview_title: overviewTitle, overview_description: overviewDescription,
      finished_at: new Date().toISOString(),
    }).eq("id", job.id);
    if (finishError) throw new Error(`Preview job status could not be saved: ${message(finishError)}`);
    return json({ jobId: job.id, status: "succeeded", previewCount: inserted.length, overview: { title: overviewTitle, description: overviewDescription } });
  } catch (error) {
    const cleanupErrors: string[] = [];
    if (insertedMediaIds.length) {
      const { error: deleteRowsError } = await service.from("showcase_project_images").delete().in("id", insertedMediaIds);
      if (deleteRowsError) cleanupErrors.push(`Generated media-row cleanup failed: ${message(deleteRowsError)}`);
    }
    if (uploadedPaths.length && !cleanupErrors.some((item) => item.startsWith("Generated media-row cleanup failed"))) {
      const { error: cleanupError } = await service.storage.from("showcase-media").remove(uploadedPaths);
      if (cleanupError) cleanupErrors.push(`Private object cleanup failed: ${message(cleanupError)}`);
    }
    const errorMessage = [message(error), ...cleanupErrors].join(" ").slice(0, 1000);
    const { error: jobStatusError } = await service.from("showcase_preview_jobs")
      .update({ status: "failed", error_message: errorMessage, finished_at: new Date().toISOString() })
      .eq("id", job.id);
    const responseError = jobStatusError
      ? `${errorMessage} Preview job failure status could not be saved; ask an administrator to inspect it. ${message(jobStatusError)}`.slice(0, 1500)
      : errorMessage;
    return json({ jobId: job.id, status: "failed", error: responseError }, 502);
  }
});
