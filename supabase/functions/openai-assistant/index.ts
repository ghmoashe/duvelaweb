import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const openAiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
const openAiModel = Deno.env.get("OPENAI_MODEL") ?? "gpt-5-mini";
const openAiChatModel =
  Deno.env.get("OPENAI_CHAT_MODEL") ??
  (openAiModel.trim().toLowerCase().startsWith("gpt-5") ? "gpt-4.1-mini" : openAiModel);
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const textEncoder = new TextEncoder();
const OPENAI_RETRY_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);
const OPENAI_MAX_RETRIES = 2;
const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

type JsonRecord = Record<string, unknown>;
type CoachPracticeSummary = {
  strengths: string[];
  focusNext: string[];
  newPhrases: string[];
  homework: string[];
};
type CoachLessonScore = {
  overall: number;
  fluency: number;
  accuracy: number;
  vocabulary: number;
  pronunciation: number;
  goalCompletion: number;
  finalFeedback: string;
};
type ConversationHistoryMessage = {
  role: "assistant" | "user";
  text: string;
};
type CoachFeedback = {
  assistantReply: string;
  quickCorrection: string;
  betterVersion: string;
  nextQuestion: string;
  pronunciationTip: string;
  summary: CoachPracticeSummary | null;
  lessonComplete: boolean;
  score: CoachLessonScore | null;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function sse(eventType: string, payload: unknown) {
  return textEncoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function shouldRetryOpenAiStatus(status: number) {
  return OPENAI_RETRY_STATUSES.has(status);
}

function parseRetryDelayMs(retryAfterHeader: string | null, attemptIndex: number) {
  const retryAfter = retryAfterHeader?.trim() ?? "";
  const asSeconds = Number(retryAfter);
  if (Number.isFinite(asSeconds) && asSeconds > 0) {
    return Math.min(asSeconds * 1000, 5000);
  }

  return Math.min(300 * 2 ** attemptIndex, 2000);
}

async function waitBeforeRetry(delayMs: number, signal?: AbortSignal) {
  if (delayMs <= 0) return;

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, delayMs);

    const handleAbort = () => {
      clearTimeout(timeoutId);
      reject(new DOMException("Aborted", "AbortError"));
    };

    if (signal?.aborted) {
      handleAbort();
      return;
    }

    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

function getOpenAiErrorMessage(status: number, payload: JsonRecord, fallback: string) {
  const message = extractErrorMessage(payload);
  if (message && status < 500 && status !== 429) {
    return message;
  }

  if (status === 429) {
    return "OpenAI rate limit was reached. Please try again in a moment.";
  }

  if (status >= 500) {
    return "OpenAI is temporarily unavailable. Please try again.";
  }

  return message || fallback;
}

async function fetchOpenAiWithRetry(
  url: string,
  init: RequestInit & { signal?: AbortSignal }
) {
  let lastError: unknown = null;

  for (let attemptIndex = 0; attemptIndex < OPENAI_MAX_RETRIES; attemptIndex += 1) {
    try {
      const response = await fetch(url, init);
      if (
        !shouldRetryOpenAiStatus(response.status) ||
        attemptIndex === OPENAI_MAX_RETRIES - 1
      ) {
        return response;
      }

      await waitBeforeRetry(
        parseRetryDelayMs(response.headers.get("retry-after"), attemptIndex),
        init.signal
      );
    } catch (error) {
      if (isAbortError(error) || attemptIndex === OPENAI_MAX_RETRIES - 1) {
        throw error;
      }
      lastError = error;
      await waitBeforeRetry(parseRetryDelayMs(null, attemptIndex), init.signal);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("OpenAI request failed.");
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const accessToken = tokenMatch?.[1]?.trim() ?? "";
  if (!accessToken || !supabaseUrl || !supabaseAnonKey) {
    return {
      user: null,
      error: !accessToken
        ? "Missing or invalid Bearer token."
        : "SUPABASE_URL or SUPABASE_ANON_KEY is missing.",
    };
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    return {
      user: null,
      error: error?.message ?? "No user resolved from access token.",
    };
  }
  return { user: data.user, error: null };
}

function getLanguageName(locale: string) {
  const language = locale.trim().toLowerCase().split(/[-_]/)[0] ?? "";

  switch (language) {
    case "de":
    case "deutsch":
    case "german":
      return "German";
    case "en":
    case "english":
      return "English";
    case "vi":
      return "Vietnamese";
    case "ru":
    case "russian":
      return "Russian";
    case "uk":
      return "Ukrainian";
    case "fa":
    case "farsi":
    case "persian":
      return "Persian";
    case "ar":
      return "Arabic";
    case "sq":
      return "Albanian";
    case "tr":
      return "Turkish";
    case "fr":
      return "French";
    case "es":
      return "Spanish";
    case "it":
      return "Italian";
    case "sign":
      return "Sign Language";
    case "pl":
    case "polish":
    case "polski":
      return "Polish";
    default:
      return "English";
  }
}

function extractResponseText(payload: JsonRecord): string {
  const directOutputText = extractTextValue(payload.output_text);
  if (directOutputText) {
    return directOutputText;
  }

  if (payload.response && typeof payload.response === "object") {
    const nestedText: string = extractResponseText(payload.response as JsonRecord);
    if (nestedText) {
      return nestedText;
    }
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as {
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    };
    if (candidate.type !== "message" || !Array.isArray(candidate.content)) continue;
    for (const contentItem of candidate.content) {
      if (!contentItem) continue;
      const text = extractTextValue((contentItem as JsonRecord).text);
      if (
        ((contentItem as JsonRecord).type === "output_text" ||
          (contentItem as JsonRecord).type === "text") &&
        text
      ) {
        chunks.push(text);
      }
    }
  }
  return chunks.join("\n").trim();
}

function extractMessageTextFromItem(item: unknown) {
  if (!item || typeof item !== "object") {
    return "";
  }

  const record = item as JsonRecord;
  if (record.type !== "message" || !Array.isArray(record.content)) {
    return "";
  }

  const chunks: string[] = [];
  for (const contentItem of record.content) {
    if (!contentItem || typeof contentItem !== "object") continue;
    const part = contentItem as JsonRecord;
    const text = extractTextValue(part.text);
    if ((part.type === "output_text" || part.type === "text") && text) {
      chunks.push(text);
    }
  }

  return chunks.join("\n").trim();
}

function extractContentPartText(part: unknown) {
  if (!part || typeof part !== "object") {
    return "";
  }

  const record = part as JsonRecord;
  const text = extractTextValue(record.text);
  if ((record.type === "output_text" || record.type === "text") && text) {
    return text;
  }

  return "";
}

function extractTextValue(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const chunks = value
      .map((item) => extractTextValue(item))
      .filter(Boolean);
    return chunks.join("\n").trim();
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as JsonRecord;
  if (typeof record.value === "string" && record.value.trim()) {
    return record.value.trim();
  }
  if (typeof record.text === "string" && record.text.trim()) {
    return record.text.trim();
  }

  return "";
}

function extractChatCompletionText(payload: JsonRecord) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const message = (choice as JsonRecord).message;
    if (!message || typeof message !== "object") continue;
    const content = (message as JsonRecord).content;
    const text = extractTextValue(content);
    if (text) {
      return text;
    }
  }
  return "";
}

function extractChatCompletionContent(payload: JsonRecord) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const message = (choice as JsonRecord).message;
    if (!message || typeof message !== "object") continue;
    const content = (message as JsonRecord).content;
    const text = extractTextValue(content);
    if (text) {
      return text;
    }
  }
  return "";
}

function extractChatCompletionStreamDelta(payload: JsonRecord) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const delta = (choice as JsonRecord).delta;
    if (!delta || typeof delta !== "object") continue;
    const content = (delta as JsonRecord).content;
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (!item || typeof item !== "object") return "";
          return extractTextValue((item as JsonRecord).text);
        })
        .filter(Boolean)
        .join("");
    }
  }
  return "";
}

function normalizeCoachList(value: unknown, maxItems = 3) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.replace(/\s+/g, " ").trim() : ""))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeConversationHistory(value: unknown): ConversationHistoryMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as JsonRecord;
      const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : "";
      const text = extractTextValue(record.text);

      if (!role || !text) {
        return null;
      }

      return { role, text };
    })
    .filter((item): item is ConversationHistoryMessage => item !== null)
    .slice(-12);
}

function normalizeScoreValue(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

function parseCoachFeedback(text: string): CoachFeedback | null {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  const withoutFence = normalized
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const payload = JSON.parse(withoutFence) as JsonRecord;
    const summary =
      payload.summary && typeof payload.summary === "object"
        ? (payload.summary as JsonRecord)
        : null;
    const score =
      payload.score && typeof payload.score === "object"
        ? (payload.score as JsonRecord)
        : null;

    return {
      assistantReply: extractTextValue(payload.assistant_reply),
      quickCorrection: extractTextValue(payload.quick_correction),
      betterVersion: extractTextValue(payload.better_version),
      nextQuestion: extractTextValue(payload.next_question),
      pronunciationTip: extractTextValue(payload.pronunciation_tip),
      summary: summary
        ? {
            strengths: normalizeCoachList(summary.strengths),
            focusNext: normalizeCoachList(summary.focus_next),
            newPhrases: normalizeCoachList(summary.new_phrases),
            homework: normalizeCoachList(summary.homework),
          }
        : null,
      lessonComplete: payload.lesson_complete === true,
      score: score
        ? {
            overall: normalizeScoreValue(score.overall),
            fluency: normalizeScoreValue(score.fluency),
            accuracy: normalizeScoreValue(score.accuracy),
            vocabulary: normalizeScoreValue(score.vocabulary),
            pronunciation: normalizeScoreValue(score.pronunciation),
            goalCompletion: normalizeScoreValue(score.goal_completion),
            finalFeedback: extractTextValue(score.final_feedback),
          }
        : null,
    };
  } catch {
    const assistantReply = extractPartialJsonStringField(withoutFence, "assistant_reply");
    const quickCorrection = extractPartialJsonStringField(withoutFence, "quick_correction");
    const betterVersion = extractPartialJsonStringField(withoutFence, "better_version");
    const nextQuestion = extractPartialJsonStringField(withoutFence, "next_question");
    const pronunciationTip = extractPartialJsonStringField(withoutFence, "pronunciation_tip");
    const hasPartialCoachText =
      assistantReply || quickCorrection || betterVersion || nextQuestion || pronunciationTip;

    if (hasPartialCoachText) {
      return {
        assistantReply,
        quickCorrection,
        betterVersion,
        nextQuestion,
        pronunciationTip,
        summary: null,
        lessonComplete: false,
        score: null,
      };
    }

    return {
      assistantReply: normalized.startsWith("{") ? "" : normalized,
      quickCorrection: "",
      betterVersion: "",
      nextQuestion: "",
      pronunciationTip: "",
      summary: null,
      lessonComplete: false,
      score: null,
    };
  }
}

function decodePartialJsonString(rawValue: string) {
  let decoded = "";

  for (let index = 0; index < rawValue.length; index += 1) {
    const char = rawValue[index];
    if (char !== "\\") {
      decoded += char;
      continue;
    }

    const nextChar = rawValue[index + 1];
    if (!nextChar) {
      break;
    }

    switch (nextChar) {
      case '"':
      case "\\":
      case "/":
        decoded += nextChar;
        index += 1;
        break;
      case "b":
        decoded += "\b";
        index += 1;
        break;
      case "f":
        decoded += "\f";
        index += 1;
        break;
      case "n":
        decoded += "\n";
        index += 1;
        break;
      case "r":
        decoded += "\r";
        index += 1;
        break;
      case "t":
        decoded += "\t";
        index += 1;
        break;
      case "u": {
        const hex = rawValue.slice(index + 2, index + 6);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
          return decoded;
        }
        decoded += String.fromCharCode(Number.parseInt(hex, 16));
        index += 5;
        break;
      }
      default:
        decoded += nextChar;
        index += 1;
        break;
    }
  }

  return decoded;
}

function extractPartialJsonStringField(source: string, fieldName: string) {
  const key = `"${fieldName}"`;
  const keyIndex = source.indexOf(key);
  if (keyIndex < 0) {
    return "";
  }

  let index = keyIndex + key.length;
  while (index < source.length && /\s/.test(source[index])) {
    index += 1;
  }
  if (source[index] !== ":") {
    return "";
  }
  index += 1;
  while (index < source.length && /\s/.test(source[index])) {
    index += 1;
  }
  if (source[index] !== '"') {
    return "";
  }
  index += 1;

  let rawValue = "";
  let escaped = false;
  for (; index < source.length; index += 1) {
    const char = source[index];
    if (!escaped && char === '"') {
      break;
    }
    rawValue += char;
    escaped = !escaped && char === "\\";
    if (char !== "\\") {
      escaped = false;
    }
  }

  return decodePartialJsonString(rawValue).replace(/\s+/g, " ").trim();
}

