import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CacheState = "hit" | "miss" | "disabled" | "error";

function response(body: unknown, status = 200, cache: CacheState = "disabled") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=15, stale-while-revalidate=60",
      "x-duvela-cache": cache,
    },
  });
}

function numberParam(url: URL, name: string, fallback: number, min: number, max: number) {
  const value = Number(url.searchParams.get(name) || fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function cacheConfig() {
  const redisUrl = (Deno.env.get("UPSTASH_REDIS_REST_URL") || "").replace(/\/+$/, "");
  const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN") || "";
  return redisUrl && redisToken ? { redisUrl, redisToken } : null;
}

async function redisCommand(command: unknown[]) {
  const config = cacheConfig();
  if (!config) return { ok: false, disabled: true, result: null };
  const result = await fetch(config.redisUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const json = await result.json().catch(() => ({}));
  if (!result.ok || json?.error) throw new Error(String(json?.error || `Redis ${result.status}`));
  return { ok: true, disabled: false, result: json?.result ?? null };
}

async function cacheGet(key: string) {
  const result = await redisCommand(["GET", key]);
  if (result.disabled) return { state: "disabled" as CacheState, value: null };
  if (!result.result) return { state: "miss" as CacheState, value: null };
  return { state: "hit" as CacheState, value: JSON.parse(String(result.result)) };
}

async function cacheSet(key: string, value: unknown, ttl: number) {
  await redisCommand(["SET", key, JSON.stringify(value), "EX", ttl]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return response({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return response({ error: "Public read API is not configured." }, 500);

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "feed";
  const limit = numberParam(url, "limit", 20, 1, 50);
  const offset = numberParam(url, "offset", 0, 0, 1000);
  const id = String(url.searchParams.get("id") || "").trim();

  if (!["feed", "events", "event", "profile"].includes(type)) {
    return response({ error: "Unsupported type." }, 400);
  }
  if ((type === "event" || type === "profile") && !id) {
    return response({ error: "id is required." }, 400);
  }

  const ttlByType: Record<string, number> = {
    feed: Number(Deno.env.get("DUVELA_FEED_CACHE_TTL_SECONDS") || 30),
    events: Number(Deno.env.get("DUVELA_EVENTS_CACHE_TTL_SECONDS") || 120),
    event: Number(Deno.env.get("DUVELA_EVENT_CACHE_TTL_SECONDS") || 120),
    profile: Number(Deno.env.get("DUVELA_PROFILE_CACHE_TTL_SECONDS") || 300),
  };
  const cacheKey = ["public-read-api:v1", type, limit, offset, id].join(":");

  let cacheState: CacheState = "disabled";
  try {
    const cached = await cacheGet(cacheKey);
    cacheState = cached.state;
    if (cached.value) return response(cached.value, 200, "hit");
  } catch (_) {
    cacheState = "error";
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let data: unknown = [];
  let error: { message?: string } | null = null;

  if (type === "feed") {
    const result = await supabase.from("posts")
      .select("id,user_id,media_url,media_type,caption,cover_url,mux_playback_id,mux_thumbnail_url,bunny_video_guid,bunny_thumbnail_url,language_level,shorts_hidden,shorts_visibility,shorts_deleted_at,created_at")
      .in("media_type", ["video", "youtube", "image"])
      .not("media_url", "is", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    data = result.data || [];
    error = result.error;
  } else if (type === "events") {
    const result = await supabase.from("events")
      .select("id,title,description,event_date,event_time,city,country,format,language,is_paid,price_amount,max_participants,image_url,organizer_id,recurrence_group_id")
      .order("event_date", { ascending: true })
      .range(offset, offset + limit - 1);
    data = result.data || [];
    error = result.error;
  } else if (type === "event") {
    const result = await supabase.from("events")
      .select("id,title,description,event_date,event_time,city,country,format,language,is_paid,price_amount,max_participants,image_url,organizer_id,recurrence_group_id")
      .eq("id", id)
      .maybeSingle();
    data = result.data ? [result.data] : [];
    error = result.error;
  } else if (type === "profile") {
    const result = await supabase.from("profiles")
      .select("id,full_name,avatar_url,city,country,bio,is_teacher")
      .eq("id", id)
      .maybeSingle();
    data = result.data ? [result.data] : [];
    error = result.error;
  }

  if (error) return response({ error: error.message || "Read failed." }, 500, cacheState);

  try {
    await cacheSet(cacheKey, data, Math.max(5, Math.floor(ttlByType[type] || 30)));
    if (cacheState === "miss") cacheState = "miss";
  } catch (_) {
    if (cacheState !== "disabled") cacheState = "error";
  }
  return response(data, 200, cacheState);
});
