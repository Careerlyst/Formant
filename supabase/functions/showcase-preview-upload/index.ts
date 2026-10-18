// Staff-only upload for separately prepared Showcase preview images.
// The caller's JWT is used for both Storage and database operations so the
// existing Showcase RLS policies remain in force.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_DERIVATIVE_BYTES = 3 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_PRESENTATIONS = new Set(["before", "after", "gallery", "thumbnail", "desktop", "mobile"]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info, x-showcase-project-id, x-showcase-alt-text, x-showcase-caption, x-showcase-replace-media-id, x-showcase-presentation, x-showcase-upload-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function boundedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const deadline = AbortSignal.timeout(25_000);
  const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
  return fetch(input, { ...init, signal });
}

function requestText(request: Request, name: string, maximum: number, required = false): string | null {
  const raw = request.headers.get(name);
  if (raw === null && !required) return "";
  if (raw === null) return null;
  try {
    const value = decodeURIComponent(raw).trim();
    if (value.length > maximum || (required && !value)) return null;
    return value;
  } catch {
    return null;
  }
}

async function readImageBody(request: Request): Promise<Uint8Array> {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_IMAGE_BYTES) throw new Error("The preview image exceeds the 8 MB limit.");
  if (!request.body) throw new Error("Choose a JPG, PNG, or WebP image.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new Error("The preview image exceeds the 8 MB limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) throw new Error("Choose a JPG, PNG, or WebP image.");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function readRendererImage(response: Response): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("Content-Length") || 0);
  if (contentLength > MAX_DERIVATIVE_BYTES || !response.body) throw new Error("The renderer response is missing or exceeds the output limit.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_DERIVATIVE_BYTES) {
        await reader.cancel();
        throw new Error("The renderer response exceeds the output limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)) return "image/png";
  if (bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

async function removeNewUpload(client: ReturnType<typeof createClient>, path: string, mediaId?: string, sourcePath?: string) {
  const failures: string[] = [];
  let rowId = mediaId || "";
  if (!rowId) {
    const { data, error } = await client.from("showcase_project_images").select("id").eq("storage_path", path).maybeSingle();
    if (error) failures.push("The new media record could not be checked during cleanup.");
    else rowId = data?.id || "";
  }
  if (rowId && !failures.length) {
    const { error } = await client.from("showcase_project_images").delete().eq("id", rowId);
    if (error) failures.push("The new media record could not be removed.");
  }
  // Keep both private objects if their media row could not be deleted; never
  // leave a row pointing at bytes removed during rollback.
  if (!failures.length) {
    const { error } = await client.storage.from("showcase-media").remove([path, ...(sourcePath ? [sourcePath] : [])]);
    if (error) failures.push("The private source or preview object could not be removed.");
  }
  return failures;
}

async function removePrivateSource(client: ReturnType<typeof createClient>, path: string): Promise<string[]> {
  const { error } = await client.storage.from("showcase-media").remove([path]);
  return error ? ["The private source image could not be removed during upload cleanup."] : [];
}

Deno.serve(async (request: Request) => {
  const startedAt = Date.now();
  const logStage = (stage: string, outcome: string, status?: number) => {
    console.info(JSON.stringify({ function: "showcase-preview-upload", stage, outcome, ...(status ? { status } : {}), duration_ms: Date.now() - startedAt }));
  };
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const rendererUrl = Deno.env.get("SHOWCASE_RENDERER_URL") || "";
  const rendererToken = Deno.env.get("SHOWCASE_RENDERER_TOKEN") || "";
  if (!supabaseUrl || !anonKey || !rendererUrl || !rendererToken) {
    return json({ error: "Preview image processing is not configured. Ask an administrator to configure the private renderer." }, 503);
  }

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in with an authorized Showcase editor account." }, 401);

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: boundedFetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "The signed-in session is invalid or expired." }, 401);

  const { data: roleRow, error: roleError } = await client.from("user_roles")
    .select("role").eq("user_id", authData.user.id).maybeSingle();
  if (roleError) return json({ error: "Showcase editor authorization could not be verified." }, 500);
  if (!["admin", "expert", "support"].includes(String(roleRow?.role || "").toLowerCase())) {
    return json({ error: "Showcase editor access is required to upload a preview image." }, 403);
  }

  const projectId = request.headers.get("x-showcase-project-id") || "";
  const uploadId = request.headers.get("x-showcase-upload-id") || "";
  const altText = requestText(request, "x-showcase-alt-text", 240, true);
  const caption = requestText(request, "x-showcase-caption", 240);
  const presentation = requestText(request, "x-showcase-presentation", 40, true);
  const replaceMediaId = request.headers.get("x-showcase-replace-media-id") || "";
  const contentType = String(request.headers.get("Content-Type") || "").toLowerCase().split(";")[0].trim();
  if (!UUID.test(projectId) || !UUID.test(uploadId) || altText === null || caption === null || presentation === null
    || !IMAGE_PRESENTATIONS.has(presentation)
    || (replaceMediaId && !UUID.test(replaceMediaId)) || !IMAGE_TYPES.has(contentType)) {
    return json({ error: "Choose a valid project, image presentation, descriptive alt text, and JPG, PNG, or WebP image." }, 400);
  }

  const { data: project, error: projectError } = await client.from("showcase_projects")
    .select("id,is_published,public_content_review_confirmed,client_consent_confirmed")
    .eq("id", projectId).maybeSingle();
  if (projectError) return json({ error: "Showcase project access could not be verified." }, 403);
  if (!project) return json({ error: "Showcase project was not found." }, 404);

  let replacement: { id: string; sort_order: number } | null = null;
  if (replaceMediaId) {
    const { data, error } = await client.from("showcase_project_images")
      .select("id,sort_order,project_id,presentation,content_type")
      .eq("id", replaceMediaId).maybeSingle();
    if (error) return json({ error: "The existing preview could not be verified." }, 403);
    if (!data || data.project_id !== project.id || data.presentation !== "thumbnail" || !IMAGE_TYPES.has(data.content_type)) {
      return json({ error: "Only a preview image belonging to this project can be replaced." }, 400);
    }
    replacement = { id: data.id, sort_order: data.sort_order };
  }

  // A client retains this UUID when retrying an upload whose response timed
  // out. Stable object paths plus the unique storage_path constraint ensure a
  // completed request returns its original row instead of creating a duplicate.
  const path = `${project.id}/${uploadId}.webp`;
  const sourcePath = `${project.id}/sources/${uploadId}.source`;
  const { data: priorMedia, error: priorMediaError } = await client.from("showcase_project_images")
    .select("id,project_id,presentation,content_type,byte_size,alt_text,caption,is_public_preview,sort_order,created_at,created_by")
    .eq("storage_path", path).maybeSingle();
  if (priorMediaError) return json({ error: "The prior upload result could not be checked safely. Do not retry with a new upload ID; ask an administrator to inspect project media." }, 500);
  if (priorMedia) {
    if (priorMedia.project_id !== project.id || priorMedia.created_by !== authData.user.id) {
      return json({ error: "This upload request ID is already in use. Choose the image again to start a new upload." }, 409);
    }
    if (replacement && replacement.id !== priorMedia.id) {
      const { error: replaceError } = await client.from("showcase_project_images")
        .update({ presentation: "gallery", is_public_preview: false })
        .eq("id", replacement.id).eq("project_id", project.id);
      if (replaceError) return json({ error: "The preview is saved privately, but the previous preview could not be safely retired." }, 502);
    }
    logStage("idempotency", "existing_upload_returned");
    return json({
      media: {
        id: priorMedia.id, project_id: priorMedia.project_id, presentation: priorMedia.presentation,
        content_type: priorMedia.content_type, byte_size: priorMedia.byte_size, alt_text: priorMedia.alt_text,
        caption: priorMedia.caption, is_public_preview: priorMedia.is_public_preview,
        sort_order: priorMedia.sort_order, created_at: priorMedia.created_at,
      },
      status: "uploaded_unapproved",
      publicationReviewInvalidated: Boolean(project.is_published || project.public_content_review_confirmed || project.client_consent_confirmed),
    }, 200);
  }

  let bytes: Uint8Array;
  try {
    bytes = await readImageBody(request);
  } catch (error) {
    const message = String((error as Error)?.message || "The image could not be read.");
    return json({ error: message }, 413);
  }
  const detectedType = detectImageType(bytes);
  if (!detectedType || detectedType !== contentType) {
    return json({ error: "The image bytes do not match the declared JPG, PNG, or WebP type." }, 415);
  }

  let renderer: URL;
  try {
    renderer = new URL(rendererUrl);
    if (renderer.protocol !== "https:" || renderer.username || renderer.password || renderer.search || renderer.hash) {
      return json({ error: "The private renderer URL must use HTTPS and contain no embedded credentials or query data." }, 503);
    }
  } catch {
    return json({ error: "The private image renderer URL is invalid." }, 503);
  }

  const renderAbort = new AbortController();
  const renderTimeout = setTimeout(() => renderAbort.abort(), 30_000);
  let derivative: Uint8Array;
  try {
    const rendered = await fetch(new URL("/watermark/image", renderer), {
      method: "POST",
      signal: renderAbort.signal,
      headers: { Authorization: `Bearer ${rendererToken}`, "Content-Type": detectedType },
      body: bytes,
    });
    if (!rendered.ok) {
      let detail = "";
      try {
        const body = await rendered.json() as { error?: unknown };
        detail = typeof body.error === "string" ? body.error.replace(/\s+/g, " ").slice(0, 300) : "";
      } catch { /* Keep non-JSON infrastructure responses generic. */ }
      return json({ error: `The private image renderer returned HTTP ${rendered.status}.${detail ? ` ${detail}` : ""} No media object or row was created.` }, 502);
    }
    if (!String(rendered.headers.get("Content-Type") || "").toLowerCase().startsWith("image/webp")) {
      return json({ error: "The private image renderer returned an unexpected format. No media object or row was created." }, 502);
    }
    derivative = await readRendererImage(rendered);
    logStage("renderer", "succeeded", rendered.status);
  } catch (error) {
    const failure = error instanceof Error && error.name === "AbortError"
      ? "The private image renderer timed out. No media object or row was created."
      : error instanceof TypeError
        ? "The private image renderer could not be reached. No media object or row was created."
        : "The private image renderer response could not be processed. No media object or row was created.";
    return json({ error: failure }, 502);
  } finally {
    clearTimeout(renderTimeout);
  }
  if (derivative.length < 16 || derivative.length > MAX_DERIVATIVE_BYTES
    || String.fromCharCode(...derivative.slice(0, 4)) !== "RIFF"
    || String.fromCharCode(...derivative.slice(8, 12)) !== "WEBP") {
    return json({ error: "The private image renderer returned an invalid or oversized WebP. No media object or row was created." }, 502);
  }

  let sortOrder = replacement?.sort_order;
  if (sortOrder === undefined) {
    const { data, error } = await client.from("showcase_project_images").select("sort_order").eq("project_id", project.id);
    if (error) return json({ error: "Existing Showcase media could not be checked before upload." }, 500);
    sortOrder = (data || []).reduce((maximum, row) => Math.max(maximum, Number(row.sort_order) || 0), -1) + 1;
  }

  const { error: sourceUploadError } = await client.storage.from("showcase-media").upload(sourcePath, bytes, {
    contentType: detectedType,
    cacheControl: "3600",
    upsert: false,
  });
  if (sourceUploadError) {
    const { data: existingSource, error: sourceReadError } = await client.storage.from("showcase-media").download(sourcePath);
    if (sourceReadError || !existingSource || !sameBytes(new Uint8Array(await existingSource.arrayBuffer()), bytes)) {
      logStage("private_source_storage", "failed");
      return json({ error: "The private source upload could not be confirmed. Retry the same selected file so the request can be safely reconciled." }, 502);
    }
  }
  logStage("private_source_storage", sourceUploadError ? "existing_upload_verified" : "succeeded");
  const { error: uploadError } = await client.storage.from("showcase-media").upload(path, derivative, {
    contentType: "image/webp",
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) {
    const { data: existingPreview, error: previewReadError } = await client.storage.from("showcase-media").download(path);
    if (previewReadError || !existingPreview) {
      logStage("private_preview_storage", "unconfirmed");
      return json({ error: "The private preview storage result could not be confirmed. Retry the same selected file; this request uses a stable ID to prevent duplicate records." }, 502);
    }
    derivative = new Uint8Array(await existingPreview.arrayBuffer());
    if (derivative.length < 16 || derivative.length > MAX_DERIVATIVE_BYTES
      || String.fromCharCode(...derivative.slice(0, 4)) !== "RIFF"
      || String.fromCharCode(...derivative.slice(8, 12)) !== "WEBP") {
      logStage("private_preview_storage", "existing_object_invalid");
      return json({ error: "The existing private preview object is invalid; ask an administrator to inspect the upload before retrying." }, 502);
    }
    logStage("private_preview_storage", "existing_upload_verified");
  } else {
    logStage("private_preview_storage", "succeeded");
  }

  const { data: media, error: insertError } = await client.from("showcase_project_images").insert({
    project_id: project.id,
    storage_path: path,
    presentation,
    sort_order: sortOrder,
    content_type: "image/webp",
    byte_size: derivative.byteLength,
    alt_text: altText,
    caption,
    created_by: authData.user.id,
    is_public_preview: false,
  }).select("id,project_id,presentation,content_type,byte_size,alt_text,caption,is_public_preview,sort_order,created_at").single();
  if (insertError || !media) {
    // Concurrent retries with the same request ID can both reach this insert.
    // If the other request already committed this exact object, return its row
    // instead of rolling back (and potentially deleting) the winning upload.
    const { data: concurrentMedia } = await client.from("showcase_project_images")
      .select("id,project_id,presentation,content_type,byte_size,alt_text,caption,is_public_preview,sort_order,created_at,created_by")
      .eq("storage_path", path).maybeSingle();
    if (concurrentMedia?.project_id === project.id && concurrentMedia.created_by === authData.user.id) {
      if (replacement && replacement.id !== concurrentMedia.id) {
        const { error: replaceError } = await client.from("showcase_project_images")
          .update({ presentation: "gallery", is_public_preview: false })
          .eq("id", replacement.id).eq("project_id", project.id);
        if (replaceError) return json({ error: "The preview is saved privately, but the previous preview could not be safely retired." }, 502);
      }
      logStage("media_metadata", "concurrent_retry_reconciled");
      return json({
        media: {
          id: concurrentMedia.id, project_id: concurrentMedia.project_id, presentation: concurrentMedia.presentation,
          content_type: concurrentMedia.content_type, byte_size: concurrentMedia.byte_size, alt_text: concurrentMedia.alt_text,
          caption: concurrentMedia.caption, is_public_preview: concurrentMedia.is_public_preview,
          sort_order: concurrentMedia.sort_order, created_at: concurrentMedia.created_at,
        },
        status: "uploaded_unapproved",
        publicationReviewInvalidated: Boolean(project.is_published || project.public_content_review_confirmed || project.client_consent_confirmed),
      }, 200);
    }
    logStage("media_metadata", "failed");
    const cleanupFailures = await removeNewUpload(client, path, undefined, sourcePath);
    return json({
      error: insertError ? "The preview metadata could not be saved." : "The preview metadata response was incomplete.",
      cleanupWarning: cleanupFailures.length ? cleanupFailures.join(" ") : undefined,
    }, 502);
  }
  logStage("media_metadata", "succeeded");

  if (replacement) {
    const { error: replaceError } = await client.from("showcase_project_images")
      .update({ presentation: "gallery", is_public_preview: false })
      .eq("id", replacement.id).eq("project_id", project.id);
    if (replaceError) {
      const cleanupFailures = await removeNewUpload(client, path, media.id, sourcePath);
      return json({
        error: "The new preview was uploaded, but the previous preview could not be safely retired.",
        cleanupWarning: cleanupFailures.length ? cleanupFailures.join(" ") : undefined,
      }, 502);
    }
  }

  return json({
    media,
    status: "uploaded_unapproved",
    publicationReviewInvalidated: Boolean(project.is_published || project.public_content_review_confirmed || project.client_consent_confirmed),
  }, 201);
});