function buildVisiblePartialCoachText(rawContent: string) {
  return joinCoachVisibleParts(
    extractPartialJsonStringField(rawContent, "assistant_reply"),
    extractPartialJsonStringField(rawContent, "next_question")
  );
}

function normalizeCoachVisibleText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function joinCoachVisibleParts(assistantReply: string, nextQuestion: string) {
  const assistant = assistantReply.replace(/\s+/g, " ").trim();
  const next = nextQuestion.replace(/\s+/g, " ").trim();

  if (!assistant) {
    return next;
  }

  if (!next) {
    return assistant;
  }

  const assistantNormalized = normalizeCoachVisibleText(assistant);
  const nextNormalized = normalizeCoachVisibleText(next);

  if (
    assistantNormalized.includes(nextNormalized) ||
    nextNormalized.includes(assistantNormalized)
  ) {
    return assistant.length >= next.length ? assistant : next;
  }

  return `${assistant} ${next}`.trim();
}

function buildCoachVisibleText(
  coach: CoachFeedback | null,
  rawContent: string,
  fallbackText = ""
) {
  const coachText =
    coach && (coach.assistantReply || coach.nextQuestion)
      ? joinCoachVisibleParts(coach.assistantReply, coach.nextQuestion)
      : "";
  if (coachText) {
    return coachText;
  }

  const partialText = buildVisiblePartialCoachText(rawContent);
  if (partialText) {
    return partialText;
  }

  const trimmedFallback = fallbackText.trim();
  if (trimmedFallback.startsWith("{")) {
    return "";
  }

  return trimmedFallback;
}

// Modes where the partner must ask exactly one question per turn: roleplay
// (LINA) and free conversation (Sofia). Both personas say "never stack
// questions", but the model still stacks 2-3 questions, most often on the
// opening turn ("Wie geht es dir heute? Hast du einen guten Tag? Tee oder
// Kaffee?"). These are the modes where dropping extra questions is desired.
const SINGLE_QUESTION_MODES = new Set(["roleplay", "conversation", "examiner"]);

// Some partners restate or stack questions in one reply even with prompt rules
// against it. For single-question modes, deterministically keep the first
// question sentence and drop any later question sentences. Statements are
// always kept; a reply with a single question (or none) is returned untouched.
function collapseRepeatedQuestions(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const parts = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!parts || parts.length < 2) return trimmed;

  let seenQuestion = false;
  let dropped = false;
  const kept: string[] = [];
  for (const raw of parts) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (/\?["'”’)\]]*$/.test(sentence)) {
      if (seenQuestion) {
        dropped = true;
        continue;
      }
      seenQuestion = true;
    }
    kept.push(sentence);
  }

  if (!dropped) return trimmed;
  return kept.join(" ").replace(/\s+/g, " ").trim();
}

function polishSingleQuestionReply(
  practiceMode: string,
  visibleText: string,
  coach: CoachFeedback | null,
): { text: string; coach: CoachFeedback | null } {
  if (!SINGLE_QUESTION_MODES.has(practiceMode.trim().toLowerCase())) {
    return { text: visibleText, coach };
  }

  const text = collapseRepeatedQuestions(visibleText);
  if (!coach) {
    return { text, coach };
  }

  const merged = joinCoachVisibleParts(coach.assistantReply, coach.nextQuestion);
  return {
    text,
    coach: {
      ...coach,
      assistantReply: collapseRepeatedQuestions(merged),
      nextQuestion: "",
    },
  };
}

function extractConversationMessageText(item: unknown) {
  if (!item || typeof item !== "object") {
    return "";
  }

  const record = item as JsonRecord;
  if (record.type !== "message" || record.role !== "assistant") {
    return "";
  }

  const content = Array.isArray(record.content) ? record.content : [];
  const chunks: string[] = [];
  for (const contentItem of content) {
    if (!contentItem || typeof contentItem !== "object") continue;
    const part = contentItem as JsonRecord;
    const text =
      part.type === "output_text" || part.type === "text" || part.type === "input_text"
        ? extractTextValue(part.text)
        : "";
    if (text) {
      chunks.push(text);
    }
  }

  return chunks.join("\n").trim();
}

async function getLatestConversationAssistantText(conversationId: string) {
  const response = await fetchOpenAiWithRetry(
    `https://api.openai.com/v1/conversations/${encodeURIComponent(conversationId)}/items`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${openAiApiKey.trim()}`,
      },
    }
  );

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    throw new Error(getOpenAiErrorMessage(
      response.status,
      payload,
      "OpenAI conversation items request failed."
    ));
  }

  const items = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.items)
      ? payload.items
      : [];

  let latestAssistantText = "";
  for (const item of items) {
    const text = extractConversationMessageText(item);
    if (text) {
      latestAssistantText = text;
    }
  }

  return latestAssistantText.trim();
}

function extractErrorMessage(payload: JsonRecord) {
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  if (payload.error && typeof payload.error === "object") {
    const nestedMessage = (payload.error as { message?: unknown }).message;
    if (typeof nestedMessage === "string" && nestedMessage.trim()) {
      return nestedMessage.trim();
    }
  }
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  return null;
}

function parseStreamEventBlock(block: string) {
  const lines = block.split("\n");
  let eventType = "";
  const dataParts: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataParts.push(line.slice(5).trimStart());
    }
  }

  const rawData = dataParts.join("\n").trim();
  if (!rawData || rawData === "[DONE]") {
    return null;
  }

  let payload: JsonRecord;
  try {
    payload = JSON.parse(rawData) as JsonRecord;
  } catch {
    return null;
  }

  const resolvedEventType =
    eventType || (typeof payload.type === "string" ? payload.type : "");
  if (!resolvedEventType) {
    return null;
  }

  return {
    eventType: resolvedEventType,
    payload,
  };
}

function consumeStreamBuffer(
  rawBuffer: string,
  consumeBlock: (block: string) => void
) {
  let buffer = rawBuffer.replace(/\r\n/g, "\n");
  let separatorIndex = buffer.indexOf("\n\n");
  while (separatorIndex >= 0) {
    const block = buffer.slice(0, separatorIndex).trim();
    buffer = buffer.slice(separatorIndex + 2);
    if (block) {
      consumeBlock(block);
    }
    separatorIndex = buffer.indexOf("\n\n");
  }
  return buffer;
}

function extractResponseMeta(payload: JsonRecord) {
  const response =
    payload.response && typeof payload.response === "object"
      ? (payload.response as JsonRecord)
      : null;
  const candidate = response ?? payload;
  return {
    responseId:
      typeof candidate.id === "string"
        ? candidate.id
        : typeof payload.response_id === "string"
          ? payload.response_id
          : null,
    model: typeof candidate.model === "string" ? candidate.model : null,
    response,
  };
}

function buildLevelInstruction(levelRange: string) {
  const normalizedLevelRange = levelRange.trim().toUpperCase();
  if (!normalizedLevelRange) {
    return "Use simple, learner-friendly language. Keep the answer brief.";
  }

  const exactLevel = normalizeCefrLevel(normalizedLevelRange);
  if (exactLevel) {
    return [
      `Strict CEFR target: ${exactLevel}.`,
      `Every assistant_reply, next_question, correction, example, and explanation must stay at ${exactLevel}; do not use vocabulary or grammar above ${exactLevel}.`,
      buildCefrStyleGuide(exactLevel),
      "Use one very short assistant_reply and exactly one short next_question unless the lesson is complete.",
    ].join(" ");
  }

  if (normalizedLevelRange.includes("-")) {
    return `Keep the reply within CEFR ${normalizedLevelRange}. Use vocabulary and grammar that fit this learner range, avoid jumping above it, and keep the answer brief.`;
  }
  return `Keep the reply within CEFR ${normalizedLevelRange}. Use vocabulary and grammar that fit this level, avoid going above it, and keep the answer brief.`;
}

function normalizeCefrLevel(value: string) {
  const normalized = value.trim().toUpperCase();
  return CEFR_LEVELS.find((level) => normalized === level) ??
    CEFR_LEVELS.find((level) => normalized.includes(level)) ??
    "";
}

function buildCefrStyleGuide(level: (typeof CEFR_LEVELS)[number]) {
  switch (level) {
    case "A1":
      return "A1 style: very common words, present simple, short direct sentences, no idioms, no long clauses.";
    case "A2":
      return "A2 style: common daily vocabulary, short sentences, simple past/future allowed, no complex clauses.";
    case "B1":
      return "B1 style: clear everyday language, simple linking words, short explanations, avoid academic or idiomatic phrasing.";
    case "B2":
      return "B2 style: natural but clear language, moderate detail, limited idioms only when explained by context.";
    case "C1":
      return "C1 style: fluent natural language, precise vocabulary, but still concise and useful for practice.";
    case "C2":
      return "C2 style: fully natural advanced language, nuanced but concise.";
    default:
      return "Keep the language concise and learner-friendly.";
  }
}

function buildDifficultyInstruction(difficultyMode: string, difficultyNote: string) {
  const normalizedMode = difficultyMode.trim().toLowerCase();
  const note = difficultyNote.trim();

  if (normalizedMode === "supportive") {
    return [
      "Use a supportive difficulty mode inside the selected CEFR range.",
      "Stay near the lower edge of the range, use shorter questions, more predictable follow-ups, and gentle scaffolding.",
      note,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (normalizedMode === "stretch") {
    return [
      "Use a stretch difficulty mode inside the selected CEFR range.",
      "Stay inside the CEFR range but move toward the upper edge with richer vocabulary, less scaffolding, and slightly more open follow-up questions.",
      note,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    "Use a balanced difficulty mode inside the selected CEFR range.",
    "Stay around the middle of the range with natural pacing and normal support.",
    note,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildNativeHelpInstruction(nativeHelp: boolean, nativeLocale: string, locale: string) {
  if (!nativeHelp || !nativeLocale.trim()) {
    return [
      "Do not switch away from the selected learning language unless the user explicitly requests it.",
      "If the learner asks what a word or sentence means, answer the meaning briefly, then continue in the selected learning language.",
    ].join(" ");
  }
  return [
    "Keep assistant_reply, next_question, corrections, and examples in the selected learning language.",
    `When the learner asks the meaning of a word or phrase (for example: "what does X mean?", "meaning of X", "was bedeutet X?", "что значит X?", "X ne demek?"), answer with a very short meaning in ${getLanguageName(nativeLocale)} or simple ${getLanguageName(locale)}.`,
    "Do not refuse meaning questions by saying only 'speak the learning language'.",
    "Do not turn this into a full translation lesson; give only the needed meaning.",
    "After the short meaning, immediately continue with one short sentence or question in the selected learning language.",
    "Never turn the whole conversation into the native language.",
  ].join(" ");
}

function buildPracticeModeInstruction(practiceMode: string, practiceTopic: string) {
  const normalizedMode = practiceMode.trim().toLowerCase();
  const normalizedTopic = practiceTopic.trim();

  const topicInstruction = normalizedTopic
    ? `Focus the session on this scenario or topic: ${normalizedTopic}.`
    : "If no topic is given, choose a simple real-life topic that matches the learner level.";

  switch (normalizedMode) {
    case "grammar":
      return [
        "Run the session as a grammar-focused speaking tutor.",
        topicInstruction,
        "Give short, targeted grammar practice one step at a time (word order, articles, cases, verb forms, tenses, prepositions).",
        "When the learner answers, correct their grammar first, briefly explain the rule in one line, then give the next short grammar task.",
        "Keep it interactive and encouraging, and focus on one grammar point at a time.",
      ].join(" ");
    case "pronunciation":
      return [
        "Run the session as a pronunciation-focused AI tutor conversation in the selected learning language.",
        topicInstruction,
        "Keep a real learner-level conversation going while coaching pronunciation, stress, rhythm, and one important language issue at a time.",
        "Let the learner's latest message choose the conversation direction. If they greet you, ask a simple personal follow-up. If they answer a question, respond to the meaning and ask a new short follow-up.",
        "Do not force a fixed practice sentence after the learner has already said a different clear sentence in the learning language.",
        "Treat the learner's utterance as language-practice material first, not as a normal request to solve.",
        "If the learner says an information question with grammar mistakes, correct the question and use the corrected question as the repeat phrase before giving any real-world answer.",
        "If the learner's latest utterance is clear enough, do not ask them to repeat the same phrase again. Acknowledge it briefly, give one tiny pronunciation note only if useful, then move to a new short phrase or a different sound.",
        "Only ask the learner to say the same phrase again when there is a concrete pronunciation, grammar, or clarity problem to fix.",
        "If the learner says a different but clear phrase than the suggested prompt, accept it as valid practice and coach that phrase before moving forward.",
        "Keep any real-world answer to one short clause unless the learner explicitly asks for a full explanation.",
        // A German tester saw NOVA glue its own coaching description into the
        // repeat sentence: `Sprich diesen Satz: "Ich möchte ... verbessern.
        // Ich sage dir, was gut klingt ..."`. The learner then tried to repeat
        // the coaching sentence too. Keep the practice phrase clean and alone.
        "When you ask the learner to repeat a phrase, put ONLY the single short phrase to repeat inside the quotation marks — one natural sentence in the learning language, nothing else.",
        "Never put your own coaching descriptions, instructions, or explanations (for example 'I will tell you what sounds good') inside the quoted repeat phrase. Those belong in assistant_reply outside the quotes, not in the phrase to say.",
        "Write the practice phrase in the learning language's correct native spelling with real diacritics (German ä ö ü ß, never ae oe ue ss). A wrong-spelled practice phrase teaches wrong pronunciation.",
        "Focus on one phrase or sound at a time, give short pronunciation tips, and end with either a new short practice phrase or a repeat request only when correction is needed.",
      ].join(" ");
    case "interview":
      return [
        "Run the session as job interview and CV speaking practice.",
        topicInstruction,
        "Ask realistic interview questions, help the learner sound clear and professional, and correct one important answer at a time.",
      ].join(" ");
    case "examiner":
      // Persona + exam realism. The turn structure (one question per turn, and
      // the final wrap-up + score) is driven by buildLessonFlowInstruction,
      // which runs for this non-conversation mode — do not duplicate or
      // contradict its turn/score mechanics here.
      return [
        "Run the session as a realistic formal mock oral exam (Goethe / telc / ÖSD / DTZ style) in the learning language.",
        topicInstruction,
        "Stay in the examiner role: polite and neutral, never chatty, playful, or a friend.",
        "Run it part by part in order. When a new part begins, first give the learner the concrete task and any material for that part (e.g. the exact topic to present, the situation to plan together, or a picture described in words) before asking them to speak.",
        "Only when the task text above for the CURRENT part literally contains the word 'Stichwortkarte' followed by its own list of keywords: your very first message for that part must welcome the learner to the exam and then invite them to speak about exactly those keywords, in the order given there, as ONE statement with no question mark (for instance 'Bitte erzählen Sie mir etwas zu diesen Punkten: <the keywords from that list>.'). Copy the keywords from that list verbatim — never invent, add, or reuse a different keyword list for a part whose task text has no 'Stichwortkarte'. Do not phrase it as separate questions (never 'Wie heißen Sie? Wie alt sind Sie? ...') — only one question mark is kept per reply, so a list phrased as questions would lose every keyword after the first.",
        "If the current part's task has NO 'Stichwortkarte' in its text (most parts, including any 'gemeinsam planen', presentation, or discussion task), do not mention Name/Alter/Land/Wohnort/Sprachen/Beruf/Hobby or any other keyword card at all — open instead with the exact scenario or topic described in that part's task text.",
        "After the learner's answer in a 'Stichwortkarte' part, check silently which of its keywords they actually covered. If any were skipped, your one follow-up question must ask specifically about the missing keyword(s) by name before moving to the next part; if they covered all of them, your follow-up may instead ask for one more detail.",
        "Choose specific, realistic topics and vary them every session — never reuse the same example twice.",
        "After the learner answers within a part, ask ONE realistic follow-up question that a real examiner would ask (for a detail, a reason, an example, or the other side of the argument) before moving to the next part.",
        "Give the learner room to answer fully; keep your own turns short — a brief neutral acknowledgement, then the next single question.",
        "Do not interrupt to correct small mistakes; only correct when a mistake blocks understanding, and otherwise save issues for the final assessment.",
        "Grade strictly against the exact CEFR level of this exam. The final assessment must be honest — never inflate the score to be nice. For a part with a keyword card, factor into that part's score and feedback whether every keyword was actually addressed by the end of the part.",
      ].join(" ");
    case "roleplay":
      return [
        "Run the session as a role-play speaking lesson.",
        topicInstruction,
        "Stay inside the scenario and keep the interaction realistic.",
        "Act as the real person in that place: clerk, doctor, Jobcenter advisor, interviewer, barista, or shop assistant.",
        "Do not describe the role-play from outside. Speak directly as the role.",
        "Ask for missing information, react to the learner's answer, and guide the learner toward finishing the task.",
        "Do not repeat the opening line after the learner has answered.",
        // A German tester saw LINA the barista ask the same "Möchten Sie Zucker
        // oder Milch?" on three turns in a row and stack two questions per turn.
        // In a real counter conversation each question is asked once, then the
        // scene moves forward.
        "Your reply must contain exactly one question mark. Ask one thing, once, and stop.",
        "Never restate the same question with different words in the same reply. For example, do NOT write 'Möchten Sie einen kleinen oder großen Kaffee? Welche Größe möchten Sie? Klein oder groß?' — that is one question asked three times. Ask 'Möchten Sie einen kleinen oder großen Kaffee?' and nothing more.",
        "Put your whole spoken turn, including that one question, in assistant_reply and leave next_question completely empty. Never place any question in next_question in this mode.",
        "Do not ask a question you already asked earlier in this scene. If the learner has not answered it yet, either rephrase it once or move the scene forward with the next realistic step instead of repeating it.",
        "After the learner answers, advance the task (take the order, give the price, hand over the item, ask the next new detail) rather than looping back to a question already covered.",
        // Register consistency: an Arabic tester caught LINA jumping between
        // du and Sie in the same conversation ("Kann ich dir helfen" then
        // "Haben Sie …"). Pick a register from the setting and hold it.
        "Pick one politeness register that fits the scenario (formal Sie / usted / vous / lei for a clerk, doctor, Jobcenter, interviewer, formal shop; informal du / tú / tu for a friend, sibling, casual cafe) and hold it for every reply in this session. Never switch between the two mid-conversation, even inside a single message.",
      ].join(" ");
    case "topic":
      return [
        "Run the session as guided topic-based speaking practice.",
        topicInstruction,
        "Ask questions that help the learner explain opinions, preferences, or experiences.",
      ].join(" ");
    case "conversation":
      return [
        "This is a free conversation, not a lesson, quiz, or role-play.",
        normalizedTopic && normalizedTopic !== "a warm free conversation between friends"
          ? topicInstruction
          : "Let the learner's last message choose the topic. If they have not spoken yet, ask one easy personal question (day, mood, plans, food, home).",
        "React first: show you heard them in one short clause.",
        "Then ask exactly one easy follow-up. Never stack questions.",
        "If they make a language mistake, recast the idea in a natural sentence. Do not name the grammar rule unless they ask what was wrong.",
        "If they answer with one word, offer a tiny choice they can copy (tea or coffee, home or out).",
        "Put the whole spoken turn in assistant_reply. Leave next_question empty when the question is already in assistant_reply.",
        "Leave pronunciation_tip empty. Use quick_correction only for a one-line recast, never a lecture.",
      ].join(" ");
    case "daily":
    default:
      return [
        "Run the session as everyday speaking practice.",
        topicInstruction,
        "Prefer natural daily-life topics, small talk, plans, routines, shopping, travel, or social situations.",
      ].join(" ");
  }
}

