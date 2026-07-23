import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const evaluationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    overall: { type: "integer", minimum: 0, maximum: 100 },
    criteria: {
      type: "object",
      additionalProperties: false,
      properties: {
        taskCompletion: { type: "integer", minimum: 0, maximum: 100 },
        communication: { type: "integer", minimum: 0, maximum: 100 },
        grammar: { type: "integer", minimum: 0, maximum: 100 },
        vocabulary: { type: "integer", minimum: 0, maximum: 100 },
        fluency: { type: "integer", minimum: 0, maximum: 100 },
      },
      required: ["taskCompletion", "communication", "grammar", "vocabulary", "fluency"],
    },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" }, maxItems: 3 },
    corrections: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          original: { type: "string" },
          corrected: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["original", "corrected", "explanation"],
      },
    },
    improvedVersion: { type: "string" },
    nextStep: { type: "string" },
  },
  required: ["overall", "criteria", "summary", "strengths", "corrections", "improvedVersion", "nextStep"],
};

async function structuredResponse(openaiKey: string, model: string, instructions: string, input: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      instructions,
      input,
      text: {
        verbosity: "medium",
        format: { type: "json_schema", name: "language_evaluation", strict: true, schema: evaluationSchema },
      },
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || "AI evaluation failed.");
  const outputText = result.output_text ||
    result.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === "output_text")?.text;
  if (!outputText) throw new Error("The AI returned an empty evaluation.");
  return { evaluation: JSON.parse(outputText), model: result.model || model, responseId: result.id || null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";
  const model = Deno.env.get("OPENAI_EVALUATION_MODEL") || "gpt-5.6-luna";
  const authorization = req.headers.get("Authorization") || "";
  if (!supabaseUrl || !anonKey || !openaiKey) return json({ error: "AI evaluation is not configured." }, 503);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: "Authentication required." }, 401);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  if (!["evaluate-writing", "evaluate-speaking"].includes(action)) {
    return json({ error: "Unsupported assistant action." }, 400);
  }
  const answer = String(body.text || body.transcript || "").trim().slice(0, 12_000);
  if (answer.length < 4) return json({ error: "The answer is too short to evaluate." }, 400);

  const language = String(body.language || "de").slice(0, 12);
  const level = String(body.level || "A1").slice(0, 12);
  const nativeLocale = String(body.nativeLocale || "ru-RU").slice(0, 12);
  const prompt = String(body.prompt || body.expected || "").slice(0, 2_000);
  const kind = action === "evaluate-writing" ? "written response" : "spoken transcript";
  const instructions = [
    `You are a supportive CEFR language examiner evaluating a ${kind}.`,
    "Score only evidence present in the learner answer. Never invent errors or achievements.",
    "Use the requested target language for improvedVersion and corrections.",
    `Write explanations, summary and nextStep in the learner interface locale ${nativeLocale}.`,
    "For speaking transcripts, fluency is a cautious transcript-based estimate; do not claim acoustic pronunciation analysis.",
    "Keep feedback specific, kind, actionable, and suitable for a learner.",
  ].join(" ");
  const input = JSON.stringify({ targetLanguage: language, cefrLevel: level, task: prompt, learnerAnswer: answer });

  try {
    return json(await structuredResponse(openaiKey, model, instructions, input));
  } catch (error) {
    console.error("practice-ai-evaluate", error);
    return json({ error: error instanceof Error ? error.message : "AI evaluation failed." }, 502);
  }
});
