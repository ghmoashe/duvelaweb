import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id, x-language",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";
  const authorization = req.headers.get("Authorization") || "";
  if (!supabaseUrl || !anonKey || !serviceKey || !openaiKey) return json({ error: "Transcription service is not configured." }, 500);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: "Authentication required." }, 401);
  const sessionId = req.headers.get("x-session-id") || "";
  const language = (req.headers.get("x-language") || "").slice(0, 10);
  const audio = await req.arrayBuffer();
  if (!sessionId || !audio.byteLength || audio.byteLength > 12_000_000) return json({ error: "Invalid audio chunk." }, 400);
  const service = createClient(supabaseUrl, serviceKey);
  const { data: session } = await service.from("live_sessions").select("teacher_id").eq("id", sessionId).maybeSingle();
  if (!session || session.teacher_id !== userData.user.id) return json({ error: "Only the room teacher can transcribe this LIVE." }, 403);
  const form = new FormData();
  form.append("model", "gpt-4o-mini-transcribe");
  if (language) form.append("language", language.split("-")[0]);
  form.append("file", new File([audio], "live-chunk.webm", { type: req.headers.get("content-type") || "audio/webm" }));
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${openaiKey}` }, body: form });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return json({ error: result?.error?.message || "Transcription failed." }, 502);
  const text = String(result.text || "").trim();
  if (text) {
    await service.from("live_subtitle_segments").insert({ session_id: sessionId, teacher_id: userData.user.id, text, language: language || null });
  }
  return json({ text });
});