function buildPartnerInstruction(partnerName: string, partnerPersona: string, partnerRole: string) {
  const name = partnerName.trim();
  if (!name) {
    return "";
  }

  const persona = partnerPersona.trim();
  const role = partnerRole.trim().toLowerCase();
  const fallbackPersona =
    role === "conversation"
      ? `Stay in character as ${name}. Your only job is free conversation: chat naturally about any topic the learner brings up.`
      : `Stay in character as ${name} for this practice session.`;

  return [
    `You are ${name}, a Duvela AI practice partner with one fixed role.`,
    persona || fallbackPersona,
    "Stay in this character for the whole session. Do not switch into another partner's job.",
    role === "conversation"
      ? "Do not run grammar drills, pronunciation repeats, or scripted role-play scenes unless the learner wants to talk about those as conversation topics."
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildRecentQuestionInstruction(recentAssistantQuestions: string[]) {
  const questions = recentAssistantQuestions
    .map((question) => question.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(-8);

  if (!questions.length) {
    return "Avoid repeating the same question pattern from the current conversation.";
  }

  return [
    "Do not repeat these recent assistant questions or ask the same thing with only small wording changes:",
    questions.map((question, index) => `${index + 1}. ${question}`).join(" "),
    "Ask a new follow-up based on the learner's latest answer.",
  ].join(" ");
}

function buildMemoryInstruction(memoryHints: string[]) {
  const hints = memoryHints
    .map((hint) => hint.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(-10);

  if (!hints.length) {
    return "No long-term learner memory is available yet.";
  }

  return [
    "Use this learner memory quietly to personalize the next reply. Do not list it unless the learner asks:",
    hints.map((hint, index) => `${index + 1}. ${hint}`).join(" "),
  ].join(" ");
}

function buildLessonFlowInstruction(input: {
  lessonTemplate: string;
  lessonGoal: string;
  lessonTurnIndex: number;
  lessonTurnTarget: number;
}) {
  const template = input.lessonTemplate.trim();
  const goal = input.lessonGoal.trim();
  const turnTarget = Math.max(1, input.lessonTurnTarget);
  const turnIndex = Math.max(0, input.lessonTurnIndex);

  if (!template && !goal && turnIndex === 0 && turnTarget === 0) {
    return "";
  }

  const lessonIdentity = template
    ? `You are running a structured lesson called "${template}".`
    : "You are running a structured speaking lesson.";
  const goalInstruction = goal
    ? `The lesson goal is: ${goal}.`
    : "The lesson goal is to keep the learner speaking confidently in a realistic scenario.";

  if (turnIndex <= 0) {
    return [
      lessonIdentity,
      goalInstruction,
      `This is the lesson kickoff before learner turn 1 of ${turnTarget}.`,
      "In assistant_reply, set the scene in one or two short sentences.",
      "Put the first learner prompt in next_question.",
      "Leave quick_correction, better_version, pronunciation_tip, and score empty at kickoff.",
      "Set lesson_complete to false at kickoff.",
    ].join(" ");
  }

  if (turnIndex >= turnTarget) {
    return [
      lessonIdentity,
      goalInstruction,
      `This learner has just completed turn ${turnIndex} of ${turnTarget}, which is the final turn. The session is now OVER.`,
      "This is a RESULT turn, not a question turn. Do NOT ask any question. next_question MUST be an empty string.",
      "Use assistant_reply for a brief wrap-up (one or two sentences).",
      "You MUST set lesson_complete to true on this turn.",
      "You MUST return a non-null score object this turn — it is required, never null here. Fill every field: overall, fluency, accuracy, vocabulary, pronunciation, goal_completion (integers 0-100), and final_feedback (one or two sentences).",
      "The score must be fair for the selected CEFR level, not native-speaker standards, and honest — do not inflate it.",
    ].join(" ");
  }

  return [
    lessonIdentity,
    goalInstruction,
    `The learner has completed ${turnIndex} of ${turnTarget} lesson turns.`,
    "Continue the lesson naturally and ask exactly one short next question.",
    "Set lesson_complete to false and leave score empty until the final learner turn.",
  ].join(" ");
}

function buildInstructions(
  locale: string,
  levelRange: string,
  practiceMode: string,
  practiceTopic: string,
  lessonTemplate: string,
  lessonGoal: string,
  lessonTurnIndex: number,
  lessonTurnTarget: number,
  difficultyMode: string,
  difficultyNote: string,
  nativeHelp: boolean,
  nativeLocale: string,
  memoryHints: string[],
  recentAssistantQuestions: string[],
  partnerName = "",
  partnerPersona = "",
  partnerRole = ""
) {
  const isConversation =
    practiceMode.trim().toLowerCase() === "conversation" ||
    partnerRole.trim().toLowerCase() === "conversation";

  return [
    isConversation
      ? `You are ${partnerName.trim() || "Sofia"}, a Duvela conversation partner. Talk with the learner as a friend, not as a coach running a lesson.`
      : "You are the Duvela AI Practice speaking coach.",
    isConversation
      ? ""
      : "Your main job is to run a spoken practice lesson, not to act like a generic chatbot.",
    buildPartnerInstruction(partnerName, partnerPersona, partnerRole),
    `The selected learning language is ${getLanguageName(locale)}.`,
    locale.trim().toLowerCase().split(/[-_]/)[0] === "sign"
      ? "For Sign Language, answer in concise written English while teaching signs through handshape, location, movement, palm orientation, facial expression, and usage context. Do not pretend to output video."
      : "",
    locale.trim().toLowerCase().split(/[-_]/)[0] === "sign"
      ? "Use written English for assistant_reply, next_question, examples, and corrections, because the app is text-based."
      : `Reply in ${getLanguageName(locale)} for the main conversation, assistant_reply, next_question, examples, and corrections.`,
    "Treat the selected conversation language as the active learning language for this chat, even if the app interface or the learner native language is different.",
    // Model output kept dropping to ASCII-safe forms in mid-conversation
    // (Nuesse, faehrt, Desole) which broke pronunciation and made the
    // reply look wrong for the target language. Anchor it to native
    // orthography.
    "Always use the target language's proper diacritics and native letters: German ä ö ü ß (never ae ue oe ss substitutes), French é è ê ç à ù, Spanish ñ á é í ó ú ¿ ¡, Turkish ı İ ş ç ğ, Portuguese ã õ ç, Polish ą ę ł ó ń, Vietnamese ả ộ ơ, Arabic and Persian diacritics where standard. Never write ASCII-only fallbacks.",
    "Never use English as a default bridge language unless English is the selected learning language or the learner native language.",
    "If the learner writes in another language, first detect intent. If they ask meaning or vocabulary help, answer the meaning briefly; otherwise give only minimal help and move them back into the selected learning language.",
    buildLevelInstruction(levelRange),
    buildDifficultyInstruction(difficultyMode, difficultyNote),
    buildPracticeModeInstruction(practiceMode, practiceTopic),
    isConversation
      ? ""
      : buildLessonFlowInstruction({
          lessonTemplate,
          lessonGoal,
          lessonTurnIndex,
          lessonTurnTarget,
        }),
    buildNativeHelpInstruction(nativeHelp, nativeLocale, locale),
    buildMemoryInstruction(memoryHints),
    buildRecentQuestionInstruction(recentAssistantQuestions),
    isConversation
      ? "After the learner speaks: react to the meaning, recast one mistake only if needed, then one new question. Keep the spoken turn short enough to read aloud in about eight seconds."
      : "After the learner speaks, do three things briefly when useful: acknowledge in one short clause, correct or reformulate one key mistake, then continue the conversation.",
    isConversation
      ? "Do not ask the same question twice. Do not praise empty effort. Do not switch into a drill."
      : "Ask one short follow-up question at a time so the learner keeps speaking.",
    "Do not repeat the same question in assistant_reply and next_question. If next_question contains the question, assistant_reply must not contain a question.",
    "If the learner already answered a question, do not ask that same question again. Move the conversation forward.",
    isConversation
      ? "assistant_reply is the whole spoken turn. next_question may be empty. quick_correction is optional and must be one recast, not a rule."
      : "Prioritize fast, concise answers: assistant_reply must be one short sentence, next_question must be one short question, and corrections should focus on one important point.",
    "Keep replies natural for speech and short enough for voice playback.",
    "Return valid JSON only with these keys: assistant_reply, quick_correction, better_version, next_question, pronunciation_tip, summary, lesson_complete, score.",
    "For normal non-final turns, keep summary arrays empty and set score to null; do not write long summaries.",
    "The summary object, when used, must contain arrays named strengths, focus_next, new_phrases, homework.",
    "The score object, when used, must contain overall, fluency, accuracy, vocabulary, pronunciation, goal_completion, final_feedback.",
    "If a field is not needed, return an empty string or an empty array.",
  ].filter(Boolean).join(" ");
}

function buildUnavailableReply(locale: string) {
  switch (locale) {
    case "de":
      return "Entschuldigung, ich hatte gerade ein Problem. Bitte versuche es noch einmal.";
    case "ru":
      return "Извините, у меня сейчас была ошибка. Пожалуйста, попробуйте ещё раз.";
    case "uk":
      return "Вибачте, у мене щойно сталася помилка. Будь ласка, спробуйте ще раз.";
    case "ar":
      return "عذرًا، حدثت مشكلة للتو. من فضلك حاول مرة أخرى.";
    case "fa":
      return "ببخشید، همین الان یک مشکل پیش آمد. لطفاً دوباره تلاش کنید.";
    case "fr":
      return "Desole, j'ai eu un probleme. Merci de reessayer.";
    case "es":
      return "Lo siento, acabo de tener un problema. Intentalo de nuevo.";
    case "it":
      return "Mi dispiace, ho avuto un problema. Per favore riprova.";
    case "pl":
      return "Przepraszam, wystapil problem. Sprobuj jeszcze raz.";
    case "tr":
      return "Uzgunum, az once bir sorun oldu. Lutfen tekrar dene.";
    case "vi":
      return "Xin loi, toi vua gap loi. Hay thu lai mot lan nua.";
    case "sq":
      return "Me fal, sapo pata nje problem. Te lutem provo perseri.";
    case "en":
    default:
      return "Sorry, I had a problem just now. Please try again.";
  }
}

function buildOpenAiRequestBody(input: {
  input: string;
  conversationId: string | null;
  locale: string;
  levelRange: string;
  practiceMode: string;
  practiceTopic: string;
  lessonTemplate: string;
  lessonGoal: string;
  lessonTurnIndex: number;
  lessonTurnTarget: number;
  memoryHints: string[];
  difficultyMode: string;
  difficultyNote: string;
  nativeHelp: boolean;
  nativeLocale: string;
  recentAssistantQuestions: string[];
  partnerName?: string;
  partnerPersona?: string;
  partnerRole?: string;
  stream?: boolean;
}) {
  return {
    model: openAiModel.trim() || "gpt-5-mini",
    input: input.input,
    instructions: buildInstructions(
      input.locale,
      input.levelRange,
      input.practiceMode,
      input.practiceTopic,
      input.lessonTemplate,
      input.lessonGoal,
      input.lessonTurnIndex,
      input.lessonTurnTarget,
      input.difficultyMode,
      input.difficultyNote,
      input.nativeHelp,
      input.nativeLocale,
      input.memoryHints,
      input.recentAssistantQuestions,
      input.partnerName ?? "",
      input.partnerPersona ?? "",
      input.partnerRole ?? ""
    ),
    conversation: input.conversationId ?? undefined,
    max_output_tokens: 320,
    store: true,
    stream: input.stream === true ? true : undefined,
  };
}

async function createOpenAiResponse(input: {
  input: string;
  conversationId: string | null;
  locale: string;
  levelRange: string;
  practiceMode: string;
  practiceTopic: string;
  lessonTemplate: string;
  lessonGoal: string;
  lessonTurnIndex: number;
  lessonTurnTarget: number;
  memoryHints: string[];
  difficultyMode: string;
  difficultyNote: string;
  nativeHelp: boolean;
  nativeLocale: string;
  recentAssistantQuestions: string[];
  partnerName?: string;
  partnerPersona?: string;
  partnerRole?: string;
  signal?: AbortSignal;
  stream?: boolean;
}) {
  return fetchOpenAiWithRetry("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey.trim()}`,
    },
    body: JSON.stringify(buildOpenAiRequestBody(input)),
    signal: input.signal,
  });
}

async function createConversation(input: {
  userId: string;
  locale: string;
}) {
  const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey.trim()}`,
    },
    body: JSON.stringify({
      metadata: {
        topic: "duvela-voice",
        user_id: input.userId,
        locale: input.locale,
      },
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    throw new Error(
      getOpenAiErrorMessage(response.status, payload, "OpenAI conversation creation failed.")
    );
  }

  const conversationId = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!conversationId) {
    throw new Error("OpenAI conversation creation returned no id.");
  }

  return conversationId;
}

async function createOpenAiChatCompletion(input: {
  history: ConversationHistoryMessage[];
  input: string;
  locale: string;
  levelRange: string;
  practiceMode: string;
  practiceTopic: string;
  lessonTemplate: string;
  lessonGoal: string;
  lessonTurnIndex: number;
  lessonTurnTarget: number;
  memoryHints: string[];
  difficultyMode: string;
  difficultyNote: string;
  nativeHelp: boolean;
  nativeLocale: string;
  recentAssistantQuestions: string[];
  partnerName?: string;
  partnerPersona?: string;
  partnerRole?: string;
}) {
  return fetchOpenAiWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey.trim()}`,
    },
    body: JSON.stringify({
      model: openAiChatModel.trim() || "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: buildInstructions(
            input.locale,
            input.levelRange,
            input.practiceMode,
            input.practiceTopic,
            input.lessonTemplate,
            input.lessonGoal,
            input.lessonTurnIndex,
            input.lessonTurnTarget,
            input.difficultyMode,
            input.difficultyNote,
            input.nativeHelp,
            input.nativeLocale,
            input.memoryHints,
            input.recentAssistantQuestions,
            input.partnerName ?? "",
            input.partnerPersona ?? "",
            input.partnerRole ?? ""
          ),
        },
        ...input.history.map((message) => ({
          role: message.role,
          content: message.text,
        })),
        {
          role: "user",
          content: input.input,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.35,
      max_tokens: 320,
    }),
  });
}

