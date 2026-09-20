import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PaymentRequest = {
  action?: unknown;
  giftId?: unknown;
  paidMinute?: unknown;
  sessionId?: unknown;
  senderName?: unknown;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const accessToken = tokenMatch?.[1]?.trim() ?? "";

  if (!accessToken || !supabaseUrl || !supabaseAnonKey) {
    return {
      accessToken,
      user: null,
      error: !accessToken
        ? "Missing or invalid Bearer token."
        : "SUPABASE_URL or SUPABASE_ANON_KEY is missing.",
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return {
      accessToken,
      user: null,
      error: error?.message ?? "No user resolved from access token.",
    };
  }

  return { accessToken, user: data.user, error: null };
}

function normalizeUuid(value: unknown) {
  const candidate = typeof value === "string" ? value.trim() : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : "";
}

function normalizePaidMinute(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(240, Math.floor(value)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return json(500, { error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing." });
  }

  const { user, error } = await requireUser(req);

  if (error || !user) {
    return json(401, { error: error ?? "Unauthorized." });
  }

  let payload: PaymentRequest;

  try {
    payload = (await req.json()) as PaymentRequest;
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const action = payload.action === "gift" || payload.action === "paid_minutes" ? payload.action : "";
  const sessionId = normalizeUuid(payload.sessionId);

  if (!action) {
    return json(400, { error: "Invalid live payment action." });
  }

  if (!sessionId) {
    return json(400, { error: "Invalid live session." });
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
  const { data, error: paymentError } = await serviceClient.rpc("record_live_payment", {
    p_action: action,
    p_gift_id: typeof payload.giftId === "string" ? payload.giftId : null,
    p_paid_minute: normalizePaidMinute(payload.paidMinute),
    p_sender_name: typeof payload.senderName === "string" ? payload.senderName : user.email ?? "Student",
    p_session_id: sessionId,
    p_user_id: user.id,
  });

  if (paymentError) {
    const message = paymentError.message || "Could not process live payment.";
    const status = /insufficient|balance/i.test(message) ? 402 : /accepted|teacher|available/i.test(message) ? 403 : 400;
    return json(status, { error: message });
  }

  if (!data || typeof data !== "object" || !("balanceAfter" in data)) {
    return json(500, { error: "Live payment response is invalid." });
  }

  return json(200, data);
});
