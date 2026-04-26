import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  _client = new Anthropic({ apiKey: key });
  return _client;
}

export const MODEL = "claude-opus-4-7";

export async function jsonMessage<T>(args: {
  system: string;
  user: Anthropic.MessageParam[];
  maxTokens?: number;
  schemaName: string;
}): Promise<T> {
  const message = await client().messages.create({
    model: MODEL,
    max_tokens: args.maxTokens ?? 8000,
    system: args.system,
    messages: args.user,
  });

  return parseJsonFromText(
    message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n"),
    args.schemaName,
  ) as T;
}

export async function jsonMessageWithWebSearch<T>(args: {
  system: string;
  user: Anthropic.MessageParam[];
  maxTokens?: number;
  maxSearches?: number;
  schemaName: string;
}): Promise<T> {
  const message = await client().messages.create({
    model: MODEL,
    max_tokens: args.maxTokens ?? 8000,
    system: args.system,
    messages: args.user,
    tools: [
      {
        type: "web_search_20260209",
        name: "web_search",
        max_uses: args.maxSearches ?? 4,
      },
    ],
  });

  return parseJsonFromText(
    message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n"),
    args.schemaName,
  ) as T;
}

function parseJsonFromText(text: string, schemaName: string): unknown {
  const stripped = text.replace(/<cite\s+[^>]*>/gi, "").replace(/<\/cite>/gi, "");

  const fenced = stripped.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : stripped;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`${schemaName}: no JSON object found in model output`);
  }
  const slice = raw.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (e) {
    throw new Error(
      `${schemaName}: failed to parse JSON — ${(e as Error).message}\n---\n${slice}`,
    );
  }
}
