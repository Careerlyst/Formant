// Formant Edge Function: send-push-notification
// Sends Web Push notifications to subscribed client browsers with VAPID signing, concurrency control, and auto-invalidation.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushRequestBody {
  title: string;
  body?: string;
  action_url?: string;
  url?: string;
  recipientMode: "user" | "selected" | "all";
  recipients?: string[];
  userId?: string;
  priority?: "normal" | "important" | "urgent";
}

Deno.serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 2. Validate environment secrets
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@formant.com";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({
          error: "VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Supabase Edge Function secrets."
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Configure Web Push VAPID
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // 3. Authenticate caller using JWT
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired authentication token." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerId = authData.user.id;

    // 4. Verify caller authorization in user_roles
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .maybeSingle();

    const allowedRoles = ["admin", "expert", "support", "finance"];
    const userRole = (roleRow?.role || "").toLowerCase();

    if (roleError || !allowedRoles.includes(userRole)) {
      return new Response(
        JSON.stringify({ error: "Forbidden: You do not have staff permissions to send push notifications." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Parse and validate payload
    const bodyJson: PushRequestBody = await req.json();
    const {
      title,
      body = "",
      action_url,
      url,
      recipientMode = "user",
      recipients = [],
      userId,
      priority = "normal"
    } = bodyJson;

    if (!title || typeof title !== "string" || !title.trim()) {
      return new Response(
        JSON.stringify({ error: "Validation error: Notification title is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (title.trim().length > 140) {
      return new Response(
        JSON.stringify({ error: "Validation error: Title cannot exceed 140 characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (body && body.length > 1000) {
      return new Response(
        JSON.stringify({ error: "Validation error: Message body cannot exceed 1000 characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Resolve and verify target client user IDs
    let targetUserIds: string[] = [];
    const CHUNK_SIZE = 200;

    if (recipientMode === "all") {
      // Server-side resolution: Paginate all user_roles where role = 'client'
      const PAGE_SIZE = 1000;
      let from = 0;
      const clientIds: string[] = [];

      while (true) {
        const { data: rolesData, error: rolesErr } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "client")
          .range(from, from + PAGE_SIZE - 1);

        if (rolesErr) {
          return new Response(
            JSON.stringify({ error: `Failed to load client roles: ${rolesErr.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!rolesData || rolesData.length === 0) break;
        for (const r of rolesData) {
          if (r.user_id) clientIds.push(r.user_id);
        }
        if (rolesData.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      targetUserIds = Array.from(new Set(clientIds));
    } else {
      // recipientMode === 'selected' or 'user'
      let candidateIds: string[] = [];
      if (recipientMode === "selected") {
        candidateIds = Array.isArray(recipients) ? recipients.filter(Boolean) : [];
      } else {
        const singleId = userId || (recipients && recipients[0]);
        if (singleId) {
          candidateIds = [singleId];
        }
      }

      candidateIds = Array.from(new Set(candidateIds));

      if (!candidateIds.length) {
        return new Response(
          JSON.stringify({ error: "No recipients specified for notification." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify that all candidate IDs have role = 'client' in user_roles (chunked in slices of 200)
      const verifiedClientIds: string[] = [];

      for (let i = 0; i < candidateIds.length; i += CHUNK_SIZE) {
        const chunk = candidateIds.slice(i, i + CHUNK_SIZE);
        const { data: roleRows, error: roleVerifyErr } = await supabaseAdmin
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", chunk);

        if (roleVerifyErr) {
          return new Response(
            JSON.stringify({ error: `Failed to verify recipient roles: ${roleVerifyErr.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (roleRows) {
          for (const row of roleRows) {
            if ((row.role || "").toLowerCase() === "client") {
              verifiedClientIds.push(row.user_id);
            }
          }
        }
      }

      targetUserIds = Array.from(new Set(verifiedClientIds));
    }

    if (!targetUserIds.length) {
      return new Response(
        JSON.stringify({
          error: "No eligible client recipients found (staff roles cannot be targeted for client push notifications)."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Retrieve active push subscriptions in chunks of 200
    const activeSubscriptions: Array<{
      id: string;
      user_id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }> = [];

    for (let i = 0; i < targetUserIds.length; i += CHUNK_SIZE) {
      const chunk = targetUserIds.slice(i, i + CHUNK_SIZE);
      const { data: subsData, error: subsErr } = await supabaseAdmin
        .from("push_subscriptions")
        .select("id, user_id, endpoint, p256dh, auth")
        .in("user_id", chunk)
        .is("invalidated_at", null);

      if (subsErr) {
        return new Response(
          JSON.stringify({ error: `Failed to query push subscriptions: ${subsErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (subsData) {
        for (const s of subsData) {
          if (s.endpoint && s.p256dh && s.auth) {
            activeSubscriptions.push(s);
          }
        }
      }
    }

    // If no active subscriptions found, return early with zero counts
    if (activeSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          recipientsTargeted: targetUserIds.length,
          subscriptionsFound: 0,
          pushAttempted: 0,
          pushAccepted: 0,
          pushFailed: 0,
          invalidatedCount: 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Prepare notification payload
    const linkDestination = (action_url || url || "/dashboard").trim();
    const pushPayloadString = JSON.stringify({
      title: title.trim(),
      body: body ? body.trim() : "",
      icon: "/assets/formant-symbol-192.png",
      badge: "/assets/formant-symbol-192.png",
      tag: `formant-${Date.now()}`,
      priority,
      url: linkDestination,
      action_url: linkDestination
    });

    let pushAttempted = 0;
    let pushAccepted = 0;
    let pushFailed = 0;
    const successfulSubIds: string[] = [];
    const invalidatedSubIds: string[] = [];

    // 9. Dispatch push using concurrency pool (20 parallel workers)
    const CONCURRENCY_LIMIT = 20;
    let currentIndex = 0;

    async function dispatchWorker() {
      while (true) {
        const index = currentIndex++;
        if (index >= activeSubscriptions.length) break;

        const sub = activeSubscriptions[index];
        pushAttempted++;

        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
              }
            },
            pushPayloadString
          );

          pushAccepted++;
          successfulSubIds.push(sub.id);
        } catch (err: any) {
          pushFailed++;
          const statusCode = err?.statusCode || err?.status;

          // 404 (Not Found) or 410 (Gone) indicates expired or unregistered subscription
          if (statusCode === 404 || statusCode === 410) {
            invalidatedSubIds.push(sub.id);
          }
        }
      }
    }

    const workerCount = Math.min(CONCURRENCY_LIMIT, activeSubscriptions.length);
    const workers = Array.from({ length: workerCount }, () => dispatchWorker());
    await Promise.all(workers);

    // 10. Batch update last_success_at and invalidated_at
    const nowIso = new Date().toISOString();
    const BATCH_UPDATE_CHUNK = 200;

    for (let i = 0; i < successfulSubIds.length; i += BATCH_UPDATE_CHUNK) {
      const chunk = successfulSubIds.slice(i, i + BATCH_UPDATE_CHUNK);
      await supabaseAdmin
        .from("push_subscriptions")
        .update({ last_success_at: nowIso })
        .in("id", chunk);
    }

    for (let i = 0; i < invalidatedSubIds.length; i += BATCH_UPDATE_CHUNK) {
      const chunk = invalidatedSubIds.slice(i, i + BATCH_UPDATE_CHUNK);
      await supabaseAdmin
        .from("push_subscriptions")
        .update({ invalidated_at: nowIso })
        .in("id", chunk);
    }

    // 11. Return delivery summary
    return new Response(
      JSON.stringify({
        success: true,
        recipientsTargeted: targetUserIds.length,
        subscriptionsFound: activeSubscriptions.length,
        pushAttempted,
        pushAccepted,
        pushFailed,
        invalidatedCount: invalidatedSubIds.length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-push-notification error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