async function createOpenAiChatCompletionStream(input: {
  history: ConversationHistoryMessage[];
  input: string;
  locale: string;
  levelRange: string;
  practiceMode: string;
  practiceTopic: string;
  lessonTemplate: string;
  lessonGoal: string;
  lessonTurnIndex: number;
  lessonTurnTarget: number;
  memoryHints: string[];
  difficultyMode: string;
  difficultyNote: string;
  nativeHelp: boolean;
  nativeLocale: string;
  recentAssistantQuestions: string[];
  partnerName?: string;
  partnerPersona?: string;
  partnerRole?: string;
  signal?: AbortSignal;
}) {
  return fetchOpenAiWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey.trim()}`,
    },
    body: JSON.stringify({
      model: openAiChatModel.trim() || "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: buildInstructions(
            input.locale,
            input.levelRange,
            input.practiceMode,
            input.practiceTopic,
            input.lessonTemplate,
            input.lessonGoal,
            input.lessonTurnIndex,
            input.lessonTurnTarget,
            input.difficultyMode,
            input.difficultyNote,
            input.nativeHelp,
            input.nativeLocale,
            input.memoryHints,
            input.recentAssistantQuestions,
            input.partnerName ?? "",
            input.partnerPersona ?? "",
            input.partnerRole ?? ""
          ),
        },
        ...input.history.map((message) => ({
          role: message.role,
          content: message.text,
        })),
        {
          role: "user",
          content: input.input,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.35,
      max_tokens: 320,
      stream: true,
    }),
    signal: input.signal,
  });
}

function clampScore(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function fallbackSpeakingScore(spokenText: string) {
  const words = spokenText.trim().split(/\s+/).filter(Boolean).length;
  if (words >= 80) return 78;
  if (words >= 45) return 70;
  if (words >= 25) return 60;
  if (words >= 12) return 45;
  if (words >= 4) return 28;
  return 0;
}

function readSpeakingScore(payload: JsonRecord, spokenText: string) {
  const score = payload.score;
  if (typeof score === "object" && score !== null) {
    const scoreRecord = score as JsonRecord;
    for (const key of ["overall", "total", "percent", "percentage"]) {
      const parsed = clampScore(scoreRecord[key], Number.NaN);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  for (const key of ["score", "overall", "total", "percent", "percentage"]) {
    const parsed = clampScore(payload[key], Number.NaN);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallbackSpeakingScore(spokenText);
}

function normalizeStringList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 4);

  return items.length > 0 ? items : fallback;
}

function parseDrawingEvaluation(text: string) {
  let payload: JsonRecord = {};
  try {
    payload = JSON.parse(text) as JsonRecord;
  } catch {
    payload = {};
  }

  const accuracy = payload.accuracy && typeof payload.accuracy === "object"
    ? payload.accuracy as JsonRecord
    : {};

  return {
    score: clampScore(payload.score, 0),
    verdict:
      typeof payload.verdict === "string" && payload.verdict.trim()
        ? payload.verdict.trim()
        : "The drawing was reviewed. Upload a clearer photo for a stricter result.",
    matched: normalizeStringList(payload.matched, ["The uploaded drawing is visible."]),
    mistakes: normalizeStringList(payload.mistakes, ["The main shape needs closer comparison with the reference."]),
    training: normalizeStringList(payload.training, ["Practice copying the big shape before adding details."]),
    accuracy: {
      composition: clampScore(accuracy.composition, 0),
      proportion: clampScore(accuracy.proportion, 0),
      lineQuality: clampScore(accuracy.lineQuality, 0),
      shading: clampScore(accuracy.shading, 0),
    },
  };
}

function parseSignEvaluation(text: string) {
  let payload: JsonRecord = {};
  try {
    payload = JSON.parse(text) as JsonRecord;
  } catch {
    payload = {};
  }

  const accuracy = payload.accuracy && typeof payload.accuracy === "object"
    ? payload.accuracy as JsonRecord
    : {};

  return {
    score: clampScore(payload.score, 0),
    verdict:
      typeof payload.verdict === "string" && payload.verdict.trim()
        ? payload.verdict.trim()
        : "The sign photo was reviewed. Use a brighter, full upper-body frame for a stricter result.",
    matched: normalizeStringList(payload.matched, ["The signing pose is visible."]),
    mistakes: normalizeStringList(payload.mistakes, ["Make the handshape and signing space clearer."]),
    training: normalizeStringList(payload.training, ["Repeat the sign slowly, then hold the final position for the camera."]),
    accuracy: {
      handshape: clampScore(accuracy.handshape, 0),
      movement: clampScore(accuracy.movement, 0),
      position: clampScore(accuracy.position, 0),
      speed: clampScore(accuracy.speed, 0),
    },
  };
}

function parseGermanReadingEvaluation(text: string, fallbackCorrect: boolean, fallbackExplanation: string) {
  let payload: JsonRecord = {};
  try {
    payload = JSON.parse(text) as JsonRecord;
  } catch {
    payload = {};
  }

  const correct = typeof payload.correct === "boolean" ? payload.correct : fallbackCorrect;

  return {
    correct,
    score: clampScore(payload.score, correct ? 100 : 0),
    verdict:
      typeof payload.verdict === "string" && payload.verdict.trim()
        ? payload.verdict.trim()
        : correct
          ? "Die Antwort passt zum Text."
          : "Die Antwort passt nicht genau zum Text.",
    evidence:
      typeof payload.evidence === "string" && payload.evidence.trim()
        ? payload.evidence.trim()
        : fallbackExplanation,
    nextTip:
      typeof payload.next_tip === "string" && payload.next_tip.trim()
        ? payload.next_tip.trim()
        : typeof payload.nextTip === "string" && payload.nextTip.trim()
          ? payload.nextTip.trim()
      : "Lies zuerst Namen, Zeit, Ort und Handlung. Danach prüfst du jede Antwort am Text.",
  };
}

function parseGermanReadingVoiceEvaluation(text: string, spokenText: string) {
  let payload: JsonRecord = {};
  try {
    payload = JSON.parse(text) as JsonRecord;
  } catch {
    payload = {};
  }

  return {
    score: clampScore(payload.score, 0),
    transcript:
      typeof payload.transcript === "string" && payload.transcript.trim()
        ? payload.transcript.trim()
        : spokenText,
    verdict:
      typeof payload.verdict === "string" && payload.verdict.trim()
        ? payload.verdict.trim()
        : "AI hat dein Lesen gehört. Lies langsam und sprich Satzenden klar aus.",
    matchedText:
      typeof payload.matched_text === "string" && payload.matched_text.trim()
        ? payload.matched_text.trim()
        : typeof payload.matchedText === "string" && payload.matchedText.trim()
          ? payload.matchedText.trim()
          : "Ein Teil des Textes wurde erkannt.",
    missedText:
      typeof payload.missed_text === "string" && payload.missed_text.trim()
        ? payload.missed_text.trim()
        : typeof payload.missedText === "string" && payload.missedText.trim()
          ? payload.missedText.trim()
          : "Nicht alle Wörter wurden sicher erkannt.",
    nextTip:
      typeof payload.next_tip === "string" && payload.next_tip.trim()
        ? payload.next_tip.trim()
        : typeof payload.nextTip === "string" && payload.nextTip.trim()
          ? payload.nextTip.trim()
      : "Übe zuerst einen Satz, dann lies den ganzen Text mit kurzen Pausen nach Punkten.",
  };
}

function parseGermanSpeakingEvaluation(text: string, spokenText: string) {
  let payload: JsonRecord = {};
  try {
    payload = JSON.parse(text) as JsonRecord;
  } catch {
    payload = {};
  }

  return {
    score: readSpeakingScore(payload, spokenText),
    transcript:
      typeof payload.transcript === "string" && payload.transcript.trim()
        ? payload.transcript.trim()
        : spokenText,
    verdict:
      typeof payload.verdict === "string" && payload.verdict.trim()
        ? payload.verdict.trim()
        : "AI hat deine Antwort gehört. Antworte mit kurzen, klaren Sätzen.",
    correction:
      typeof payload.correction === "string" && payload.correction.trim()
        ? payload.correction.trim()
        : "Achte auf Verbposition, Artikel und eine vollständige Antwort.",
    betterAnswer:
      typeof payload.better_answer === "string" && payload.better_answer.trim()
        ? payload.better_answer.trim()
        : typeof payload.betterAnswer === "string" && payload.betterAnswer.trim()
          ? payload.betterAnswer.trim()
          : "Das ist mein Beispiel. Ich spreche langsam und deutlich.",
    pronunciationTip:
      typeof payload.pronunciation_tip === "string" && payload.pronunciation_tip.trim()
        ? payload.pronunciation_tip.trim()
        : typeof payload.pronunciationTip === "string" && payload.pronunciationTip.trim()
          ? payload.pronunciationTip.trim()
          : "Sprich langsam, mache kurze Pausen und betone das Verb.",
    nextQuestion:
      typeof payload.next_question === "string" && payload.next_question.trim()
        ? payload.next_question.trim()
        : typeof payload.nextQuestion === "string" && payload.nextQuestion.trim()
          ? payload.nextQuestion.trim()
          : "Bitte antworten Sie noch einmal mit zwei ganzen Sätzen.",
  };
}

// Dedicated exam scorer for the ELSA examiner. The conversational `respond`
// turn reliably gives a spoken verdict but keeps skipping the nested score
// JSON, so the client calls this once the oral exam ends. A single-purpose
// prompt with response_format json_object returns the structured result every
// time.
async function handleExamEvaluation(input: {
  board: string;
  level: string;
  transcript: string;
  nativeLocale: string;
  locale: string;
}) {
  const transcript = input.transcript.trim();
  if (!transcript) {
    return json(400, { error: "transcript is required." });
  }
  const boardKey = input.board.toLowerCase();
  const boardName =
    boardKey === "telc"
      ? "telc Deutsch"
      : boardKey === "oesd"
        ? "ÖSD"
        : boardKey === "dtz"
          ? "Deutsch-Test für Zuwanderer (DTZ)"
          : "Goethe-Zertifikat";
  const level = input.level.trim().toUpperCase() || "B1";
  const targetName = getLanguageName(input.locale || "de");
  const nativeName = getLanguageName(input.nativeLocale || "en");

  const prompt = [
    `You are a strict, fair ${boardName} ${level} oral examiner.`,
    `Below is the full transcript of a ${targetName} mock oral exam (Sprechen).`,
    "Grade the learner's spoken performance across the whole exam, strictly against the exact CEFR level.",
    `Grade against ${level} exam expectations, not native-speaker standards, but be strict and honest — do not inflate.`,
    "Infer pronunciation only from transcript quality and word choice; do not pretend you heard raw audio.",
    "Scores are integers 0-100: 90-100 clear and complete for the level, 70-89 understandable with small errors, 40-69 partly complete, 0-39 not enough or off task.",
    `Write final_feedback, each improve tip, each part 'feedback' and each mistake 'note' only in ${nativeName}. Keep the mistake 'wrong' and 'correction' snippets in ${targetName}.`,
    `passed is true when the overall performance would pass a real ${boardName} ${level} oral exam (roughly overall >= 60).`,
    "band is the CEFR level the performance actually demonstrates (for example A2, B1, B2).",
    "For 'parts': one object per exam part (Teil) that appears in the transcript, each { label (e.g. 'Teil 1'), score (0-100), feedback (one short sentence) }.",
    "The transcript may start with a bracketed note like '[Hinweis für die Bewertung: Das gezeigte Foto zeigt tatsächlich: ...]' describing what a photo shown to the candidate actually depicted. Use it ONLY to judge whether that Teil's picture-description turn was accurate to the photo — a description that invents things not in it, or misses what is clearly there, should lower that Teil's score and say so in its feedback. Never quote, mention, or reveal the note itself anywhere in your output; the candidate never saw it.",
    "For 'mistakes': up to 5 concrete language mistakes the learner actually made, each { wrong (their phrase), correction (the fixed phrase), note (why, one short clause) }.",
    "Return valid JSON only with keys: overall, fluency, accuracy, vocabulary, pronunciation, goal_completion, passed, band, final_feedback, improve (array of 1-3 short strings), parts (array), mistakes (array).",
    "",
    "Transcript:",
    transcript,
  ].join("\n");

  const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey.trim()}`,
    },
    body: JSON.stringify({
      model: openAiChatModel.trim() || "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Return strict JSON only. Do not wrap it in markdown." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 900,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    return json(response.status, {
      error: getOpenAiErrorMessage(response.status, payload, "Exam evaluation failed."),
    });
  }

  let parsed: JsonRecord = {};
  try {
    parsed = JSON.parse(extractChatCompletionContent(payload)) as JsonRecord;
  } catch {
    parsed = {};
  }

  const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const improve = (Array.isArray(parsed.improve) ? parsed.improve : [])
    .map(str)
    .filter(Boolean)
    .slice(0, 3);
  const parts = (Array.isArray(parsed.parts) ? parsed.parts : [])
    .map((item) => {
      const record = (item && typeof item === "object" ? item : {}) as JsonRecord;
      return {
        label: str(record.label),
        score: normalizeScoreValue(record.score),
        feedback: str(record.feedback),
      };
    })
    .filter((part) => part.label || part.feedback)
    .slice(0, 6);
  const mistakes = (Array.isArray(parsed.mistakes) ? parsed.mistakes : [])
    .map((item) => {
      const record = (item && typeof item === "object" ? item : {}) as JsonRecord;
      return {
        wrong: str(record.wrong),
        correction: str(record.correction),
        note: str(record.note),
      };
    })
    .filter((mistake) => mistake.wrong || mistake.correction)
    .slice(0, 5);
  const normalizedBoard = ["goethe", "telc", "oesd", "dtz"].includes(boardKey) ? boardKey : "goethe";

  return json(200, {
    board: normalizedBoard,
    level,
    score: {
      overall: normalizeScoreValue(parsed.overall),
      fluency: normalizeScoreValue(parsed.fluency),
      accuracy: normalizeScoreValue(parsed.accuracy),
      vocabulary: normalizeScoreValue(parsed.vocabulary),
      pronunciation: normalizeScoreValue(parsed.pronunciation),
      goalCompletion: normalizeScoreValue(parsed.goal_completion ?? parsed.goalCompletion),
    },
    passed: parsed.passed === true,
    band: str(parsed.band) ? str(parsed.band).toUpperCase() : level,
    finalFeedback: str(parsed.final_feedback),
    improve,
    parts,
    mistakes,
  });
}

