import { z } from "zod";

export const FlagSchema = z.object({
  severity: z.enum(["info", "warn", "blocker"]),
  message: z.string(),
});
export type Flag = z.infer<typeof FlagSchema>;

export const ExtractedDocumentSchema = z.object({
  kind: z.string(),
  title: z.string(),
  issuing_authority: z.string().nullable(),
  jurisdiction: z.string().nullable(),
  language_detected: z.string().nullable(),
  subject_name: z.string().nullable(),
  issue_date: z.string().nullable(),
  deadline: z.string().nullable(),
  demanded_action: z.string().nullable(),
  identifiers: z.record(z.string(), z.string()),
  key_facts: z.array(z.string()),
  translated_summary: z.string().nullable(),
  flags: z.array(FlagSchema),
});
export type ExtractedDocument = z.infer<typeof ExtractedDocumentSchema>;

export const ResponseOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum([
    "comply",
    "appeal",
    "contest",
    "negotiate",
    "extension",
    "escalate",
    "ignore",
    "other",
  ]),
  recommendation: z.enum(["strong", "viable", "weak", "not_recommended"]),
  summary: z.string(),
  why_it_fits: z.array(z.string()),
  why_it_might_not: z.array(z.string()),
  required_evidence: z.array(z.string()),
  forms_or_documents: z.array(z.string()),
  estimated_timeline_days: z.object({
    low: z.number(),
    high: z.number(),
  }),
  estimated_cost_usd: z.object({
    low: z.number(),
    high: z.number(),
  }),
  risks: z.array(z.string()),
});
export type ResponseOption = z.infer<typeof ResponseOptionSchema>;

export const ResponseAnalysisSchema = z.object({
  options: z.array(ResponseOptionSchema),
  recommendation: z.string(),
});
export type ResponseAnalysis = z.infer<typeof ResponseAnalysisSchema>;

export const WeaknessSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "argument",
    "evidence",
    "documentation",
    "legal",
    "language",
    "procedural",
    "other",
  ]),
  title: z.string(),
  description: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  what_counterparty_will_cite: z.string(),
  suggested_search_queries: z.array(z.string()),
});
export type Weakness = z.infer<typeof WeaknessSchema>;

export const CounterpartyReviewSchema = z.object({
  weaknesses: z.array(WeaknessSchema),
  overall_assessment: z.string(),
  rejection_likelihood: z.enum(["high", "medium", "low"]),
});
export type CounterpartyReview = z.infer<typeof CounterpartyReviewSchema>;

export const EvidenceItemSchema = z.object({
  weakness_id: z.string(),
  claim: z.string(),
  source_url: z.string().nullable(),
  source_title: z.string(),
  quote_or_summary: z.string(),
  why_relevant: z.string(),
  found_via: z.enum(["web", "uploaded_docs", "missing"]),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const ResearchResultSchema = z.object({
  weakness_id: z.string(),
  evidence: z.array(EvidenceItemSchema),
  note: z.string().nullable(),
});
export type ResearchResult = z.infer<typeof ResearchResultSchema>;

export const HardenIterationSchema = z.object({
  iteration: z.number(),
  counterparty_review: CounterpartyReviewSchema,
  research_results: z.array(ResearchResultSchema),
});
export type HardenIteration = z.infer<typeof HardenIterationSchema>;

export const ResponseLetterSchema = z.object({
  option_id: z.string(),
  language: z.string(),
  response_text: z.string(),
  attachments_needed: z.array(
    z.object({
      label: z.string(),
      description: z.string(),
      source: z.string(),
    }),
  ),
  weak_points: z.array(
    z.object({
      point: z.string(),
      mitigation: z.string(),
    }),
  ),
  next_steps: z.array(
    z.object({
      by_date: z.string(),
      action: z.string(),
    }),
  ),
});
export type ResponseLetter = z.infer<typeof ResponseLetterSchema>;

export const HardenedResultSchema = z.object({
  original_response: ResponseLetterSchema,
  iterations: z.array(HardenIterationSchema),
  final_response: ResponseLetterSchema,
  evidence_binder: z.array(EvidenceItemSchema),
});
export type HardenedResult = z.infer<typeof HardenedResultSchema>;

export const ExtractedCitationSchema = z.object({
  id: z.string(),
  type: z.enum([
    "statute",
    "regulation",
    "case",
    "guidance",
    "schedule",
    "treaty",
    "other",
  ]),
  text: z.string(),
  context: z.string(),
  jurisdiction: z.string().nullable(),
  lookup_query: z.string(),
});
export type ExtractedCitation = z.infer<typeof ExtractedCitationSchema>;

export const CitationVerificationSchema = z.object({
  citation_id: z.string(),
  status: z.enum(["verified", "mismatch", "not_found", "ambiguous", "skipped"]),
  source_url: z.string().nullable(),
  source_title: z.string().nullable(),
  source_quote: z.string().nullable(),
  notes: z.string(),
});
export type CitationVerification = z.infer<typeof CitationVerificationSchema>;

export const CitationVerificationResultSchema = z.object({
  citations: z.array(ExtractedCitationSchema),
  verifications: z.array(CitationVerificationSchema),
  summary: z.object({
    total: z.number(),
    verified: z.number(),
    mismatch: z.number(),
    not_found: z.number(),
    ambiguous: z.number(),
    skipped: z.number(),
  }),
});
export type CitationVerificationResult = z.infer<
  typeof CitationVerificationResultSchema
>;
