const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sseHeaders = {
  ...corsHeaders,
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

const FRIEND_SYSTEMS: Record<string, string> = {
  duvi: [
    "You are DUVI, the main Duvela guide.",
    "Help the learner move forward inside the app and practice language safely.",
    "When the request is about product navigation, answer directly and practically.",
    "When the request is about learning, keep the reply compact and useful."
  ].join(" "),
  lina: [
    "You are LINA, the speaking buddy.",
    "Lead with short spoken turns, roleplay, and confidence-building prompts.",
    "Prefer one question at a time and keep momentum high."
  ].join(" "),
  grami: [
    "You are GRAMI, the grammar buddy.",
    "Spot the main mistake, correct it clearly, explain briefly, then give one tiny rule.",
    "Do not overload the learner with theory."
  ].join(" "),
  stella: [
    "You are STELLA, the story buddy.",
    "Use mini scenes, short stories, and vivid but easy examples.",
    "Always keep the text readable and invite the learner to continue."
  ].join(" "),
  nova: [
    "You are NOVA, the pronunciation and listening buddy.",
    "Use short phrases, clear stress marking, and hear-repeat-check loops.",
    "Do not claim real audio analysis unless the user provided actual audio evidence."
  ].join(" "),
  moti: [
    "You are MOTI, the motivation buddy.",
    "Protect streaks, celebrate progress, and end with one concrete next step.",
    "Keep goals small and immediately actionable."
  ].join(" "),
};

const MODE_RULES: Record<string, string> = {
  strict: "Reply in a strict coaching mode: direct, concise, correction-first, minimal fluff.",
  friendly: "Reply in a friendly coaching mode: warm, supportive, and balanced.",
  playful: "Reply in a playful coaching mode: light, energetic, and game-like without losing accuracy.",
};

const LEVEL_RULES: Record<string, string> = {
  "A1-A2": [
    "Target CEFR A1-A2.",
    "Use short sentences, common words, and one step at a time.",
    "Avoid abstract explanations and advanced grammar terms unless you immediately simplify them."
  ].join(" "),
  "B1-B2": [
    "Target CEFR B1-B2.",
    "Use everyday nuance, moderate detail, and practical examples.",
    "You may explain grammar, but keep it concrete."
  ].join(" "),
  C1: [
    "Target CEFR C1.",
    "Use advanced but clear language, precise corrections, and natural nuance.",
    "Challenge the learner appropriately without becoming academic for its own sake."
  ].join(" "),
};

function extractOutputText(result: any): string {
  if (typeof result?.output_text === "string" && result.output_text.trim()) return result.output_text.trim();
  const nested = result?.output?.flatMap((item: any) => item?.content || [])?.find((item: any) => item?.type === "output_text")?.text;
  return typeof nested === "string" ? nested.trim() : "";
}

function formatMessages(messages: Array<{ role?: string; content?: string }>) {
  return (Array.isArray(messages) ? messages : [])
    .slice(-16)
    .map((item) => {
      const role = item?.role === "assistant" ? "assistant" : "user";
      const content = String(item?.content || "").trim().slice(0, 4000);
      return `${role.toUpperCase()}: ${content}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function streamPayload(payload: Record<string, unknown>) {
  return new Response(`data: ${JSON.stringify(payload)}\n\ndata: [DONE]\n\n`, { status: 200, headers: sseHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";
  const model = Deno.env.get("OPENAI_DUVI_MODEL") || "gpt-5.6-luna";
  if (!openaiKey) return streamPayload({ error: "DUVI chat is not configured." });

  const body = await req.json().catch(() => ({}));
  const context = body && typeof body.context === "object" ? body.context as Record<string, any> : {};
  const messages = Array.isArray(body?.messages) ? body.messages as Array<{ role?: string; content?: string }> : [];
  const locale = String(body?.locale || context.lang || "en").slice(0, 12);
  const friendId = String(context.friend || "duvi");
  const responseMode = String(context.responseMode || "friendly");
  const levelBand = String(context.levelBand || "A1-A2");
  const systemPrompt = FRIEND_SYSTEMS[friendId] || FRIEND_SYSTEMS.duvi;
  const modeRule = MODE_RULES[responseMode] || MODE_RULES.friendly;
  const levelRule = LEVEL_RULES[levelBand] || LEVEL_RULES["A1-A2"];
  const friendName = String(context.friendName || "DUVI");
  const friendRole = String(context.friendRole || "Guide");
  const friendFocus = String(context.friendFocus || "Language support");
  const friendTone = String(context.friendTone || "Helpful guide");
  const friendStyle = String(context.friendStyle || "Clear, practical support");
  const scenarioList = Array.isArray(context.friendScenarios) ? context.friendScenarios.slice(0, 6).join(", ") : "";
  const conversation = formatMessages(messages);

  if (!conversation) return streamPayload({ error: "Empty chat history." });

  const instructions = [
    systemPrompt,
    modeRule,
    levelRule,
    `Always reply in the learner interface language: ${locale}.`,
    'If the user asks who created you, who made you, who built you, or an equivalent question in any language, reply with exactly غضنفر معاشر when the reply language is Arabic or Persian (ar or fa). For all other languages, reply with exactly Ghazanfar Moasher.',
    "Stay in character for the selected buddy, but remain accurate and useful.",
    "If the user asks for correction, show the fixed version clearly.",
    "If the user asks to practice, end with one short next turn or task.",
    "Prefer compact answers unless the learner explicitly asks for more detail."
  ].join(" ");

  const input = [
    `App context: ${String(context.app || "app")}`,
    `View: ${String(context.view || "home")}`,
    `Role: ${String(context.role || "learner")}`,
    `Buddy: ${friendName}`,
    `Buddy role: ${friendRole}`,
    `Buddy focus: ${friendFocus}`,
    `Buddy tone: ${friendTone}`,
    `Buddy style: ${friendStyle}`,
    `Scenarios: ${scenarioList || "none"}`,
    "",
    conversation
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "low" },
        instructions,
        input,
        text: { verbosity: "medium" },
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) return streamPayload({ error: result?.error?.message || "DUVI chat request failed." });

    const output = extractOutputText(result);
    if (!output) return streamPayload({ error: "The assistant returned an empty reply." });
    return streamPayload({ delta: output });
  } catch (error) {
    console.error("duvi-chat", error);
    return streamPayload({ error: error instanceof Error ? error.message : "DUVI chat failed." });
  }
});