function examBoardName(board: string) {
  const key = board.toLowerCase();
  if (key === "telc") return "telc Deutsch";
  if (key === "oesd") return "ÖSD";
  if (key === "dtz") return "Deutsch-Test für Zuwanderer (DTZ)";
  return "Goethe-Zertifikat";
}

async function callJsonModel(prompt: string, maxTokens: number): Promise<JsonRecord> {
  const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey.trim()}`,
    },
    body: JSON.stringify({
      model: openAiChatModel.trim() || "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Return strict JSON only. Do not wrap it in markdown." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    throw new Error(getOpenAiErrorMessage(response.status, payload, "Generation failed."));
  }
  try {
    return JSON.parse(extractChatCompletionContent(payload)) as JsonRecord;
  } catch {
    return {};
  }
}

// Generate a reading / listening / writing exam module for the full ELSA exam.
async function handleGenerateExamModule(input: {
  board: string;
  level: string;
  skill: string;
  nativeLocale: string;
}) {
  const boardName = examBoardName(input.board);
  const level = input.level.trim().toUpperCase() || "B1";
  const skill = input.skill.toLowerCase();
  const nativeName = getLanguageName(input.nativeLocale || "en");

  const parseQuestions = (raw: unknown) =>
    (Array.isArray(raw) ? raw : [])
      .map((item) => {
        const record = (item && typeof item === "object" ? item : {}) as JsonRecord;
        const options = (Array.isArray(record.options) ? record.options : [])
          .map((o) => (typeof o === "string" ? o.trim() : ""))
          .filter(Boolean)
          .slice(0, 4);
        return {
          q: typeof record.q === "string" ? record.q.trim() : "",
          options,
          answer: Math.max(0, Math.min(options.length - 1, Number(record.answer) || 0)),
        };
      })
      .filter((question) => question.q && question.options.length >= 2)
      .slice(0, 5);

  try {
    if (skill === "schreiben") {
      const prompt = [
        `You are a ${boardName} ${level} exam author. Create ONE realistic writing task (Schreiben) for this level in German.`,
        "Keep it authentic: a short situation and a clear instruction (e.g. write an email/message, describe, give an opinion).",
        `Return JSON only: { title (short, in ${nativeName}), prompt (the task in German), min_words (integer) }.`,
      ].join("\n");
      const parsed = await callJsonModel(prompt, 400);
      const minWords = Math.max(20, Math.min(300, Number(parsed.min_words) || 40));
      return json(200, {
        skill: "schreiben",
        title: typeof parsed.title === "string" ? parsed.title.trim() : "",
        prompt: typeof parsed.prompt === "string" ? parsed.prompt.trim() : "",
        minWords,
      });
    }

    if (skill === "hoeren") {
      const prompt = [
        `You are a ${boardName} ${level} exam author. Create ONE realistic listening task (Hören) for this level in German.`,
        "Write a natural short spoken text (a monologue or a two-speaker dialogue, label speakers as A: / B:), appropriate length for the level.",
        "Then write 3-4 comprehension multiple-choice questions with 3 options each and the correct index.",
        `Return JSON only: { title (in ${nativeName}), script (the German audio text), questions: [{ q (in German), options (3 German strings), answer (0-based index) }] }.`,
      ].join("\n");
      const parsed = await callJsonModel(prompt, 900);
      return json(200, {
        skill: "hoeren",
        title: typeof parsed.title === "string" ? parsed.title.trim() : "",
        script: typeof parsed.script === "string" ? parsed.script.trim() : "",
        questions: parseQuestions(parsed.questions),
      });
    }

    // default: lesen (reading)
    const prompt = [
      `You are a ${boardName} ${level} exam author. Create ONE realistic reading task (Lesen) for this level in German.`,
      "Write an authentic German text of a length appropriate for the level (A1 very short, C1/C2 longer and more abstract).",
      "Then write 3-4 comprehension multiple-choice questions with 3 options each and the correct index.",
      `Return JSON only: { title (in ${nativeName}), text (the German reading text), questions: [{ q (in German), options (3 German strings), answer (0-based index) }] }.`,
    ].join("\n");
    const parsed = await callJsonModel(prompt, 1100);
    return json(200, {
      skill: "lesen",
      title: typeof parsed.title === "string" ? parsed.title.trim() : "",
      text: typeof parsed.text === "string" ? parsed.text.trim() : "",
      questions: parseQuestions(parsed.questions),
    });
  } catch (error) {
    return json(500, { error: getErrorMessage(error, "Could not generate the exam module.") });
  }
}

// Grade a written answer for the writing (Schreiben) part.
async function handleEvaluateExamWriting(input: {
  board: string;
  level: string;
  prompt: string;
  text: string;
  nativeLocale: string;
}) {
  const text = input.text.trim();
  if (!text) return json(400, { error: "text is required." });
  const boardName = examBoardName(input.board);
  const level = input.level.trim().toUpperCase() || "B1";
  const nativeName = getLanguageName(input.nativeLocale || "en");

  const prompt = [
    `You are a strict, fair ${boardName} ${level} examiner grading a written answer (Schreiben) in German.`,
    `Task: ${input.prompt || "(a writing task at this level)"}`,
    `Learner's text: ${text}`,
    "Grade strictly against the exact CEFR level: content/task completion, coherence, grammar, vocabulary.",
    "Scores are integers 0-100.",
    `Write feedback and each mistake 'note' in ${nativeName}; keep mistake 'wrong'/'correction' snippets in German.`,
    "Return JSON only: { overall, content, grammar, vocabulary (0-100), feedback, mistakes: [{ wrong, correction, note }] (up to 4) }.",
  ].join("\n");

  try {
    const parsed = await callJsonModel(prompt, 700);
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const mistakes = (Array.isArray(parsed.mistakes) ? parsed.mistakes : [])
      .map((item) => {
        const record = (item && typeof item === "object" ? item : {}) as JsonRecord;
        return { wrong: str(record.wrong), correction: str(record.correction), note: str(record.note) };
      })
      .filter((mistake) => mistake.wrong || mistake.correction)
      .slice(0, 4);
    return json(200, {
      score: {
        overall: normalizeScoreValue(parsed.overall),
        content: normalizeScoreValue(parsed.content),
        grammar: normalizeScoreValue(parsed.grammar),
        vocabulary: normalizeScoreValue(parsed.vocabulary),
      },
      feedback: str(parsed.feedback),
      mistakes,
    });
  } catch (error) {
    return json(500, { error: getErrorMessage(error, "Could not grade the writing.") });
  }
}

