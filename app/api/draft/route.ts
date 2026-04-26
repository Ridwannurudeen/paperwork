import { NextRequest } from "next/server";
import { jsonMessageWithWebSearch } from "@/lib/anthropic";
import { DRAFT_SYSTEM } from "@/lib/prompts";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  ExtractedDocumentSchema,
  ResponseOptionSchema,
  ResponseLetterSchema,
  type ResponseLetter,
} from "@/lib/types";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  documents: z.array(ExtractedDocumentSchema).min(1),
  option: ResponseOptionSchema,
  free_text_context: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, "draft", 10, 60 * 60 * 1000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfter);

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: `Invalid request body: ${msg}` }, { status: 400 });
  }

  const userPrompt = `Draft the user's response letter for the selected option.

SELECTED OPTION:
${JSON.stringify(body.option, null, 2)}

SOURCE DOCUMENTS (extracted):
${JSON.stringify(body.documents, null, 2)}

ADDITIONAL CONTEXT FROM USER:
${body.free_text_context ?? "(none)"}

Return the JSON object defined in the system prompt.`;

  try {
    const parsed = await jsonMessageWithWebSearch<unknown>({
      system: DRAFT_SYSTEM,
      user: [{ role: "user", content: userPrompt }],
      schemaName: "draft",
      maxTokens: 14000,
      maxSearches: 5,
    });
    const validated: ResponseLetter = ResponseLetterSchema.parse(parsed);
    return Response.json({ response: validated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
