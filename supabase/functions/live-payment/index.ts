import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const gifts: Record<string, { name: string; cost: number }> = {
  rose: { name: "Rose", cost: 0 },
  heart: { name: "Heart", cost: 0 },
  coffee: { name: "Coffee", cost: 0 },
  book: { name: "Book", cost: 0 },
  "fire-gift": { name: "Fire gift", cost: 10 },
  crown: { name: "Crown", cost: 12 },
  "magic-box": { name: "Magic Box", cost: 15 },
  watch: { name: "Watch", cost: 16 },
  diamond: { name: "Diamond", cost: 18 },
  "duvela-star": { name: "DUVELA Star", cost: 20 },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization") || "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "LIVE payment function is not configured." }, 500);
  }
  if (!authorization) return json({ error: "Authentication required." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Authentication required." }, 401);

  const payload = await req.json().catch(() => null);
  if (payload?.action !== "gift") return json({ error: "Unsupported LIVE payment action." }, 400);

  const sessionId = String(payload.sessionId || "");
  const giftId = String(payload.giftId || "");
  const gift = gifts[giftId];
  if (!sessionId) return json({ error: "sessionId is required." }, 400);
  if (!gift) return json({ error: "Unknown gift." }, 400);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await serviceClient.rpc("send_live_gift", {
    target_session_id: sessionId,
    sender_user_id: userData.user.id,
    sender_display_name: String(payload.senderName || ""),
    gift_key: giftId,
    gift_label: gift.name,
    gift_cost: gift.cost,
  });

  if (error) {
    const message = error.message || "Could not send the gift.";
    const status = message.toLowerCase().includes("insufficient") ? 402 : 400;
    return json({ error: message }, status);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return json({
    balanceAfter: typeof row?.balance_after === "number" ? row.balance_after : null,
    giftId: row?.created_gift_id || null,
  });
});