async function handleDrawingEvaluation(input: {
  imageBase64: string;
  mimeType: string;
  nativeLocale: string;
  referencePrompt: string;
  referenceTitle: string;
}) {
  const safeMimeType = input.mimeType.trim().startsWith("image/")
    ? input.mimeType.trim()
    : "image/jpeg";
  const imageBase64 = input.imageBase64.trim();

  if (!imageBase64) {
    return json(400, { error: "Drawing image is required." });
  }

  const prompt = [
    "You are a strict drawing teacher. Compare the student's uploaded drawing with the reference.",
    `Reference title: ${input.referenceTitle}`,
    `Reference spec: ${input.referencePrompt}`,
    "Evaluate whether the student copied the reference as closely as possible.",
    "Be concrete: mention shape placement, proportions, line quality, missing details, light/shadow.",
    `Write verdict, mistakes, and training advice in ${getLanguageName(input.nativeLocale || "en")}.`,
    "Return valid JSON only with keys: score, verdict, matched, mistakes, training, accuracy.",
    "accuracy must contain composition, proportion, lineQuality, shading as 0-100 numbers.",
  ].join("\n");

  const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey.trim()}`,
    },
    body: JSON.stringify({
      model: openAiChatModel.trim() || "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "Return strict JSON only. Do not wrap it in markdown.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${safeMimeType};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 520,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    return json(response.status, {
      error: getOpenAiErrorMessage(response.status, payload, "Drawing evaluation failed."),
    });
  }

  return json(200, parseDrawingEvaluation(extractChatCompletionContent(payload)));
}

async function handleSignEvaluation(input: {
  imageBase64: string;
  mimeType: string;
  nativeLocale: string;
  referencePrompt: string;
  referenceTitle: string;
}) {
  const safeMimeType = input.mimeType.trim().startsWith("image/")
    ? input.mimeType.trim()
    : "image/jpeg";
  const imageBase64 = input.imageBase64.trim();

  if (!imageBase64) {
    return json(400, { error: "Sign practice image is required." });
  }

  const prompt = [
    "You are a strict sign language coach reviewing a camera snapshot of a learner signing.",
    `Target sign: ${input.referenceTitle}`,
    `Sign guide: ${input.referencePrompt}`,
    "Evaluate the visible handshape, finger form, palm orientation, signing space, body/face position, and whether the held pose supports the requested movement.",
    "Movement and speed cannot be fully measured from a single image, so score them conservatively from pose readiness, motion clarity, blur, and whether the user is positioned to perform the described movement.",
    "Be concrete and beginner-friendly. Mention if the frame is too close, too dark, one hand is missing, fingers are unclear, or the sign is outside chest/face space.",
    `Write verdict, mistakes, and training advice in ${getLanguageName(input.nativeLocale || "en")}.`,
    "Return valid JSON only with keys: score, verdict, matched, mistakes, training, accuracy.",
    "accuracy must contain handshape, movement, position, speed as 0-100 numbers.",
  ].join("\n");

  const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey.trim()}`,
    },
    body: JSON.stringify({
      model: openAiChatModel.trim() || "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "Return strict JSON only. Do not wrap it in markdown.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${safeMimeType};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 560,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    return json(response.status, {
      error: getOpenAiErrorMessage(response.status, payload, "Sign language evaluation failed."),
    });
  }

  return json(200, parseSignEvaluation(extractChatCompletionContent(payload)));
}

async function handleGermanReadingEvaluation(input: {
  correctAnswer: string;
  explanation: string;
  level: string;
  materialText: string;
  nativeLocale: string;
  prompt: string;
  selectedAnswer: string;
}) {
  const materialText = input.materialText.replace(/\s+/g, " ").trim();
  const promptText = input.prompt.replace(/\s+/g, " ").trim();
  const selectedAnswer = input.selectedAnswer.replace(/\s+/g, " ").trim();
  const correctAnswer = input.correctAnswer.replace(/\s+/g, " ").trim();
  const fallbackCorrect = selectedAnswer.toLowerCase() === correctAnswer.toLowerCase();

  if (!materialText || !promptText || !selectedAnswer || !correctAnswer) {
    return json(400, { error: "Reading text, question, selected answer and correct answer are required." });
  }

  const prompt = [
    "You are a strict Goethe Start Deutsch A1 reading examiner.",
    `CEFR level: ${input.level || "A1"}`,
    `Reading text: ${materialText}`,
    `Question: ${promptText}`,
    `Learner answer: ${selectedAnswer}`,
    `Correct answer: ${correctAnswer}`,
    `Local explanation: ${input.explanation}`,
    "Evaluate whether the learner selected the answer supported by the text.",
    "Use a 0-100 score: 100 for fully correct, 60 for partly supported but incomplete, 0-30 for wrong.",
    `Write verdict, evidence and next_tip in ${getLanguageName(input.nativeLocale || "en")}.`,
    "Return valid JSON only with keys: correct, score, verdict, evidence, next_tip.",
  ].join("\n");

  const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey.trim()}`,
    },
    body: JSON.stringify({
      model: openAiChatModel.trim() || "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "Return strict JSON only. Do not wrap it in markdown.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 420,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    return json(response.status, {
      error: getOpenAiErrorMessage(response.status, payload, "German reading evaluation failed."),
    });
  }

  return json(
    200,
    parseGermanReadingEvaluation(extractChatCompletionContent(payload), fallbackCorrect, input.explanation)
  );
}

async function handleGermanReadingVoiceEvaluation(input: {
  level: string;
  materialText: string;
  nativeLocale: string;
  spokenText: string;
}) {
  const materialText = input.materialText.replace(/\s+/g, " ").trim();
  const spokenText = input.spokenText.replace(/\s+/g, " ").trim();

  if (!materialText || !spokenText) {
    return json(400, { error: "Reading text and microphone transcript are required." });
  }

  const prompt = [
    "You are a strict but beginner-friendly Goethe Start Deutsch A1 reading-aloud examiner.",
    "The learner reads the German text aloud. The app sends you speech-recognition transcript, not raw audio.",
    `CEFR level: ${input.level || "A1"}`,
    `Source text: ${materialText}`,
    `Recognized microphone transcript: ${spokenText}`,
    "Compare the transcript with the source text. Judge coverage, word order, omitted words, and whether the reading is understandable.",
    "Because speech recognition can be imperfect, do not punish one tiny spelling mismatch. Penalize missing phrases, wrong words, and unclear reading strongly.",
    "Use score 0-100: 90-100 nearly complete and clear, 70-89 mostly complete, 40-69 many missing words, 0-39 little match.",
    `Write verdict, matched_text, missed_text and next_tip in ${getLanguageName(input.nativeLocale || "en")}.`,
    "Return valid JSON only with keys: score, transcript, verdict, matched_text, missed_text, next_tip.",
  ].join("\n");

  const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey.trim()}`,
    },
    body: JSON.stringify({
      model: openAiChatModel.trim() || "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "Return strict JSON only. Do not wrap it in markdown.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 520,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    return json(response.status, {
      error: getOpenAiErrorMessage(response.status, payload, "German reading voice evaluation failed."),
    });
  }

  return json(200, parseGermanReadingVoiceEvaluation(extractChatCompletionContent(payload), spokenText));
}

