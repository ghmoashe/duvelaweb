import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const url = Deno.env.get("SUPABASE_URL") || "", anon = Deno.env.get("SUPABASE_ANON_KEY") || "", serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const auth = req.headers.get("Authorization") || "";
  if (!url || !anon || !serviceKey || !auth) return json({ error: "Export service is not configured." }, 500);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: "Authentication required." }, 401);
  const body = await req.json().catch(() => ({}));
  const sourceUrl = String(body.sourceUrl || ""), annotation = String(body.annotation || ""), sessionId = String(body.sessionId || ""), pageNumber = Math.max(1, Number(body.page || 1));
  if (!sourceUrl.startsWith("https://") || !annotation.startsWith("data:image/png;base64,") || !sessionId) return json({ error: "Invalid export payload." }, 400);
  const parsedSource = new URL(sourceUrl), allowedHost = new URL(url).host;
  if (parsedSource.host !== allowedHost || !parsedSource.pathname.includes("/storage/v1/object/public/posts/")) return json({ error: "PDF source must be stored in Duvela Storage." }, 400);
  const service = createClient(url, serviceKey);
  const { data: session } = await service.from("live_sessions").select("teacher_id").eq("id", sessionId).maybeSingle();
  if (!session || session.teacher_id !== userData.user.id) return json({ error: "Only the room teacher can export this PDF." }, 403);
  const source = await fetch(sourceUrl);
  if (!source.ok) return json({ error: "Could not download the source PDF." }, 400);
  const pdf = await PDFDocument.load(await source.arrayBuffer());
  const page = pdf.getPages()[Math.min(pdf.getPageCount(), pageNumber) - 1];
  const bytes = Uint8Array.from(atob(annotation.split(",")[1]), (char) => char.charCodeAt(0));
  const image = await pdf.embedPng(bytes);
  page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), opacity: 1 });
  const output = await pdf.save();
  const path = `${userData.user.id}/live-exports/${sessionId}-${Date.now()}.pdf`;
  const uploaded = await service.storage.from("posts").upload(path, output, { contentType: "application/pdf", upsert: false });
  if (uploaded.error) return json({ error: uploaded.error.message }, 400);
  return json({ url: service.storage.from("posts").getPublicUrl(path).data.publicUrl });
});
