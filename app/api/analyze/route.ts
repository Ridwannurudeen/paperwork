import { NextRequest } from "next/server";
import { jsonMessageWithWebSearch } from "@/lib/anthropic";
import { ANALYZE_SYSTEM } from "@/lib/prompts";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  ExtractedDocumentSchema,
  ResponseAnalysisSchema,
  type ResponseAnalysis,
} from "@/lib/types";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  documents: z.array(ExtractedDocumentSchema).min(1),
  free_text_context: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, "analyze", 10, 60 * 60 * 1000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfter);

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: `Invalid request body: ${msg}` }, { status: 400 });
  }

  const caseBrief = {
    documents: body.documents,
    additional_context: body.free_text_context ?? "",
  };

  const userPrompt = `A user has uploaded the following letter(s) and supporting documents and needs to know how to respond. Analyze every realistic response option and return the JSON object defined in the system prompt.

CASE FILE:
${JSON.stringify(caseBrief, null, 2)}`;

  try {
    const parsed = await jsonMessageWithWebSearch<unknown>({
      system: ANALYZE_SYSTEM,
      user: [{ role: "user", content: userPrompt }],
      schemaName: "analyze",
      maxTokens: 14000,
      maxSearches: 6,
    });
    const validated: ResponseAnalysis = ResponseAnalysisSchema.parse(parsed);
    const ordered = [...validated.options].sort((a, b) => {
      const rank = { strong: 0, viable: 1, weak: 2, not_recommended: 3 };
      return rank[a.recommendation] - rank[b.recommendation];
    });
    return Response.json({ analysis: { ...validated, options: ordered } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
