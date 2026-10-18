// Public delivery is limited to approved image previews. Original documents remain staff-only.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...corsHeaders, "Allow": "GET, OPTIONS" },
    });
  }

  const requestUrl = new URL(request.url);
  const imageId = requestUrl.searchParams.get("imageId") || "";
  const requestDownload = requestUrl.searchParams.get("download") === "1";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(imageId)) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Showcase image delivery is not configured", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: image, error: imageError } = await serviceClient
    .from("showcase_project_images")
    .select("storage_path, content_type, is_public_preview, showcase_projects!inner(id,is_published,public_content_review_confirmed,client_consent_confirmed,project_type,title)")
    .eq("id", imageId)
    .maybeSingle();

  if (imageError || !image?.storage_path) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  const project = image.showcase_projects;
  const isPublished = Boolean(project?.is_published);
  const isApproved = Boolean(project?.public_content_review_confirmed)
    && (project?.project_type !== "client_work" || Boolean(project?.client_consent_confirmed));
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  let isEditor = false;
  if (token) {
    const { data: authData, error: authError } = await serviceClient.auth.getUser(token);
    if (!authError && authData.user) {
      const { data: roleRow, error: roleError } = await serviceClient
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id)
        .maybeSingle();
      isEditor = !roleError && ["admin", "expert", "support"].includes(String(roleRow?.role || "").toLowerCase());
    }
  }

  const isImagePreview = image.content_type.startsWith("image/") && Boolean(image.is_public_preview);
  const isPubliclyAvailable = isImagePreview && isPublished && isApproved;
  const isOriginalDocument = image.content_type === "application/pdf";
  if ((isOriginalDocument || !isPubliclyAvailable) && !isEditor) {
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
  if (requestDownload && (isOriginalDocument ? !isEditor : true)) {
    return new Response("Original documents are available to authorized staff only", { status: 403, headers: corsHeaders });
  }

  const { data: imageBlob, error: downloadError } = await serviceClient.storage
    .from("showcase-media")
    .download(image.storage_path);
  if (downloadError || !imageBlob) {
    return new Response("Showcase media unavailable", { status: 404, headers: corsHeaders });
  }

  const safeTitle = String(project?.title || "formant-document").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80) || "formant-document";
  const contentDisposition = isOriginalDocument
    ? `${requestDownload ? "attachment" : "inline"}; filename="${safeTitle}.pdf"`
    : "inline";

  return new Response(imageBlob.stream(), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": image.content_type || imageBlob.type || "application/octet-stream",
      "Content-Length": String(imageBlob.size),
      "Content-Disposition": contentDisposition,
      // Never cache public bytes: an editor must be able to unpublish a project
      // and stop subsequent delivery without a stale CDN copy being served.
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
});
