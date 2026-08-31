import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * live-restream
 *
 * Mirrors the teacher's Agora LIVE channel to enabled RTMP targets
 * (YouTube, Facebook, TikTok) through Agora Media Push / RTMP converters.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RestreamTarget = {
  id: string;
  platform: "youtube" | "facebook" | "tiktok";
  rtmp_url: string | null;
  stream_key: string | null;
  enabled: boolean;
  converter_id: string | null;
  converter_region: string | null;
};

type RestreamBody = {
  action?: "start" | "stop" | "status";
  channelName?: string;
  hostUid?: number | string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeRtmpTarget(target: RestreamTarget): string {
  const base = String(target.rtmp_url || "").trim().replace(/\/+$/, "");
  const key = String(target.stream_key || "").trim();
  return key ? `${base}/${key}` : base;
}

function isValidRtmpUrl(value: string) {
  return /^rtmps?:\/\/[^\s/$.?#].[^\s]*$/i.test(value);
}

function agoraStatus(payload: Record<string, unknown>) {
  const converter = payload.converter as Record<string, unknown> | undefined;
  return String(
    converter?.status ||
    converter?.state ||
    payload.status ||
    payload.state ||
    "connected"
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "LIVE restream function is not configured." }, 500);
    }

    const authorization = req.headers.get("Authorization") || "";
    if (!authorization) return json({ error: "Authentication required." }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Authentication required." }, 401);

    const body = (await req.json().catch(() => ({}))) as RestreamBody;
    const action = body.action || "status";
    if (action !== "start" && action !== "stop" && action !== "status") {
      return json({ error: "Unsupported LIVE restream action." }, 400);
    }

    const appId = Deno.env.get("AGORA_APP_ID") || "";
    const customerKey = Deno.env.get("AGORA_CUSTOMER_KEY") || "";
    const customerSecret = Deno.env.get("AGORA_CUSTOMER_SECRET") || "";
    const region = (Deno.env.get("AGORA_MEDIA_PUSH_REGION") || "eu").toLowerCase();
    const watermarkUrl = (Deno.env.get("AGORA_MEDIA_PUSH_WATERMARK_URL") || "").trim();
    if (!appId || !customerKey || !customerSecret) {
      return json({ error: "Agora Media Push is not configured." }, 503);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await serviceClient
      .from("live_restream_targets")
      .select("id,platform,rtmp_url,stream_key,enabled,converter_id,converter_region")
      .eq("teacher_id", userData.user.id);
    if (error) return json({ error: error.message }, 400);

    const targets = (data || []) as RestreamTarget[];
    const agoraAuth = "Basic " + btoa(`${customerKey}:${customerSecret}`);
    const results: Record<string, string> = {};

    if (action === "status") {
      for (const target of targets) {
        if (!target.enabled) continue;
        if (!target.converter_id) {
          results[target.platform] = "idle";
          continue;
        }
        try {
          const targetRegion = target.converter_region || region;
          const res = await fetch(
            `https://api.agora.io/${targetRegion}/v1/projects/${appId}/rtmp-converters/${target.converter_id}`,
            { headers: { Authorization: agoraAuth } },
          );
          if (res.status === 404) {
            results[target.platform] = "stopped";
            continue;
          }
          const payload = await res.json().catch(() => ({}));
          results[target.platform] = res.ok ? agoraStatus(payload as Record<string, unknown>) : `error: ${res.status}`;
        } catch (error) {
          results[target.platform] = `error: ${error instanceof Error ? error.message : "network"}`;
        }
      }
      return json({ results });
    }

    if (action === "stop") {
      for (const target of targets) {
        if (!target.converter_id) continue;
        try {
          const targetRegion = target.converter_region || region;
          const res = await fetch(
            `https://api.agora.io/${targetRegion}/v1/projects/${appId}/rtmp-converters/${target.converter_id}`,
            { method: "DELETE", headers: { Authorization: agoraAuth } },
          );
          results[target.platform] = res.ok || res.status === 404 ? "stopped" : `error: ${res.status}`;
        } catch (error) {
          results[target.platform] = `error: ${error instanceof Error ? error.message : "network"}`;
        }
        await serviceClient
          .from("live_restream_targets")
          .update({ converter_id: null, converter_region: null, updated_at: new Date().toISOString() })
          .eq("id", target.id);
      }
      return json({ results });
    }

    const channelName = String(body.channelName || "").trim();
    const hostUid = String(body.hostUid || "").trim();
    const hostUidNumber = Number(hostUid);
    if (!channelName || !hostUid || !Number.isFinite(hostUidNumber)) {
      return json({ error: "channelName and hostUid are required." }, 400);
    }

    for (const target of targets) {
      if (!target.enabled) continue;

      const rtmpUrl = normalizeRtmpTarget(target);
      if (!isValidRtmpUrl(rtmpUrl)) {
        results[target.platform] = "error: invalid RTMP URL";
        continue;
      }

      try {
        const converter: Record<string, unknown> = {
          idleTimeOut: 300,
          name: `duvela-${target.platform}-${channelName}`.slice(0, 64),
          rtmpUrl,
        };

        if (watermarkUrl) {
          const width = 720;
          const height = 1280;
          converter.transcodeOptions = {
            rtcChannel: channelName,
            audioOptions: {
              codecProfile: "LC-AAC",
              sampleRate: 48000,
              bitrate: 48,
              audioChannels: 1,
            },
            videoOptions: {
              canvas: { width, height },
              layout: [{ rtcStreamUid: hostUidNumber, region: { xPos: 0, yPos: 0, zIndex: 1, width, height } }],
              codecProfile: "high",
              fps: 30,
              bitrate: 2000,
              images: [{ url: watermarkUrl, x: width - 190, y: height - 90, width: 170, height: 60, zIndex: 2 }],
            },
          };
        } else {
          converter.rawOptions = { rtcChannel: channelName, rtcStreamUid: hostUidNumber };
        }

        const res = await fetch(`https://api.agora.io/${region}/v1/projects/${appId}/rtmp-converters`, {
          method: "POST",
          headers: { Authorization: agoraAuth, "Content-Type": "application/json" },
          body: JSON.stringify({ converter }),
        });
        const payload = await res.json().catch(() => ({}));
        const converterPayload = (payload.converter || payload) as Record<string, unknown>;
        const converterId = converterPayload?.id ? String(converterPayload.id) : "";

        if (!res.ok || !converterId) {
          const reason = String(
            (payload as Record<string, unknown>).reason ||
            (payload as Record<string, unknown>).message ||
            res.status
          );
          results[target.platform] = `error: ${reason}`;
          continue;
        }

        await serviceClient
          .from("live_restream_targets")
          .update({ converter_id: converterId, converter_region: region, updated_at: new Date().toISOString() })
          .eq("id", target.id);
        results[target.platform] = "started";
      } catch (error) {
        results[target.platform] = `error: ${error instanceof Error ? error.message : "network"}`;
      }
    }

    return json({ results });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
