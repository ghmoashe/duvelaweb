import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "Content-Type": "application/json" };

Deno.serve(async (request) => {
  const expected = Deno.env.get("CRON_SECRET") || "";
  const supplied = request.headers.get("x-cron-secret") || "";
  if (!expected || supplied !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }
  const client = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );
  const { data, error } = await client.rpc("dispatch_zoom_course_reminders");
  return new Response(JSON.stringify(error ? { error: error.message } : { created: data || 0 }), {
    status: error ? 500 : 200,
    headers,
  });
});
