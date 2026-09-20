// ================================================================
// duvi-chat — DUVI, the in-app AI assistant for Duvela Web.
//
// Streams a Claude reply (SSE) to the DUVI chat panel. The model answers
// in the user's own language, knows which screen the user is on, and can
// request a UI action by emitting an inline token  [[action:NAME]]  that
// the client parses out and runs locally (open a screen, toggle the mic…).
// This keeps the "agentic" layer simple: navigation actions are fire-and-
// forget, so no tool-result round trips are needed.
//
// Request (POST):
//   {
//     messages: [{ role: "user"|"assistant", content: string }, ...],
//     context: { app: "public"|"app"|"classroom", view?, role?, lang? },
//     locale:  string           // interface language, e.g. "ru"
//   }
// Response: text/event-stream
//   data: {"delta":"..."}       // streamed text chunks
//   data: {"done":true}         // end of turn
//   data: {"error":"..."}       // failure
// ================================================================

// Provider is auto-selected: Claude when ANTHROPIC_API_KEY is present, otherwise
// OpenAI (already configured for generate-practice). Force one with DUVI_AI_PROVIDER.
const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const anthropicModel = Deno.env.get("DUVI_MODEL") ?? "claude-sonnet-5";
const openAiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
const openAiModel = Deno.env.get("DUVI_OPENAI_MODEL") ?? Deno.env.get("OPENAI_CHAT_MODEL") ?? "gpt-4.1-mini";
const forcedProvider = (Deno.env.get("DUVI_AI_PROVIDER") ?? "").toLowerCase();
const provider = forcedProvider === "openai"
  ? "openai"
  : forcedProvider === "claude" || forcedProvider === "anthropic"
    ? "claude"
    : anthropicApiKey
      ? "claude"
      : "openai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_TURNS = 16; // keep only the last N messages of history
const MAX_CHARS = 4000; // per-message clamp

