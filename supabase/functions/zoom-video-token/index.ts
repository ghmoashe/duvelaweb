import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const base64url = (value: string | Uint8Array) => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};
async function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const input = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input)));
  return `${input}.${base64url(signature)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const sdkKey = Deno.env.get("ZOOM_VIDEO_SDK_KEY") || "";
  const sdkSecret = Deno.env.get("ZOOM_VIDEO_SDK_SECRET") || "";
  const authorization = req.headers.get("Authorization") || "";
  if (!supabaseUrl || !anonKey || !serviceKey || !sdkKey || !sdkSecret) {
    return json({ error: "Zoom Classroom is not configured." }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: authData } = await userClient.auth.getUser();
  const user = authData.user;
  if (!user) return json({ error: "Authentication required." }, 401);

  const body = await req.json().catch(() => ({}));
  const sessionId = String(body.sessionId || "");
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return json({ error: "Valid sessionId is required." }, 400);

  const service = createClient(supabaseUrl, serviceKey);
  const { data: session, error: sessionError } = await service.from("class_sessions")
    .select("id,class_id,title,starts_at,status,created_by,provider,session_name,waiting_room_enabled,duration_min")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError || !session) return json({ error: "Class session not found." }, 404);
  if (session.provider && session.provider !== "zoom") return json({ error: "This is not a Zoom classroom." }, 409);

  const isTeacher = session.created_by === user.id;
  let isMember = false;
  if (!isTeacher) {
    const { data: linkedClass } = await service.from("classes")
      .select("course_id")
      .eq("id", session.class_id)
      .maybeSingle();
    if (linkedClass?.course_id) {
      const { data: enrollment } = await service.from("course_enrollments")
        .select("id")
        .eq("course_id", linkedClass.course_id)
        .eq("user_id", user.id)
        .eq("status", "confirmed")
        .maybeSingle();
      isMember = Boolean(enrollment);
    } else {
      const { data: membership } = await service.from("class_clients")
        .select("id")
        .eq("class_id", session.class_id)
        .eq("client_id", user.id)
        .neq("status", "removed")
        .maybeSingle();
      isMember = Boolean(membership);
    }
  }
  if (!isTeacher && !isMember) return json({ error: "A confirmed course enrollment is required to enter this classroom." }, 403);
  if (!isTeacher && ["ended", "cancelled"].includes(String(session.status))) {
    return json({ error: "This class session has ended." }, 409);
  }
  const startTime = Date.parse(String(session.starts_at || ""));
  if (!isTeacher && Number.isFinite(startTime)) {
    const earliestJoin = startTime - 30 * 60 * 1000;
    const latestJoin = startTime + 6 * 60 * 60 * 1000;
    if (Date.now() < earliestJoin) return json({ error: "The classroom opens 30 minutes before the lesson." }, 425);
    if (Date.now() > latestJoin) return json({ error: "This class session has ended." }, 409);
  }

  if (!isTeacher && session.waiting_room_enabled) {
    const { data: waiting } = await service.from("class_waiting_room")
      .select("status").eq("session_id", session.id).eq("user_id", user.id).maybeSingle();
    if (waiting?.status === "denied") return json({ error: "The teacher declined this entry request." }, 403);
    if (waiting?.status !== "admitted") {
      await service.from("class_waiting_room").upsert({
        session_id: session.id, user_id: user.id, status: "waiting", requested_at: new Date().toISOString(),
      }, { onConflict: "session_id,user_id" });
      return json({ waiting: true, topic: session.session_name, title: session.title });
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const topic = session.session_name || `duvela-class-${session.id}`;
  const token = await signJwt({
    app_key: sdkKey,
    iat: now - 30,
    exp: now + 7200,
    tpc: topic,
    role_type: isTeacher ? 1 : 0,
    session_key: session.id,
    user_identity: user.id,
  }, sdkSecret);
  return json({
    token,
    topic,
    role: isTeacher ? "host" : "participant",
    title: session.title,
  });
});
