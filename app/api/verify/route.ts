import { NextRequest } from "next/server";
import { jsonMessage, jsonMessageWithWebSearch } from "@/lib/anthropic";
import {
  CITATION_EXTRACTOR_SYSTEM,
  CITATION_VERIFIER_SYSTEM,
} from "@/lib/prompts";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  ResponseLetterSchema,
  ExtractedCitationSchema,
  CitationVerificationSchema,
  type ExtractedCitation,
  type CitationVerification,
  type CitationVerificationResult,
} from "@/lib/types";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 800;

const BodySchema = z.object({
  response: ResponseLetterSchema,
  jurisdiction_hint: z.string().optional(),
});

const ExtractorOutputSchema = z.object({
  citations: z.array(ExtractedCitationSchema),
});

const CONCURRENCY = 4;
// Hard upper bound on how many citations we'll verify per call. The
// extractor pulls citations from attacker-controllable response_text; we
// cap to keep one verify request from triggering hundreds of LLM calls.
const MAX_CITATIONS = 25;

function sseLine(event: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}
function sseComment(text: string): Uint8Array {
  return new TextEncoder().encode(`: ${text}\n\n`);
}

async function extractCitations(
  responseText: string,
  jurisdictionHint: string | undefined,
): Promise<ExtractedCitation[]> {
  const prompt = `Extract every legal citation from this response letter. ${
    jurisdictionHint ? `Jurisdiction hint: ${jurisdictionHint}.` : ""
  }

RESPONSE LETTER:
${responseText}

Return the JSON object defined in the system prompt.`;

  const parsed = await jsonMessage<unknown>({
    system: CITATION_EXTRACTOR_SYSTEM,
    user: [{ role: "user", content: prompt }],
    schemaName: "citation_extractor",
    maxTokens: 4000,
  });
  const validated = ExtractorOutputSchema.parse(parsed);
  return validated.citations;
}

async function verifyCitation(
  citation: ExtractedCitation,
): Promise<CitationVerification> {
  const prompt = `Verify this citation:

ID: ${citation.id}
TYPE: ${citation.type}
TEXT (as it appears in letter): ${citation.text}
JURISDICTION: ${citation.jurisdiction ?? "unspecified"}
LOOKUP QUERY: ${citation.lookup_query}

CONTEXT (the surrounding claim being made about this citation):
${citation.context}

Use the web_search tool to confirm this against a primary source. Return the JSON object defined in the system prompt. The citation_id field MUST equal "${citation.id}".`;

  const parsed = await jsonMessageWithWebSearch<unknown>({
    system: CITATION_VERIFIER_SYSTEM,
    user: [{ role: "user", content: prompt }],
    schemaName: `citation_verifier:${citation.id}`,
    maxTokens: 2500,
    maxSearches: 4,
  });
  const validated = CitationVerificationSchema.parse(parsed);
  return { ...validated, citation_id: citation.id };
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, "verify", 5, 60 * 60 * 1000);
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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(sseLine(event));
      const heartbeat = setInterval(
        () => controller.enqueue(sseComment("alive")),
        10000,
      );

      try {
        send({ type: "started" });
        send({ type: "extracting" });

        let citations: ExtractedCitation[];
        try {
          citations = await extractCitations(
            body.response.response_text,
            body.jurisdiction_hint,
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          send({ type: "error", message: `Extractor failed: ${msg}` });
          return;
        }

        if (citations.length > MAX_CITATIONS) {
          send({
            type: "truncated",
            extracted: citations.length,
            kept: MAX_CITATIONS,
          });
          citations = citations.slice(0, MAX_CITATIONS);
        }

        send({ type: "extracted", citations });

        if (citations.length === 0) {
          const empty: CitationVerificationResult = {
            citations: [],
            verifications: [],
            summary: {
              total: 0,
              verified: 0,
              mismatch: 0,
              not_found: 0,
              ambiguous: 0,
              skipped: 0,
            },
          };
          send({ type: "final", result: empty });
          return;
        }

        const verifications: CitationVerification[] = [];

        for (let i = 0; i < citations.length; i += CONCURRENCY) {
          const batch = citations.slice(i, i + CONCURRENCY);
          for (const c of batch) {
            send({ type: "verifier_working", citation_id: c.id });
          }
          const results = await Promise.all(
            batch.map(async (c) => {
              try {
                const v = await verifyCitation(c);
                send({ type: "verifier_done", verification: v });
                return v;
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                const fallback: CitationVerification = {
                  citation_id: c.id,
                  status: "ambiguous",
                  source_url: null,
                  source_title: null,
                  source_quote: null,
                  notes: `Verification call failed: ${msg}`,
                };
                send({ type: "verifier_done", verification: fallback });
                return fallback;
              }
            }),
          );
          verifications.push(...results);
        }

        const summary = {
          total: verifications.length,
          verified: verifications.filter((v) => v.status === "verified").length,
          mismatch: verifications.filter((v) => v.status === "mismatch").length,
          not_found: verifications.filter((v) => v.status === "not_found").length,
          ambiguous: verifications.filter((v) => v.status === "ambiguous").length,
          skipped: verifications.filter((v) => v.status === "skipped").length,
        };

        const result: CitationVerificationResult = {
          citations,
          verifications,
          summary,
        };
        send({ type: "final", result });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        send({ type: "error", message: msg });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