// Available UI actions per context. The client maps each NAME to a DOM
// element via its own builtInSelectors table, so keep these names in sync
// with duvi-assistant.js.
const ACTIONS: Record<string, { name: string; desc: string }[]> = {
  app: [
    { name: "openHome", desc: "open the Home screen" },
    { name: "openSchedule", desc: "open the learner's Schedule / lessons" },
    { name: "openMessages", desc: "open Messages / chats" },
    { name: "openManagement", desc: "open the teacher/organization Management area" },
    { name: "openLive", desc: "open the Live streaming section" },
    { name: "openProfile", desc: "open the user's Profile to edit it" },
  ],
  classroom: [
    { name: "openParticipants", desc: "open the Participants panel" },
    { name: "openChat", desc: "open the in-class Chat" },
    { name: "openMaterials", desc: "open the lesson Materials" },
    { name: "toggleMic", desc: "turn the microphone on or off" },
    { name: "copyLink", desc: "copy the classroom invite link" },
  ],
  public: [
    { name: "openHome", desc: "go to the main page" },
  ],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// ── Abuse guard: in-memory sliding-window rate limit per client IP. ──────────
// The anon key is public (it ships in the client), so the endpoint is world-
// reachable; this caps how fast one caller can burn the AI budget. Per-instance
// only (edge functions may run several isolates), but enough to stop a loop.
const RL_WINDOW_MS = 60_000;
const RL_MAX = 20; // requests per window per IP
const rlHits = new Map<string, number[]>();

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (rlHits.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  recent.push(now);
  rlHits.set(ip, recent);
  if (rlHits.size > 5000) {
    for (const [k, v] of rlHits) {
      if (!v.some((t) => now - t < RL_WINDOW_MS)) rlHits.delete(k);
    }
  }
  return recent.length > RL_MAX;
}

function buildSystemPrompt(ctx: Record<string, string>, locale: string): string {
  const app = ["public", "app", "classroom"].includes(ctx.app) ? ctx.app : "app";
  const actions = ACTIONS[app] ?? [];
  const place =
    app === "classroom"
      ? "inside a live video classroom (Zoom-based group lesson)"
      : app === "public"
        ? "on the public marketing site (not logged in yet)"
        : "in the main Duvela web app";

  const lines = [
    "You are DUVI, the friendly in-app assistant for Duvela — a platform that connects language learners with teachers, offers courses, live streams and video classrooms.",
    `The user is currently ${place}.`,
    ctx.view ? `The active screen/section is "${ctx.view}".` : "",
    ctx.role ? `The user's role is "${ctx.role}".` : "",
    "",
    "STYLE:",
    `- Always reply in the user's language (interface locale "${locale}"). If the user writes in another language, follow their language.`,
    "- Be warm, concise and practical. Short paragraphs. No markdown headings.",
    "- ANSWER THE USER'S ACTUAL QUESTION FIRST AND DIRECTLY. Read what they asked and respond to exactly that — do not switch to a generic troubleshooting or navigation answer.",
    "- For questions about how Duvela works — features, CEFR levels, Duvela Coins, withdrawals, pricing, courses, live, classrooms — answer from the ABOUT DUVELA facts below.",
    "- Only give troubleshooting or navigation steps when the user actually reports a problem or asks how to find something.",
    "- If you don't know a Duvela-specific detail, say so briefly and suggest the closest next step. Never invent features.",
    "",
    "ABOUT DUVELA (rely only on these facts; never invent features, prices or policies beyond them):",
    "- Duvela runs in a web browser — no download needed. One account works everywhere; a person can be a learner, a teacher, or both.",
    "- Hub (learners): a personalized video feed matched to your CEFR level, live lessons and streams, courses, events, and a practice hub with grammar, listening, writing, reading and review tools (a premium AI Coach adds guided dialogue and corrections). Progress shows as daily goals, XP, streaks, achievements and leaderboards.",
    "- Business (teachers & organizers): publish videos, schedule live streams, create courses and events, keep a public teacher profile, and track income from live, courses, events and gifts.",
    "- CEFR levels A1–C2: you set your level (and can change it later); Duvela organizes content around it.",
    "- Live streams have real-time chat and support Duvela Coin gifts. Group video classrooms are Zoom-based and separate from live streams.",
    "- Duvela Coins (DC): in-app currency for supported gifts and rewards. Teachers can request withdrawals from 100 DC via bank, PayPal or Wise; fees/conversion are not yet published.",
    "- Getting started: 1) set your CEFR level, 2) watch and practice daily, 3) join live lessons and speak with real teachers.",
    "- Pricing: free to start; you pay only for teacher-led offers such as courses, events and some live sessions.",
    "",
    "ACTIONS:",
    "You can trigger a UI action by ending your message with a token on its own, exactly like [[action:NAME]]. The app runs it for you. Use at most one action, only when it clearly helps, and mention what you're doing in words too. Available actions here:",
    ...actions.map((a) => `  [[action:${a.name}]] — ${a.desc}`),
    actions.length === 0 ? "  (none in this context)" : "",
    "If no action fits, just answer normally without any token.",
  ];
  return lines.filter(Boolean).join("\n");
}

function clampMessages(raw: unknown): { role: string; content: string }[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: { role: string; content: string }[] = [];
  for (const m of list) {
    const e = m as Record<string, unknown>;
    const role = e.role === "assistant" ? "assistant" : "user";
    const content = String(e.content ?? "").slice(0, MAX_CHARS).trim();
    if (content) out.push({ role, content });
  }
  // Trim to the last MAX_TURNS and ensure it starts with a user turn.
  const trimmed = out.slice(-MAX_TURNS);
  while (trimmed.length && trimmed[0].role !== "user") trimmed.shift();
  return trimmed;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (rateLimited(clientIp(req))) return json({ error: "Too many requests. Please slow down and try again in a moment." }, 429);
  if (provider === "claude" && !anthropicApiKey) return json({ error: "ANTHROPIC_API_KEY is not set." }, 500);
  if (provider === "openai" && !openAiApiKey) return json({ error: "No AI key configured (need ANTHROPIC_API_KEY or OPENAI_API_KEY)." }, 500);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const locale = String(body.locale ?? "en").toLowerCase().split("-")[0] || "en";
  const ctx = (body.context && typeof body.context === "object")
    ? (body.context as Record<string, string>)
    : {};
  const messages = clampMessages(body.messages);
  if (!messages.length) return json({ error: "No message provided." }, 400);

  const system = buildSystemPrompt(ctx, locale);

  let upstream: Response;
  try {
    if (provider === "claude") {
      upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey.trim(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: anthropicModel.trim() || "claude-sonnet-5",
          max_tokens: 1024,
          system,
          messages,
          stream: true,
        }),
      });
    } else {
      upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiApiKey.trim()}`,
        },
        body: JSON.stringify({
          model: openAiModel.trim() || "gpt-4.1-mini",
          max_tokens: 1024,
          messages: [{ role: "system", content: system }, ...messages],
          stream: true,
        }),
      });
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Upstream request failed." }, 502);
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return json({ error: `${provider} error ${upstream.status}`, detail: detail.slice(0, 500) }, 502);
  }

  // Transform Anthropic's SSE into our minimal {delta}/{done} protocol.
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const send = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const evt of events) {
            const dataLine = evt.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            const payload = dataLine.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              if (provider === "claude") {
                if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                  controller.enqueue(send({ delta: parsed.delta.text }));
                } else if (parsed.type === "message_stop") {
                  controller.enqueue(send({ done: true }));
                } else if (parsed.type === "error") {
                  controller.enqueue(send({ error: parsed.error?.message || "stream error" }));
                }
              } else {
                const piece = parsed.choices?.[0]?.delta?.content;
                if (piece) controller.enqueue(send({ delta: piece }));
                if (parsed.choices?.[0]?.finish_reason) controller.enqueue(send({ done: true }));
              }
            } catch {
              // ignore keep-alives / non-JSON pings
            }
          }
        }
        controller.enqueue(send({ done: true }));
      } catch (e) {
        controller.enqueue(send({ error: e instanceof Error ? e.message : "stream failed" }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...corsHeaders,
    },
  });
});
