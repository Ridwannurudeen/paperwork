import { NextRequest } from "next/server";
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  ResponseLetterSchema,
  ExtractedDocumentSchema,
  ResponseOptionSchema,
  EvidenceItemSchema,
  CitationVerificationResultSchema,
} from "@/lib/types";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const FONTS_DIR = join(process.cwd(), "lib", "fonts");
let cachedFonts: { regular: Uint8Array; bold: Uint8Array } | null = null;

async function loadUnicodeFonts(): Promise<{
  regular: Uint8Array;
  bold: Uint8Array;
} | null> {
  if (cachedFonts) return cachedFonts;
  try {
    const [regular, bold] = await Promise.all([
      readFile(join(FONTS_DIR, "NotoSans-Regular.ttf")),
      readFile(join(FONTS_DIR, "NotoSans-Bold.ttf")),
    ]);
    cachedFonts = {
      regular: new Uint8Array(regular),
      bold: new Uint8Array(bold),
    };
    return cachedFonts;
  } catch {
    return null;
  }
}

const BodySchema = z.object({
  documents: z.array(ExtractedDocumentSchema).min(1),
  option: ResponseOptionSchema,
  response: ResponseLetterSchema,
  evidence_binder: z.array(EvidenceItemSchema).optional(),
  verification: CitationVerificationResultSchema.optional(),
});

type Body = z.infer<typeof BodySchema>;