async function handleGermanSpeakingEvaluation(input: {
  level: string;
  nativeLocale: string;
  prompt: string;
  scenario: string;
  spokenText: string;
  targetLanguage?: string;
}) {
  const promptText = input.prompt.replace(/\s+/g, " ").trim();
  const scenarioText = input.scenario.replace(/\s+/g, " ").trim();
  const spokenText = input.spokenText.replace(/\s+/g, " ").trim();

  if (!promptText || !scenarioText || !spokenText) {
    return json(400, { error: "Speaking prompt, scenario and microphone transcript are required." });
  }

  // Target language (english for IELTS/TOEFL, spanish for DELE/SIELE, german
  // for telc/Goethe). Defaults to German for backwards compatibility.
  const target = (input.targetLanguage ?? "german").trim().toLowerCase();
  const targetIsEnglish = target === "english";
  const targetIsSpanish = target === "spanish";
  const targetName = targetIsEnglish ? "English" : targetIsSpanish ? "Spanish" : "German";
  const examinerPersona = targetIsEnglish
    ? `a strict but supportive IELTS / Cambridge English speaking examiner`
    : targetIsSpanish
      ? `a strict but supportive DELE / SIELE Spanish speaking examiner`
      : `a strict but supportive Goethe Start Deutsch A1-A2 speaking examiner`;
  const gradingFocus = targetIsEnglish
    ? "Evaluate fluency and coherence, lexical resource, grammatical range and accuracy, and task response — the IELTS band descriptors."
    : targetIsSpanish
      ? "Evaluate coherencia, léxico, gramática, pronunciación (as inferred from transcript) and task completion."
      : "Evaluate task completion, relevance, word order, verb position, articles, politeness, and simple communicative clarity.";
  const betterAnswerHint = targetIsEnglish
    ? `better_answer must be a natural ${input.level || "B2-C1"} English answer the learner can repeat.`
    : targetIsSpanish
      ? `better_answer must be a natural ${input.level || "B1-B2"} Spanish answer the learner can repeat.`
      : "better_answer must be a natural A1-A2 German answer the learner can repeat.";
  const correctionHint = targetIsEnglish
    ? "correction must explain the error in the native feedback language; it may quote a short corrected English phrase."
    : targetIsSpanish
      ? "correction must explain the error in the native feedback language; it may quote a short corrected Spanish phrase."
      : "correction must explain the error in the native feedback language; it may quote a short corrected German phrase.";

  const prompt = [
    `You are ${examinerPersona}.`,
    "The learner answers aloud. The app sends a speech-recognition transcript, not raw audio.",
    `CEFR level: ${input.level || (targetIsEnglish ? "B2-C1" : "A1-A2")}`,
    `Examiner prompt: ${promptText}`,
    `Situation card: ${scenarioText}`,
    `Recognized learner answer: ${spokenText}`,
    gradingFocus,
    "Infer pronunciation clarity only from the transcript quality and missing words. Do not pretend you heard raw audio.",
    "For A1-A2 German, grade against beginner exam expectations: short correct phrases and simple sentences can score well. Do not require native-level length or complexity.",
    "Use 0 only when there is no usable target-language answer, the transcript is unrelated, or the answer is essentially empty.",
    `Use score 0-100: 90-100 clear and complete, 70-89 understandable with small errors, 40-69 partly complete, 0-39 not enough ${targetName} or off task.`,
    betterAnswerHint,
    `The learner's native feedback language is ${getLanguageName(input.nativeLocale || "en")}.`,
    `Write verdict, correction and pronunciation_tip only in ${getLanguageName(input.nativeLocale || "en")}.`,
    correctionHint,
    `Write better_answer and next_question only in ${targetName}.`,
    `Do not use English in verdict/correction unless the native feedback language is English.`,
    "Return valid JSON only with keys: score, transcript, verdict, correction, better_answer, pronunciation_tip, next_question.",
  ].join("\n");

  const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey.trim()}`,
    },
    body: JSON.stringify({
      model: openAiChatModel.trim() || "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "Return strict JSON only. Do not wrap it in markdown.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 560,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    return json(response.status, {
      error: getOpenAiErrorMessage(response.status, payload, "German speaking evaluation failed."),
    });
  }

  return json(200, parseGermanSpeakingEvaluation(extractChatCompletionContent(payload), spokenText));
}

function getAudioExtension(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("webm")) return "webm";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("mp4")) return "mp4";
  return "m4a";
}

// Standard iterative Levenshtein — small enough for the short Aussprache
// targets we compare against (single German word, ~4-10 chars).
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous: number[] = [];
  for (let column = 0; column <= b.length; column += 1) previous.push(column);
  for (let row = 1; row <= a.length; row += 1) {
    const current: number[] = [row];
    for (let column = 1; column <= b.length; column += 1) {
      const cost = a.charCodeAt(row - 1) === b.charCodeAt(column - 1) ? 0 : 1;
      current.push(Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + cost,
      ));
    }
    previous = current;
  }
  return previous[b.length];
}

async function transcribeGermanAudio(input: {
  audioBase64: string;
  mimeType: string;
}) {
  const audioBase64 = input.audioBase64.trim();
  if (!audioBase64) {
    throw new Error("Audio recording is required.");
  }

  const binary = Uint8Array.from(atob(audioBase64), (char) => char.charCodeAt(0));
  const mimeType = input.mimeType.trim() || "audio/m4a";
  const extension = getAudioExtension(mimeType);
  const formData = new FormData();
  formData.append("model", "gpt-4o-mini-transcribe");
  formData.append("language", "de");
  formData.append("file", new Blob([binary], { type: mimeType }), `speaking-answer.${extension}`);

  const response = await fetchOpenAiWithRetry("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey.trim()}`,
    },
    body: formData,
  });

  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    throw new Error(getOpenAiErrorMessage(response.status, payload, "German audio transcription failed."));
  }

  return typeof payload.text === "string" ? payload.text.replace(/\s+/g, " ").trim() : "";
}

async function handleGermanSpeakingAudioEvaluation(input: {
  audioBase64: string;
  level: string;
  mimeType: string;
  nativeLocale: string;
  prompt: string;
  scenario: string;
}) {
  let spokenText = "";
  try {
    spokenText = await transcribeGermanAudio({
      audioBase64: input.audioBase64,
      mimeType: input.mimeType,
    });
  } catch (error) {
    return json(400, {
      error: error instanceof Error ? error.message : "German audio transcription failed.",
    });
  }

  if (!spokenText) {
    return json(400, { error: "AI could not hear a German answer in the recording." });
  }

  return handleGermanSpeakingEvaluation({
    level: input.level,
    nativeLocale: input.nativeLocale,
    prompt: input.prompt,
    scenario: input.scenario,
    spokenText,
  });
}

async function handleJsonResponse(input: {
  input: string;
  conversationId: string | null;
  history: ConversationHistoryMessage[];
  locale: string;
  levelRange: string;
  practiceMode: string;
  practiceTopic: string;
  lessonTemplate: string;
  lessonGoal: string;
  lessonTurnIndex: number;
  lessonTurnTarget: number;
  memoryHints: string[];
  difficultyMode: string;
  difficultyNote: string;
  nativeHelp: boolean;
  nativeLocale: string;
  recentAssistantQuestions: string[];
  partnerName?: string;
  partnerPersona?: string;
  partnerRole?: string;
  userId: string;
}) {
  const fallbackResponse = await createOpenAiChatCompletion({
    history: input.history,
    input: input.input,
    locale: input.locale,
    levelRange: input.levelRange,
    practiceMode: input.practiceMode,
    practiceTopic: input.practiceTopic,
    lessonTemplate: input.lessonTemplate,
    lessonGoal: input.lessonGoal,
    lessonTurnIndex: input.lessonTurnIndex,
    lessonTurnTarget: input.lessonTurnTarget,
    memoryHints: input.memoryHints,
    difficultyMode: input.difficultyMode,
    difficultyNote: input.difficultyNote,
    nativeHelp: input.nativeHelp,
    nativeLocale: input.nativeLocale,
    recentAssistantQuestions: input.recentAssistantQuestions,
    partnerName: input.partnerName,
    partnerPersona: input.partnerPersona,
    partnerRole: input.partnerRole,
  });
  const fallbackPayload = (await fallbackResponse.json().catch(() => ({}))) as JsonRecord;
  if (fallbackResponse.ok) {
    const rawContent = extractChatCompletionContent(fallbackPayload);
    const parsedCoach = parseCoachFeedback(rawContent);
    const rawFallbackText = buildCoachVisibleText(
      parsedCoach,
      rawContent,
      extractChatCompletionText(fallbackPayload)
    );
    const { text: fallbackText, coach } = polishSingleQuestionReply(
      input.practiceMode,
      rawFallbackText,
      parsedCoach,
    );
    if (fallbackText) {
      return json(200, {
        responseId: null,
        conversationId: null,
        text: fallbackText,
        model:
          typeof fallbackPayload.model === "string" ? fallbackPayload.model : null,
        coach,
        userId: input.userId,
      });
    }

    return json(200, {
      responseId: null,
      conversationId: null,
      text: buildUnavailableReply(input.locale),
      model:
        typeof fallbackPayload.model === "string" ? fallbackPayload.model : null,
      coach: null,
      userId: input.userId,
    });
  }

  if (!fallbackResponse.ok) {
    if (fallbackResponse.status >= 429) {
      return json(200, {
        responseId: null,
        conversationId: null,
        text: buildUnavailableReply(input.locale),
        model: null,
        coach: null,
        userId: input.userId,
      });
    }

    return json(fallbackResponse.status, {
      error: getOpenAiErrorMessage(
        fallbackResponse.status,
        fallbackPayload,
        "OpenAI chat completion failed."
      ),
    });
  }

  return json(200, {
    responseId: null,
    conversationId: null,
    text: buildUnavailableReply(input.locale),
    model: null,
    coach: null,
    userId: input.userId,
  });
}

async function handleStreamingResponse(req: Request, input: {
  input: string;
  conversationId: string | null;
  history: ConversationHistoryMessage[];
  locale: string;
  levelRange: string;
  practiceMode: string;
  practiceTopic: string;
  lessonTemplate: string;
  lessonGoal: string;
  lessonTurnIndex: number;
  lessonTurnTarget: number;
  memoryHints: string[];
  difficultyMode: string;
  difficultyNote: string;
  nativeHelp: boolean;
  nativeLocale: string;
  recentAssistantQuestions: string[];
  partnerName?: string;
  partnerPersona?: string;
  partnerRole?: string;
  userId: string;
}) {
  const upstreamAbortController = new AbortController();
  req.signal.addEventListener("abort", () => upstreamAbortController.abort(), {
    once: true,
  });

  return new Response(
    new ReadableStream({
      async start(controller) {
        let isClosed = false;
        const close = () => {
          if (isClosed) return;
          isClosed = true;
          try {
            controller.close();
          } catch {
            // Ignore double-close attempts from aborted streams.
          }
        };
        const send = (eventType: string, payload: unknown) => {
          if (isClosed) return;
          controller.enqueue(sse(eventType, payload));
        };

        try {
          const response = await createOpenAiChatCompletionStream({
            history: input.history,
            input: input.input,
            locale: input.locale,
            levelRange: input.levelRange,
            practiceMode: input.practiceMode,
            practiceTopic: input.practiceTopic,
            lessonTemplate: input.lessonTemplate,
            lessonGoal: input.lessonGoal,
            lessonTurnIndex: input.lessonTurnIndex,
            lessonTurnTarget: input.lessonTurnTarget,
            memoryHints: input.memoryHints,
            difficultyMode: input.difficultyMode,
            difficultyNote: input.difficultyNote,
            nativeHelp: input.nativeHelp,
            nativeLocale: input.nativeLocale,
            recentAssistantQuestions: input.recentAssistantQuestions,
            partnerName: input.partnerName,
            partnerPersona: input.partnerPersona,
            partnerRole: input.partnerRole,
            signal: upstreamAbortController.signal,
          });

          if (!response.ok) {
            const payload = (await response.json().catch(() => ({}))) as JsonRecord;
            if (response.status >= 429) {
              const fallbackText = buildUnavailableReply(input.locale);
              send("delta", { text: fallbackText });
              send("completed", {
                responseId: null,
                conversationId: null,
                model: null,
                text: fallbackText,
              });
            } else {
              send("error", {
                message: getOpenAiErrorMessage(
                  response.status,
                  payload,
                  "OpenAI request failed."
                ),
              });
            }
            close();
            return;
          }

          let rawContent = "";
          let streamedText = "";
          const decoder = new TextDecoder();
          const consumeOpenAiBlock = (block: string) => {
            const lines = block.split("\n");
            const dataParts: string[] = [];
            for (const line of lines) {
              if (line.startsWith("data:")) {
                dataParts.push(line.slice(5).trimStart());
              }
            }

            const rawData = dataParts.join("\n").trim();
            if (!rawData || rawData === "[DONE]") {
              return;
            }

            let streamPayload: JsonRecord;
            try {
              streamPayload = JSON.parse(rawData) as JsonRecord;
            } catch {
              return;
            }

            const delta = extractChatCompletionStreamDelta(streamPayload);
            if (!delta) {
              return;
            }

            rawContent += delta;
            const visibleText = buildVisiblePartialCoachText(rawContent);
            if (
              visibleText &&
              visibleText.length > streamedText.length &&
              visibleText.startsWith(streamedText)
            ) {
              send("delta", { text: visibleText.slice(streamedText.length) });
              streamedText = visibleText;
            }
          };

          let streamBuffer = "";
          const reader = response.body?.getReader();
          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }
              streamBuffer = consumeStreamBuffer(
                streamBuffer + decoder.decode(value, { stream: true }),
                consumeOpenAiBlock
              );
            }
            const tail = decoder.decode();
            if (tail) {
              streamBuffer = consumeStreamBuffer(streamBuffer + tail, consumeOpenAiBlock);
            }
          } else {
            streamBuffer = consumeStreamBuffer(await response.text(), consumeOpenAiBlock);
          }

          if (streamBuffer.trim()) {
            consumeOpenAiBlock(streamBuffer.trim());
          }

          const parsedCoach = parseCoachFeedback(rawContent);
          const rawFinalText = buildCoachVisibleText(parsedCoach, rawContent, rawContent);
          const { text: finalText, coach } = polishSingleQuestionReply(
            input.practiceMode,
            rawFinalText,
            parsedCoach,
          );
          const model = openAiChatModel.trim() || openAiModel.trim() || null;

          if (!finalText) {
            const fallbackText = buildUnavailableReply(input.locale);
            if (!streamedText) {
              send("delta", { text: fallbackText });
            }
            send("completed", {
              responseId: null,
              conversationId: null,
              model,
              text: fallbackText,
              coach: null,
            });
          } else {
            if (!streamedText) {
              send("delta", { text: finalText });
            } else if (finalText.startsWith(streamedText) && finalText.length > streamedText.length) {
              send("delta", { text: finalText.slice(streamedText.length) });
            }
            send("completed", {
              responseId: null,
              conversationId: null,
              model,
              text: finalText,
              coach,
            });
          }
        } catch (error) {
          if (!upstreamAbortController.signal.aborted) {
            send("error", {
              message: error instanceof Error ? error.message : "Unknown error",
            });
          }
        } finally {
          close();
        }
      },
      cancel() {
        upstreamAbortController.abort();
      },
    }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    }
  );
}


