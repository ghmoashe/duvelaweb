import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Unified Zoom Video SDK token endpoint ───────────────────────────────────
// This ONE function is deployed to the shared project and serves BOTH clients,
// which speak deliberately different dialects:
//
//   Mobile (Hub + Business, zoom-classroom-screen.tsx)
//     request : { action: 'join' | 'start' | 'end', sessionId }
//     response: { role: 0 | 1, waiting?, token, topic, title }
//     open gate: teacher explicitly POSTs action 'start' to go live.
//
//   Web (duvela-web classroom-src/main.js)
//     request : { sessionId }                       (no action)
//     response: { role: 'host' | 'participant', waiting?, token, topic, title }
//     open gate: host joining is the room; learners pass class_waiting_room.
//
// The two used to be separate source files with separate topics
// (mobile→zoom_topic, web→session_name); a host on one platform and a learner
// on the other landed in different Zoom sessions. Topic is now derived purely
// from the session id and mirrored into both columns so every reader agrees.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ClassSessionRow = {
  id: string;
  class_id: string;
  title: string | null;
  starts_at: string;
  ends_at: string | null;
  status: string;
  provider: string | null;
  zoom_topic: string | null;
  session_name: string | null;
  started_at: string | null;
  created_by: string | null;
  waiting_room_enabled: boolean | null;
};