function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    if (paragraph.trim() === "") {
      out.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const w of words) {
      if ((line + " " + w).trim().length > width) {
        out.push(line);
        line = w;
      } else {
        line = line ? `${line} ${w}` : w;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

async function buildPDF(body: Body): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const noto = await loadUnicodeFonts();
  let helv: PDFFont;
  let bold: PDFFont;
  if (noto) {
    helv = await pdf.embedFont(noto.regular, { subset: true });
    bold = await pdf.embedFont(noto.bold, { subset: true });
  } else {
    helv = await pdf.embedFont(StandardFonts.Helvetica);
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  }
  const mono = noto ? helv : await pdf.embedFont(StandardFonts.Courier);

  const MARGIN = 54;
  const W = 612;
  const H = 792;
  const LINE_W = 95;

  let currentPage = pdf.addPage([W, H]);
  let y = H - MARGIN;

  function newPage() {
    currentPage = pdf.addPage([W, H]);
    y = H - MARGIN;
  }

  function header(title: string) {
    if (y < 200) newPage();
    currentPage.drawRectangle({
      x: 0,
      y: y - 6,
      width: W,
      height: 26,
      color: rgb(0.05, 0.1, 0.35),
    });
    currentPage.drawText(title, {
      x: MARGIN,
      y: y + 2,
      size: 12,
      font: bold,
      color: rgb(1, 1, 1),
    });
    y -= 36;
  }

  function paragraph(text: string, opts: { size?: number; font?: "helv" | "bold" | "mono" } = {}) {
    const size = opts.size ?? 10;
    const font = opts.font === "bold" ? bold : opts.font === "mono" ? mono : helv;
    const lh = size + 3;
    const lines = wrap(text, LINE_W);
    for (const line of lines) {
      if (y < MARGIN) newPage();
      currentPage.drawText(line, { x: MARGIN, y, size, font, color: rgb(0, 0, 0) });
      y -= lh;
    }
    y -= 4;
  }

  function kv(label: string, value: string) {
    if (y < MARGIN + 20) newPage();
    currentPage.drawText(label, { x: MARGIN, y, size: 9, font: bold, color: rgb(0.25, 0.25, 0.25) });
    currentPage.drawText(value, { x: MARGIN + 180, y, size: 10, font: helv, color: rgb(0, 0, 0) });
    y -= 14;
  }

  function divider() {
    currentPage.drawLine({
      start: { x: MARGIN, y },
      end: { x: W - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 10;
  }

  // Cover
  currentPage.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.98, 0.98, 0.98) });
  currentPage.drawText("Paperwork", {
    x: MARGIN,
    y: H - MARGIN - 8,
    size: 28,
    font: bold,
    color: rgb(0.05, 0.1, 0.35),
  });
  currentPage.drawText("Response packet — DRAFT FOR REVIEW", {
    x: MARGIN,
    y: H - MARGIN - 38,
    size: 10,
    font: helv,
    color: rgb(0.4, 0.4, 0.4),
  });

  y = H - MARGIN - 80;
  kv("Response option", body.option.name);
  kv("Category", body.option.category);
  kv("Estimated timeline", `${body.option.estimated_timeline_days.low}–${body.option.estimated_timeline_days.high} days`);
  kv("Estimated cost (USD)", `$${body.option.estimated_cost_usd.low}–$${body.option.estimated_cost_usd.high}`);
  if (body.option.forms_or_documents.length) {
    kv("Forms / documents", body.option.forms_or_documents.slice(0, 3).join(", "));
  }
  kv("Response language", body.response.language);
  kv("Generated", new Date().toISOString().slice(0, 10));
  y -= 16;
  paragraph(
    "This packet was generated by Paperwork, an AI-assisted bureaucracy navigator. Every section is a DRAFT. Verify every fact against the original letter and current law before sending anything. Paperwork is not a law firm and does not provide legal advice.",
    { size: 9 },
  );

  // Section 1: The response letter
  newPage();
  header(`I. Response letter (${body.response.language})`);
  paragraph(body.response.response_text, { size: 10 });

  // Section 2: Citation verification (from verify route)
  if (body.verification && body.verification.summary.total > 0) {
    newPage();
    header("II. Citation verification (machine-checked against primary sources)");
    const s = body.verification.summary;
    paragraph(
      `${s.verified} verified  ·  ${s.mismatch} mismatch  ·  ${s.not_found} not found  ·  ${s.ambiguous} ambiguous  ·  ${s.skipped} skipped  ·  ${s.total} total`,
      { font: "bold", size: 10 },
    );
    y -= 4;
    const byId = new Map(body.verification.citations.map((c) => [c.id, c]));
    for (const v of body.verification.verifications) {
      if (y < 140) newPage();
      const c = byId.get(v.citation_id);
      const tag = v.status.toUpperCase().replace(/_/g, " ");
      paragraph(`[${tag}]  ${c?.text ?? v.citation_id}`, { font: "bold", size: 10 });
      if (c?.context) paragraph(`Context: ${c.context}`, { size: 9 });
      paragraph(`Notes: ${v.notes}`, { size: 9 });
      if (v.source_quote) paragraph(`"${v.source_quote.slice(0, 400)}"`, { size: 9 });
      if (v.source_url) paragraph(`URL: ${v.source_url}`, { size: 8, font: "mono" });
      divider();
    }
  }

  // Section 3: Attachments needed
  if (body.response.attachments_needed.length > 0) {
    newPage();
    header("III. Attachments to send with the response");
    for (const ex of body.response.attachments_needed) {
      if (y < 80) newPage();
      paragraph(ex.label, { font: "bold", size: 10 });
      paragraph(ex.description, { size: 9 });
      paragraph(`Source: ${ex.source}`, { size: 8, font: "mono" });
      y -= 4;
    }
  }

  // Section 4: Next steps / deadlines
  if (body.response.next_steps.length > 0) {
    newPage();
    header("IV. Deadlines and next steps");
    for (const s of body.response.next_steps) {
      if (y < 60) newPage();
      paragraph(`${s.by_date}  —  ${s.action}`, { size: 10 });
    }
  }

  // Section 5: Weak points + mitigations
  if (body.response.weak_points.length > 0) {
    newPage();
    header("V. Known weak points and mitigations");
    for (const w of body.response.weak_points) {
      if (y < 100) newPage();
      paragraph(`⚠  ${w.point}`, { font: "bold", size: 10 });
      paragraph(`Mitigation: ${w.mitigation}`, { size: 9 });
      y -= 4;
    }
  }

  // Section 6: Evidence binder (from harden loop)
  if (body.evidence_binder && body.evidence_binder.length > 0) {
    newPage();
    header("VI. Evidence binder (gathered from public sources)");
    for (const e of body.evidence_binder) {
      if (y < 120) newPage();
      paragraph(e.source_title, { font: "bold", size: 10 });
      paragraph(`Claim supported: ${e.claim}`, { size: 9 });
      paragraph(`"${e.quote_or_summary.trim().slice(0, 500)}"`, { size: 9 });
      paragraph(`Why relevant: ${e.why_relevant}`, { size: 9 });
      if (e.source_url) paragraph(`URL: ${e.source_url}`, { size: 8, font: "mono" });
      divider();
    }
  }

  // Section 7: Source documents (extracted facts)
  newPage();
  header("VII. Original letter(s) and supporting documents (extracted)");
  for (const d of body.documents) {
    if (y < 120) newPage();
    paragraph(`${d.title} — ${d.kind}`, { font: "bold", size: 10 });
    if (d.issuing_authority) paragraph(`Authority: ${d.issuing_authority}`, { size: 9 });
    if (d.jurisdiction) paragraph(`Jurisdiction: ${d.jurisdiction}`, { size: 9 });
    if (d.deadline) paragraph(`Deadline: ${d.deadline}`, { size: 9 });
    for (const f of d.key_facts) paragraph(`•  ${f}`, { size: 9 });
    if (d.translated_summary) {
      y -= 2;
      paragraph(`Translated summary:`, { font: "bold", size: 9 });
      paragraph(d.translated_summary, { size: 9 });
    }
    if (d.flags.length > 0) {
      y -= 2;
      for (const f of d.flags) {
        paragraph(`${f.severity.toUpperCase()}: ${f.message}`, { size: 9 });
      }
    }
    divider();
  }

  return pdf.save();
}

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, "packet", 30, 60 * 60 * 1000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfter);

  let body: Body;
  try {
    body = BodySchema.parse(await request.json());
  } catch (e) {
    return Response.json(
      { error: `Invalid body: ${e instanceof Error ? e.message : String(e)}` },
      { status: 400 },
    );
  }

  try {
    const bytes = await buildPDF(body);
    const fname = `paperwork-${body.option.id}-${Date.now()}.pdf`;
    return new Response(bytes as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fname}"`,
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
