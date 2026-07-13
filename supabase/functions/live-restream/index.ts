import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  const authorization = req.headers.get("Authorization") || "";
  if (!supabaseUrl || !anonKey) return json({ error: "LIVE restream function is not configured." }, 500);
  if (!authorization) return json({ error: "Authentication required." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Authentication required." }, 401);

  const payload = await req.json().catch(() => ({}));
  const action = String(payload?.action || "status");

  if (action === "stop") return json({ results: {} });
  if (action === "status") return json({ results: {} });
  if (action !== "start") return json({ error: "Unsupported LIVE restream action." }, 400);

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) return json({ error: "LIVE restream function is not configured." }, 500);

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await serviceClient
    .from("live_restream_targets")
    .select("platform,enabled")
    .eq("teacher_id", userData.user.id)
    .eq("enabled", true);

  if (error) return json({ error: error.message }, 400);

  const results: Record<string, string> = {};
  for (const target of data || []) {
    results[target.platform] = "not_configured";
  }

  return json({ results });
});