type ClassRow = {
  id: string;
  course_id: string | null;
  event_id: string | null;
  organization_id: string | null;
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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
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

async function signZoomJwt(
  topic: string,
  role: 0 | 1,
  userId: string,
  sessionId: string,
  sdkKey: string,
  sdkSecret: string,
) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const payload = encodeJson({
    app_key: sdkKey,
    exp: now + 2 * 60 * 60,
    iat: now - 30,
    role_type: role,
    session_key: sessionId,
    tpc: topic,
    user_identity: userId,
    version: 1,
  });
  const unsignedToken = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sdkSecret),
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const zoomSdkKey = Deno.env.get("ZOOM_VIDEO_SDK_KEY") ??
    Deno.env.get("ZOOM_SDK_KEY") ?? "";
  const zoomSdkSecret = Deno.env.get("ZOOM_VIDEO_SDK_SECRET") ??
    Deno.env.get("ZOOM_SDK_SECRET") ?? "";
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return json(500, { error: "Supabase function environment is incomplete." });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) {
    return json(401, { error: "Authentication required." });
  }
  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: userData, error: userError } = await authClient.auth.getUser(
    accessToken,
  );
  if (userError || !userData.user) {
    return json(401, { error: "Authentication required." });
  }
  const user = userData.user;

  let body: { action?: unknown; sessionId?: unknown };
  try {
    body = (await req.json()) as { action?: unknown; sessionId?: unknown };
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  // Web omits `action`; mobile always sends one. This selects the response
  // dialect (numeric vs string role, waiting-room vs status gate).
  const hasAction = body.action === "join" || body.action === "start" ||
    body.action === "end";
  const dialect: "mobile" | "web" = hasAction ? "mobile" : "web";
  const action = body.action === "end"
    ? "end"
    : body.action === "start"
    ? "start"
    : "join";

  const sessionId = normalizeSessionId(body.sessionId);
  if (!sessionId) {
    return json(400, { error: "A valid sessionId is required." });
  }

  const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sessionData, error: sessionError } = await admin
    .from("class_sessions")
    .select(
      "id,class_id,title,starts_at,ends_at,status,provider,zoom_topic,session_name,started_at,created_by,waiting_room_enabled",
    )
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
  if (session.provider && session.provider !== "zoom") {
    return json(409, { error: "This is not a Zoom classroom." });
  }

  const { data: classData, error: classError } = await admin
    .from("classes")
    .select("id,course_id,event_id,organization_id,teacher_id")
    .eq("id", session.class_id)
    .maybeSingle();
  if (classError || !classData) {
    console.error("Failed to load Zoom class.", classError);
    return json(500, { error: "Unable to load the class." });
  }
  const classroom = classData as ClassRow;

  // ── Host detection (teacher / session creator / event organizer / org staff)
  let isHost = classroom.teacher_id === user.id ||
    session.created_by === user.id;
  if (!isHost && classroom.event_id) {
    const { data: hostedEvent } = await admin
      .from("events")
      .select("organizer_id")
      .eq("id", classroom.event_id)
      .maybeSingle();
    isHost =
      (hostedEvent as { organizer_id?: string } | null)?.organizer_id ===
        user.id;
  }
  if (!isHost && classroom.organization_id) {
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

  // ── Learner detection (group member / course enrollee / event RSVP)
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

    if (!isLearner && classroom.event_id) {
      const { data: rsvp } = await admin
        .from("event_rsvps")
        .select("user_id")
        .eq("event_id", classroom.event_id)
        .eq("user_id", user.id)
        .eq("status", "going")
        .maybeSingle();
      isLearner = Boolean(rsvp);
    }
  }

  if (!isHost && !isLearner) {
    return json(403, { error: "You are not enrolled in this class." });
  }

  // Deterministic topic — identical on every platform, mirrored to both columns.
  const topic = session.zoom_topic ?? session.session_name ??
    `duvela-class-${session.id}`;
  const roleValue: 0 | 1 = isHost ? 1 : 0;
  const roleForDialect = dialect === "web"
    ? (isHost ? "host" : "participant")
    : roleValue;

  const isCanceled = session.status === "canceled" ||
    session.status === "cancelled";
  const isEnded = session.status === "completed" || session.status === "ended";

  // ── Mobile: explicit teacher lifecycle actions ────────────────────────────
  if (action === "end") {
    if (!isHost) {
      return json(403, { error: "Only the class host can end the session." });
    }
    const { error: endError } = await admin
      .from("class_sessions")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", session.id);
    if (endError) {
      console.error("Failed to end Zoom class session.", endError);
      return json(500, { error: "Unable to end the class session." });
    }
    return json(200, { ended: true });
  }

  if (isCanceled) {
    return json(409, { error: "This class session was canceled." });
  }
  if (isEnded && !isHost) {
    return json(409, { error: "This class session has ended." });
  }

  const startsAt = new Date(session.starts_at).getTime();
  const endsAt = session.ends_at
    ? new Date(session.ends_at).getTime()
    : startsAt + 4 * 60 * 60_000;
  if (!Number.isFinite(startsAt)) {
    return json(500, { error: "The class schedule is invalid." });
  }

  const now = Date.now();
  if (!isHost && now < startsAt - 30 * 60_000) {
    return json(200, {
      message: "The classroom opens 30 minutes before the lesson.",
      role: roleForDialect,
      title: session.title,
      topic,
      waiting: true,
    });
  }
  if (!isHost && now > endsAt + 15 * 60_000) {
    return json(410, { error: "This class session has expired." });
  }

  if (action === "start") {
    if (!isHost) {
      return json(403, { error: "Only the class host can start the session." });
    }
    const { error: startError } = await admin
      .from("class_sessions")
      .update({
        started_at: session.started_at ?? new Date().toISOString(),
        status: "live",
        zoom_topic: topic,
        session_name: topic,
      })
      .eq("id", session.id);
    if (startError) {
      console.error("Failed to start Zoom class session.", startError);
      return json(500, { error: "Unable to start the class session." });
    }
    return json(200, { started: true });
  }

  // ── Learner gate (dialect-specific) ───────────────────────────────────────
  if (!isHost) {
    if (dialect === "web") {
      // Web has no explicit "start": the host simply joins, and when a waiting
      // room is enabled the host admits learners from class_waiting_room.
      // Without a waiting room, learners are admitted directly (the Zoom SDK
      // itself keeps them in the lobby until the host is present).
      if (session.waiting_room_enabled) {
        const { data: waiting } = await admin
          .from("class_waiting_room")
          .select("status")
          .eq("session_id", session.id)
          .eq("user_id", user.id)
          .maybeSingle();
        const waitStatus = (waiting as { status?: string } | null)?.status;
        if (waitStatus === "denied") {
          return json(403, {
            error: "The teacher declined this entry request.",
          });
        }
        if (waitStatus !== "admitted") {
          await admin.from("class_waiting_room").upsert({
            session_id: session.id,
            user_id: user.id,
            status: "waiting",
            requested_at: new Date().toISOString(),
          }, { onConflict: "session_id,user_id" });
          return json(200, {
            role: roleForDialect,
            title: session.title,
            topic,
            waiting: true,
          });
        }
      }
    } else if (session.status !== "live") {
      // Mobile gate: the teacher POSTs action 'start' to open the room, so a
      // learner waits until the session is live.
      return json(200, {
        message: "The teacher has not opened the classroom yet.",
        role: roleForDialect,
        title: session.title,
        topic,
        waiting: true,
      });
    }
  }

  if (!zoomSdkKey || !zoomSdkSecret) {
    return json(500, {
      error: "Zoom Video SDK credentials are not configured.",
    });
  }

  // Persist the deterministic topic so any other reader agrees on the room.
  if (!session.zoom_topic || !session.session_name) {
    const { error: topicError } = await admin
      .from("class_sessions")
      .update({ zoom_topic: topic, session_name: topic })
      .eq("id", session.id);
    if (topicError) {
      console.error("Failed to persist Zoom topic.", topicError);
    }
  }

  try {
    return json(200, {
      role: roleForDialect,
      title: session.title,
      token: await signZoomJwt(
        topic,
        roleValue,
        user.id,
        session.id,
        zoomSdkKey,
        zoomSdkSecret,
      ),
      topic,
    });
  } catch (error) {
    console.error("Failed to sign Zoom Video SDK token.", error);
    return json(500, { error: "Unable to create the Zoom access token." });
  }
});
