import { NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { jsonMessage } from "@/lib/anthropic";
import { INGEST_SYSTEM } from "@/lib/prompts";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { ExtractedDocumentSchema, type ExtractedDocument } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const ACCEPTED_IMAGE = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, "ingest", 30, 60 * 60 * 1000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfter);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "Expected multipart/form-data with a 'file' field." },
      { status: 400 },
    );
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded (field name 'file')" }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return Response.json({ error: "File exceeds 20 MB limit" }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");

  let source: Anthropic.Messages.ImageBlockParam["source"] | Anthropic.Messages.DocumentBlockParam["source"];
  let blockType: "image" | "document";

  if (file.type === "application/pdf") {
    source = { type: "base64", media_type: "application/pdf", data: base64 };
    blockType = "document";
  } else if (ACCEPTED_IMAGE.has(file.type)) {
    source = {
      type: "base64",
      media_type: file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
      data: base64,
    };
    blockType = "image";
  } else {
    return Response.json(
      { error: `Unsupported file type: ${file.type}. Use PDF, JPEG, PNG, GIF, or WEBP.` },
      { status: 415 },
    );
  }

  const userContent: Anthropic.Messages.ContentBlockParam[] = [
    blockType === "image"
      ? { type: "image", source: source as Anthropic.Messages.ImageBlockParam["source"] }
      : { type: "document", source: source as Anthropic.Messages.DocumentBlockParam["source"] },
    {
      type: "text",
      text: `Filename: ${file.name}\n\nExtract everything relevant. Return the JSON object only.`,
    },
  ];

  try {
    const parsed = await jsonMessage<unknown>({
      system: INGEST_SYSTEM,
      user: [{ role: "user", content: userContent }],
      schemaName: "ingest",
      maxTokens: 4000,
    });
    const validated: ExtractedDocument = ExtractedDocumentSchema.parse(parsed);
    return Response.json({ document: validated, filename: file.name });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