// Per-user hourly quota (public.claim_api_quota, service role). Every call to
// this function spends provider credit, so a signed-in account must not be
// able to loop it. Fails open on infrastructure errors so an outage in the
// counter never takes the feature down.
async function withinQuota(userId: string, bucket: string, limit: number): Promise<boolean> {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return true;
  try {
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await admin.rpc("claim_api_quota", {
      p_user_id: userId,
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: 3600,
    });
    if (error) {
      console.error("claim_api_quota failed", error.message);
      return true;
    }
    return data !== false;
  } catch (error) {
    console.error("claim_api_quota threw", error instanceof Error ? error.message : error);
    return true;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return json(405, { error: "Method not allowed." });
    }

    const { user, error: authError } = await requireUser(req);
    if (!user) {
      return json(401, { error: authError || "Unauthorized" });
    }
    if (!(await withinQuota(user.id, "openai-assistant", 400))) {
      return json(429, { error: "Too many requests. Please try again in a while." });
    }
    if (!openAiApiKey.trim()) {
      return json(500, { error: "OPENAI_API_KEY is missing." });
    }

    const body = (await req.json().catch(() => ({}))) as JsonRecord;
    const action = typeof body.action === "string" ? body.action.toLowerCase() : "";
    if (
      action !== "respond" &&
      action !== "stream" &&
      action !== "evaluate_drawing" &&
      action !== "evaluate_sign" &&
      action !== "evaluate_german_reading" &&
      action !== "evaluate_german_reading_voice" &&
      action !== "evaluate_german_speaking" &&
      action !== "evaluate_german_speaking_audio" &&
      action !== "evaluate_exam" &&
      action !== "generate_exam_module" &&
      action !== "evaluate_exam_writing" &&
      action !== "check_pronunciation"
    ) {
      return json(400, { error: "Unsupported action." });
    }

    if (action === "evaluate_exam") {
      return handleExamEvaluation({
        board: typeof body.board === "string" ? body.board : "goethe",
        level: typeof body.level === "string" ? body.level : "B1",
        transcript: typeof body.transcript === "string" ? body.transcript : "",
        nativeLocale: typeof body.nativeLocale === "string" ? body.nativeLocale : "en",
        locale: typeof body.locale === "string" ? body.locale : "de",
      });
    }

    if (action === "generate_exam_module") {
      return handleGenerateExamModule({
        board: typeof body.board === "string" ? body.board : "goethe",
        level: typeof body.level === "string" ? body.level : "B1",
        skill: typeof body.skill === "string" ? body.skill : "lesen",
        nativeLocale: typeof body.nativeLocale === "string" ? body.nativeLocale : "en",
      });
    }

    if (action === "evaluate_exam_writing") {
      return handleEvaluateExamWriting({
        board: typeof body.board === "string" ? body.board : "goethe",
        level: typeof body.level === "string" ? body.level : "B1",
        prompt: typeof body.prompt === "string" ? body.prompt : "",
        text: typeof body.text === "string" ? body.text : "",
        nativeLocale: typeof body.nativeLocale === "string" ? body.nativeLocale : "en",
      });
    }

    if (action === "evaluate_drawing") {
      return handleDrawingEvaluation({
        imageBase64: typeof body.imageBase64 === "string" ? body.imageBase64 : "",
        mimeType: typeof body.mimeType === "string" ? body.mimeType : "image/jpeg",
        nativeLocale: typeof body.nativeLocale === "string" ? body.nativeLocale : "en",
        referencePrompt:
          typeof body.referencePrompt === "string" ? body.referencePrompt.trim() : "",
        referenceTitle:
          typeof body.referenceTitle === "string" ? body.referenceTitle.trim() : "Drawing reference",
      });
    }

    if (action === "evaluate_sign") {
      return handleSignEvaluation({
        imageBase64: typeof body.imageBase64 === "string" ? body.imageBase64 : "",
        mimeType: typeof body.mimeType === "string" ? body.mimeType : "image/jpeg",
        nativeLocale: typeof body.nativeLocale === "string" ? body.nativeLocale : "en",
        referencePrompt:
          typeof body.referencePrompt === "string" ? body.referencePrompt.trim() : "",
        referenceTitle:
          typeof body.referenceTitle === "string" ? body.referenceTitle.trim() : "Sign practice",
      });
    }

    if (action === "evaluate_german_reading") {
      return handleGermanReadingEvaluation({
        correctAnswer: typeof body.correctAnswer === "string" ? body.correctAnswer : "",
        explanation: typeof body.explanation === "string" ? body.explanation : "",
        level: typeof body.level === "string" ? body.level : "A1",
        materialText: typeof body.materialText === "string" ? body.materialText : "",
        nativeLocale: typeof body.nativeLocale === "string" ? body.nativeLocale : "en",
        prompt: typeof body.prompt === "string" ? body.prompt : "",
        selectedAnswer: typeof body.selectedAnswer === "string" ? body.selectedAnswer : "",
      });
    }

    if (action === "evaluate_german_reading_voice") {
      return handleGermanReadingVoiceEvaluation({
        level: typeof body.level === "string" ? body.level : "A1",
        materialText: typeof body.materialText === "string" ? body.materialText : "",
        nativeLocale: typeof body.nativeLocale === "string" ? body.nativeLocale : "en",
        spokenText: typeof body.spokenText === "string" ? body.spokenText : "",
      });
    }

    if (action === "evaluate_german_speaking") {
      return handleGermanSpeakingEvaluation({
        level: typeof body.level === "string" ? body.level : "A1-A2",
        nativeLocale: typeof body.nativeLocale === "string" ? body.nativeLocale : "en",
        prompt: typeof body.prompt === "string" ? body.prompt : "",
        scenario: typeof body.scenario === "string" ? body.scenario : "",
        spokenText: typeof body.spokenText === "string" ? body.spokenText : "",
        targetLanguage: typeof body.targetLanguage === "string" ? body.targetLanguage : "german",
      });
    }

    if (action === "evaluate_german_speaking_audio") {
      return handleGermanSpeakingAudioEvaluation({
        audioBase64: typeof body.audioBase64 === "string" ? body.audioBase64 : "",
        level: typeof body.level === "string" ? body.level : "A1-A2",
        mimeType: typeof body.mimeType === "string" ? body.mimeType : "audio/m4a",
        nativeLocale: typeof body.nativeLocale === "string" ? body.nativeLocale : "en",
        prompt: typeof body.prompt === "string" ? body.prompt : "",
        scenario: typeof body.scenario === "string" ? body.scenario : "",
      });
    }

    if (action === "check_pronunciation") {
      // Aussprache trainer: transcribe a short recording of a single word
      // and tell the client how close it landed to the target. No LLM
      // rubric, no XP awarded from here — the client owns the reward
      // policy. This action stays fast so the drill feels responsive.
      const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64 : "";
      const mimeType = typeof body.mimeType === "string" ? body.mimeType : "audio/m4a";
      const targetRaw = typeof body.target === "string" ? body.target : "";
      const target = targetRaw.trim();
      if (!audioBase64 || !target) {
        return json(400, { error: "audioBase64 and target are required." });
      }
      try {
        const transcript = await transcribeGermanAudio({ audioBase64, mimeType });
        const normalise = (value: string) => value
          .toLowerCase()
          .replace(/ß/g, "ss")
          .replace(/[.,!?;:"'()\[\]…]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        const heard = normalise(transcript);
        const wanted = normalise(target);
        const distance = levenshtein(heard, wanted);
        const matches = distance <= Math.max(1, Math.floor(wanted.length / 6));
        const containsTarget = heard.includes(wanted);
        return json(200, {
          transcript,
          heard,
          target: wanted,
          distance,
          matches: matches || containsTarget,
        });
      } catch (error) {
        return json(500, {
          error: error instanceof Error ? error.message : "Pronunciation check failed.",
        });
      }
    }

    const input = typeof body.input === "string" ? body.input.trim() : "";
    const history = normalizeConversationHistory(body.history);
    const conversationId =
      typeof body.conversationId === "string" && body.conversationId.trim()
        ? body.conversationId.trim()
        : null;
    const locale =
      typeof body.locale === "string" && body.locale.trim() ? body.locale.trim() : "en";
    const levelRange =
      typeof body.levelRange === "string" && body.levelRange.trim()
        ? body.levelRange.trim().toUpperCase()
        : "A1-A2";
    const practiceMode =
      typeof body.practiceMode === "string" && body.practiceMode.trim()
        ? body.practiceMode.trim().toLowerCase()
        : "daily";
    const practiceTopic =
      typeof body.practiceTopic === "string" && body.practiceTopic.trim()
        ? body.practiceTopic.trim()
        : "";
    const lessonTemplate =
      typeof body.lessonTemplate === "string" && body.lessonTemplate.trim()
        ? body.lessonTemplate.trim()
        : "";
    const lessonGoal =
      typeof body.lessonGoal === "string" && body.lessonGoal.trim()
        ? body.lessonGoal.trim()
        : "";
    const lessonTurnIndex =
      typeof body.lessonTurnIndex === "number" && Number.isFinite(body.lessonTurnIndex)
        ? Math.max(0, Math.round(body.lessonTurnIndex))
        : 0;
    const lessonTurnTarget =
      typeof body.lessonTurnTarget === "number" && Number.isFinite(body.lessonTurnTarget)
        ? Math.max(0, Math.round(body.lessonTurnTarget))
        : 0;
    const difficultyMode =
      typeof body.difficultyMode === "string" && body.difficultyMode.trim()
        ? body.difficultyMode.trim().toLowerCase()
        : "balanced";
    const difficultyNote =
      typeof body.difficultyNote === "string" && body.difficultyNote.trim()
        ? body.difficultyNote.trim()
        : "";
    const nativeHelp = body.nativeHelp === true;
    const nativeLocale =
      typeof body.nativeLocale === "string" && body.nativeLocale.trim()
        ? body.nativeLocale.trim()
        : "";
    const memoryHints = Array.isArray(body.memoryHints)
      ? body.memoryHints
          .map((item) => (typeof item === "string" ? item.replace(/\s+/g, " ").trim() : ""))
          .filter(Boolean)
          .slice(-10)
      : [];
    const recentAssistantQuestions = Array.isArray(body.recentAssistantQuestions)
      ? body.recentAssistantQuestions
          .map((item) => (typeof item === "string" ? item.replace(/\s+/g, " ").trim() : ""))
          .filter(Boolean)
          .slice(-8)
      : [];
    const partnerName =
      typeof body.partnerName === "string" ? body.partnerName.trim() : "";
    const partnerPersona =
      typeof body.partnerPersona === "string" ? body.partnerPersona.trim() : "";
    const partnerRole =
      typeof body.partnerRole === "string" ? body.partnerRole.trim().toLowerCase() : "";

    if (!input) {
      return json(400, { error: "Input text is required." });
    }

    if (action === "stream") {
      return handleStreamingResponse(req, {
        input,
        conversationId,
        history,
        locale,
        levelRange,
        practiceMode,
        practiceTopic,
        lessonTemplate,
        lessonGoal,
        lessonTurnIndex,
        lessonTurnTarget,
        memoryHints,
        difficultyMode,
        difficultyNote,
        nativeHelp,
        nativeLocale,
        recentAssistantQuestions,
        partnerName,
        partnerPersona,
        partnerRole,
        userId: user.id,
      });
    }

    return handleJsonResponse({
      input,
      conversationId,
      history,
      locale,
      levelRange,
      practiceMode,
      practiceTopic,
      lessonTemplate,
      lessonGoal,
      lessonTurnIndex,
      lessonTurnTarget,
      memoryHints,
      difficultyMode,
      difficultyNote,
      nativeHelp,
      nativeLocale,
      recentAssistantQuestions,
      partnerName,
      partnerPersona,
      partnerRole,
      userId: user.id,
    });
  } catch (error) {
    console.error("[openai-assistant] Request failed", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : null,
    });
    return json(500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
