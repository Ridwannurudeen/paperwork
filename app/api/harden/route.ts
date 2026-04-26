import { NextRequest } from "next/server";
import { jsonMessage, jsonMessageWithWebSearch } from "@/lib/anthropic";
import { COUNTERPARTY_SYSTEM, RESEARCHER_SYSTEM, REVISER_SYSTEM } from "@/lib/prompts";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  ResponseLetterSchema,
  ExtractedDocumentSchema,
  ResponseOptionSchema,
  CounterpartyReviewSchema,
  ResearchResultSchema,
  type ResponseLetter,
  type CounterpartyReview,
  type ResearchResult,
  type Weakness,
  type EvidenceItem,
} from "@/lib/types";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 800;

const BodySchema = z.object({
  documents: z.array(ExtractedDocumentSchema).min(1),
  option: ResponseOptionSchema,
  response: ResponseLetterSchema,
  max_iterations: z.number().int().min(1).max(3).optional(),
});

function sseLine(event: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

function sseComment(text: string): Uint8Array {
  return new TextEncoder().encode(`: ${text}\n\n`);
}

async function withHeartbeat<T>(
  controller: ReadableStreamDefaultController<Uint8Array>,
  label: string,
  op: () => Promise<T>,
): Promise<T> {
  let count = 0;
  const t = setInterval(() => {
    controller.enqueue(sseComment(`${label} alive ${++count}`));
  }, 10000);
  try {
    return await op();
  } finally {
    clearInterval(t);
  }
}

async function runCounterparty(
  response: ResponseLetter,
  documents: unknown[],
): Promise<CounterpartyReview> {
  const prompt = `Review this response letter adversarially. You are the authority/adjudicator on the other side. Find every weakness you would exploit to reject it.

RESPONSE LETTER (DRAFT):
${JSON.stringify(response, null, 2)}

SOURCE DOCUMENTS (already extracted):
${JSON.stringify(documents, null, 2)}

Return the JSON object defined in the system prompt.`;
  const parsed = await jsonMessage<unknown>({
    system: COUNTERPARTY_SYSTEM,
    user: [{ role: "user", content: prompt }],
    schemaName: "counterparty",
    maxTokens: 6000,
  });
  return CounterpartyReviewSchema.parse(parsed);
}

async function runResearcher(
  weakness: Weakness,
  response: ResponseLetter,
): Promise<ResearchResult> {
  const prompt = `A counterparty reviewer flagged this weakness in a draft response letter:

WEAKNESS:
${JSON.stringify(weakness, null, 2)}

RELEVANT RESPONSE CONTEXT:
Option: ${response.option_id}
Language: ${response.language}
Response text excerpt (first 1500 chars):
${response.response_text.slice(0, 1500)}

Suggested search queries:
${weakness.suggested_search_queries.map((q) => `- ${q}`).join("\n")}

Use the web_search tool to find public evidence addressing this weakness. Return the JSON object defined in the system prompt.`;
  const parsed = await jsonMessageWithWebSearch<unknown>({
    system: RESEARCHER_SYSTEM,
    user: [{ role: "user", content: prompt }],
    schemaName: "researcher",
    maxTokens: 5000,
    maxSearches: 4,
  });
  const result = ResearchResultSchema.parse(parsed);
  return { ...result, weakness_id: weakness.id };
}

async function runReviser(
  response: ResponseLetter,
  weaknesses: Weakness[],
  research: ResearchResult[],
  documents: unknown[],
): Promise<ResponseLetter> {
  const prompt = `Revise this response letter to address each weakness using the new evidence.

ORIGINAL RESPONSE:
${JSON.stringify(response, null, 2)}

WEAKNESSES FLAGGED:
${JSON.stringify(weaknesses, null, 2)}

NEW EVIDENCE GATHERED:
${JSON.stringify(research, null, 2)}

SOURCE DOCUMENTS:
${JSON.stringify(documents, null, 2)}

Return the revised response as the JSON object (same schema as the original).`;
  const parsed = await jsonMessage<unknown>({
    system: REVISER_SYSTEM,
    user: [{ role: "user", content: prompt }],
    schemaName: "reviser",
    maxTokens: 10000,
  });
  return ResponseLetterSchema.parse(parsed);
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, "harden", 3, 60 * 60 * 1000);
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

  const maxIters = body.max_iterations ?? 1;
  const MAX_WEAKNESSES_PER_ITER = 3;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(sseLine(event));

      try {
        send({ type: "started", max_iterations: maxIters });

        let currentResponse = body.response;
        const iterations: {
          iteration: number;
          counterparty_review: CounterpartyReview;
          research_results: ResearchResult[];
        }[] = [];
        const evidenceBinder: EvidenceItem[] = [];

        for (let i = 1; i <= maxIters; i++) {
          send({ type: "iteration_started", iteration: i });

          send({ type: "counterparty_working", iteration: i });
          const fullReview = await withHeartbeat(controller, "counterparty", () =>
            runCounterparty(currentResponse, body.documents),
          );
          const review: CounterpartyReview = {
            ...fullReview,
            weaknesses: [...fullReview.weaknesses]
              .sort((a, b) => {
                const rank = { high: 0, medium: 1, low: 2 };
                return rank[a.severity] - rank[b.severity];
              })
              .slice(0, MAX_WEAKNESSES_PER_ITER),
          };
          send({
            type: "counterparty_done",
            iteration: i,
            rejection_likelihood: review.rejection_likelihood,
            overall_assessment: review.overall_assessment,
            weaknesses: review.weaknesses,
          });

          if (
            review.weaknesses.length === 0 ||
            review.rejection_likelihood === "low"
          ) {
            send({ type: "converged", iteration: i });
            iterations.push({
              iteration: i,
              counterparty_review: review,
              research_results: [],
            });
            break;
          }

          send({
            type: "research_dispatched",
            iteration: i,
            weakness_count: review.weaknesses.length,
          });

          const researchResults = await Promise.all(
            review.weaknesses.map(async (w) => {
              send({
                type: "researcher_working",
                iteration: i,
                weakness_id: w.id,
                weakness_title: w.title,
                queries: w.suggested_search_queries,
              });
              try {
                const r = await withHeartbeat(controller, `researcher:${w.id}`, () =>
                  runResearcher(w, currentResponse),
                );
                send({
                  type: "researcher_done",
                  iteration: i,
                  weakness_id: w.id,
                  evidence_count: r.evidence.length,
                  evidence: r.evidence,
                });
                return r;
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                send({
                  type: "researcher_failed",
                  iteration: i,
                  weakness_id: w.id,
                  error: msg,
                });
                return {
                  weakness_id: w.id,
                  evidence: [],
                  note: `research failed: ${msg}`,
                } satisfies ResearchResult;
              }
            }),
          );

          for (const r of researchResults) evidenceBinder.push(...r.evidence);

          send({ type: "reviser_working", iteration: i });
          currentResponse = await withHeartbeat(controller, "reviser", () =>
            runReviser(currentResponse, review.weaknesses, researchResults, body.documents),
          );
          send({
            type: "reviser_done",
            iteration: i,
            response_preview: currentResponse.response_text.slice(0, 400),
            new_attachment_count: currentResponse.attachments_needed.length,
          });

          iterations.push({
            iteration: i,
            counterparty_review: review,
            research_results: researchResults,
          });
        }

        send({
          type: "final",
          original_response: body.response,
          final_response: currentResponse,
          iterations,
          evidence_binder: evidenceBinder,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        send({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
