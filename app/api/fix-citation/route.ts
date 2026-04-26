import { NextRequest } from "next/server";
import { jsonMessage } from "@/lib/anthropic";
import { FIX_CITATION_SYSTEM } from "@/lib/prompts";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  ResponseLetterSchema,
  ExtractedCitationSchema,
  CitationVerificationSchema,
  FixCitationResultSchema,
  type FixCitationResult,
} from "@/lib/types";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 200;

const BodySchema = z.object({
  response: ResponseLetterSchema,
  citation: ExtractedCitationSchema,
  verification: CitationVerificationSchema,
});

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, "fix-citation", 10, 60 * 60 * 1000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfter);

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (e) {
    return Response.json(
      { error: `Invalid request body: ${e instanceof Error ? e.message : String(e)}` },
      { status: 400 },
    );
  }

  if (
    body.verification.status !== "mismatch" &&
    body.verification.status !== "not_found"
  ) {
    return Response.json(
      {
        error: `Auto-fix only applies to citations with status mismatch or not_found. Got: ${body.verification.status}.`,
      },
      { status: 400 },
    );
  }

  const userPrompt = `One citation in this response letter has been independently verified and found to be wrong. Rewrite the letter to fix that citation only.

ORIGINAL RESPONSE LETTER (JSON):
${JSON.stringify(body.response, null, 2)}

THE CITATION THAT IS WRONG:
${JSON.stringify(body.citation, null, 2)}

VERIFIER'S FINDING (with the correct primary source):
${JSON.stringify(body.verification, null, 2)}

Return the JSON object defined in the system prompt.`;

  try {
    const parsed = await jsonMessage<unknown>({
      system: FIX_CITATION_SYSTEM,
      user: [{ role: "user", content: userPrompt }],
      schemaName: "fix_citation",
      maxTokens: 12000,
    });
    const validated: FixCitationResult = FixCitationResultSchema.parse(parsed);
    return Response.json(validated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
