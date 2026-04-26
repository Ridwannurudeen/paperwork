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
    // The model occasionally emits JSON with raw control characters
    // inside string literals — typically newlines / tabs from web-search
    // quoted text that didn't get JSON-escaped. RFC 8259 forbids that, so
    // JSON.parse refuses. Walk the slice and escape any unescaped control
    // chars that appear inside string values, then retry once.
    try {
      const repaired = escapeUnescapedControlChars(slice);
      return JSON.parse(repaired);
    } catch {
      throw new Error(
        `${schemaName}: failed to parse JSON — ${(e as Error).message}\n---\n${slice}`,
      );
    }
  }
}

// Walks a JSON-ish string and replaces any raw control characters that
// appear inside string literals with their escaped form. Control chars
// outside string literals (e.g. between members) are left as-is — JSON
// permits them as whitespace where structurally meaningful (LF, CR, TAB,
// SP). Inside a string they must be escaped per RFC 8259 §7.
function escapeUnescapedControlChars(s: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (inString && ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString) {
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        if (code === 0x0a) out += "\\n";
        else if (code === 0x0d) out += "\\r";
        else if (code === 0x09) out += "\\t";
        else if (code === 0x08) out += "\\b";
        else if (code === 0x0c) out += "\\f";
        else out += "\\u" + code.toString(16).padStart(4, "0");
        continue;
      }
    }
    out += ch;
  }
  return out;
}
