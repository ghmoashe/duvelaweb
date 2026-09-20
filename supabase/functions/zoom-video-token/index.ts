import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const zoomSdkKey = Deno.env.get("ZOOM_VIDEO_SDK_KEY") ??
  Deno.env.get("ZOOM_SDK_KEY") ?? "";
const zoomSdkSecret = Deno.env.get("ZOOM_VIDEO_SDK_SECRET") ??
  Deno.env.get("ZOOM_SDK_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type RequestBody = {
  action?: unknown;
  sessionId?: unknown;
};

type ClassSessionRow = {
  id: string;
  class_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  zoom_topic: string | null;
  started_at: string | null;
};

type ClassRow = {
  id: string;
  course_id: string | null;
  organization_id: string;
  teacher_id: string | null;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeSessionId(value: unknown) {
  const sessionId = typeof value === "string" ? value.trim() : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(sessionId)
    ? sessionId
    : "";
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function encodeJson(value: unknown) {
  return encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function signZoomJwt(topic: string, role: 0 | 1, userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  // Zoom Video SDK's documented JWT contract uses `user_identity` (per
  // https://developers.zoom.us/docs/video-sdk/auth/); `user_key` is NOT one of
  // the recognised claims and, when combined with role_type=1, made the host
  // JWT invalid and every join failed with ZoomVideoSDKError_Wrong_Usage on
  // the client. We still pass the Supabase user id so cloud recordings and
  // attendance events can be matched back to the account.
  const payload = encodeJson({
    app_key: zoomSdkKey,
    exp: now + 2 * 60 * 60,
    iat: now - 30,
    role_type: role,
    tpc: topic,
    user_identity: userId,
    version: 1,
  });
  const unsignedToken = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(zoomSdkSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(unsignedToken),
  );
  return `${unsignedToken}.${encodeBase64Url(new Uint8Array(signature))}`;
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken || !supabaseUrl || !supabaseAnonKey) return null;
  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await authClient.auth.getUser(accessToken);
  return error ? null : data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed." });
  }
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return json(500, { error: "Supabase function environment is incomplete." });
  }

  const user = await requireUser(req);
  if (!user) {
    return json(401, { error: "Authentication required." });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const sessionId = normalizeSessionId(body.sessionId);
  const action = body.action === "end"
    ? "end"
    : body.action === "start"
    ? "start"
    : "join";
  if (!sessionId) {
    return json(400, { error: "A valid sessionId is required." });
  }

  const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sessionData, error: sessionError } = await admin
    .from("class_sessions")
    .select("id,class_id,title,starts_at,ends_at,status,zoom_topic,started_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    console.error("Failed to load Zoom class session.", sessionError);
    return json(500, { error: "Unable to load the class session." });
  }
  if (!sessionData) {
    return json(404, { error: "Class session not found." });
  }

  const session = sessionData as ClassSessionRow;
  const { data: classData, error: classError } = await admin
    .from("classes")
    .select("id,course_id,organization_id,teacher_id")
    .eq("id", session.class_id)
    .maybeSingle();

  if (classError || !classData) {
    console.error("Failed to load Zoom class.", classError);
    return json(500, { error: "Unable to load the class." });
  }

  const classroom = classData as ClassRow;
  let isHost = classroom.teacher_id === user.id;
  if (!isHost) {
    const { data: staffMembership } = await admin
      .from("organization_memberships")
      .select("user_id")
      .eq("organization_id", classroom.organization_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .maybeSingle();
    isHost = Boolean(staffMembership);
  }

  let isLearner = false;
  if (!isHost) {
    const { data: classClient } = await admin
      .from("class_clients")
      .select("client_id")
      .eq("class_id", classroom.id)
      .eq("client_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    isLearner = Boolean(classClient);

    if (!isLearner && classroom.course_id) {
      const { data: enrollment } = await admin
        .from("course_enrollments")
        .select("user_id")
        .eq("course_id", classroom.course_id)
        .eq("user_id", user.id)
        .eq("status", "confirmed")
        .maybeSingle();
      isLearner = Boolean(enrollment);
    }
  }

  if (!isHost && !isLearner) {
    return json(403, { error: "You are not enrolled in this class." });
  }

  if (action === "end") {
    if (!isHost) {
      return json(403, { error: "Only the class host can end the session." });
    }
    const { error: endError } = await admin
      .from("class_sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
      })
      .eq("id", session.id);
    if (endError) {
      console.error("Failed to end Zoom class session.", endError);
      return json(500, { error: "Unable to end the class session." });
    }
    return json(200, { ended: true });
  }

  if (session.status === "canceled" || session.status === "cancelled") {
    return json(409, { error: "This class session was canceled." });
  }
  if (session.status === "completed") {
    return json(409, { error: "This class session has ended." });
  }

  const startsAt = new Date(session.starts_at).getTime();
  const defaultEnd = startsAt + 4 * 60 * 60_000;
  const endsAt = session.ends_at
    ? new Date(session.ends_at).getTime()
    : defaultEnd;
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    return json(500, { error: "The class schedule is invalid." });
  }

  const now = Date.now();
  const role: 0 | 1 = isHost ? 1 : 0;
  if (now < startsAt - 30 * 60_000) {
    return json(200, {
      message: "The classroom opens 30 minutes before the lesson.",
      role,
      title: session.title,
      waiting: true,
    });
  }
  if (now > endsAt + 15 * 60_000) {
    return json(410, { error: "This class session has expired." });
  }
  if (action === "start") {
    if (!isHost) {
      return json(403, { error: "Only the class host can start the session." });
    }
    const topic = session.zoom_topic ??
      `duvela-${session.id.replaceAll("-", "")}`;
    const { error: startError } = await admin
      .from("class_sessions")
      .update({
        started_at: session.started_at ?? new Date().toISOString(),
        status: "live",
        zoom_topic: topic,
      })
      .eq("id", session.id);
    if (startError) {
      console.error("Failed to start Zoom class session.", startError);
      return json(500, { error: "Unable to start the class session." });
    }
    return json(200, { started: true });
  }
  if (!isHost && session.status !== "live") {
    return json(200, {
      message: "The teacher has not opened the classroom yet.",
      role,
      title: session.title,
      waiting: true,
    });
  }
  if (!zoomSdkKey || !zoomSdkSecret) {
    return json(500, {
      error: "Zoom Video SDK credentials are not configured.",
    });
  }

  const topic = session.zoom_topic ??
    `duvela-${session.id.replaceAll("-", "")}`;
  if (!session.zoom_topic) {
    const { error: topicError } = await admin
      .from("class_sessions")
      .update({ zoom_topic: topic })
      .eq("id", session.id);
    if (topicError) {
      console.error("Failed to persist Zoom topic.", topicError);
      return json(500, { error: "Unable to prepare the class session." });
    }
  }

  try {
    return json(200, {
      role,
      title: session.title,
      token: await signZoomJwt(topic, role, user.id),
      topic,
    });
  } catch (error) {
    console.error("Failed to sign Zoom Video SDK token.", error);
    return json(500, { error: "Unable to create the Zoom access token." });
  }
});
