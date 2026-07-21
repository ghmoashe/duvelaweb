import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authorization = req.headers.get("Authorization") || "";
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Notification service is not configured." }, 500);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: authData } = await userClient.auth.getUser();
  if (!authData.user) return json({ error: "Authentication required." }, 401);

  const payload = await req.json().catch(() => ({}));
  const sessionId = String(payload.sessionId || "");
  if (!sessionId) return json({ error: "sessionId is required." }, 400);

  const service = createClient(supabaseUrl, serviceKey);
  const { data: session } = await service.from("live_sessions")
    .select("id,teacher_id,teacher_name,topic,status")
    .eq("id", sessionId).maybeSingle();
  if (!session || session.teacher_id !== authData.user.id) return json({ error: "Only the room teacher can notify followers." }, 403);
  if (session.status !== "live") return json({ error: "The session is not live." }, 409);

  const { data: dispatched } = await service.from("live_start_notification_dispatches")
    .select("session_id,recipient_count").eq("session_id", sessionId).maybeSingle();
  if (dispatched) return json({ notified: dispatched.recipient_count, duplicate: true });

  const { data: followers, error: followersError } = await service.from("user_follows")
    .select("follower_id").eq("following_id", session.teacher_id);
  if (followersError) return json({ error: followersError.message }, 500);

  const recipientIds = [...new Set((followers || []).map((row) => row.follower_id).filter(Boolean))];
  const teacherName = session.teacher_name || "Duvela teacher";
  const topic = session.topic || "LIVE lesson";
  if (recipientIds.length) {
    const rows = recipientIds.map((userId) => ({
      user_id: userId,
      type: "live_started",
      title: `${teacherName} is LIVE`,
      body: `${topic} — open Duvela to watch now.`,
      read: false,
    }));
    const { error } = await service.from("notifications").insert(rows);
    if (error) return json({ error: error.message }, 500);
  }

  const { error: dispatchError } = await service.from("live_start_notification_dispatches").insert({
    session_id: sessionId,
    teacher_id: session.teacher_id,
    recipient_count: recipientIds.length,
  });
  if (dispatchError && dispatchError.code !== "23505") return json({ error: dispatchError.message }, 500);
  return json({ notified: recipientIds.length, duplicate: dispatchError?.code === "23505" });
});
