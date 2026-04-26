// Retry the harden phase for a case whose harden.json is missing.
// Usage:  node scripts/retry-harden.mjs <case-slug>

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetch as undiciFetch, Agent } from "undici";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const BASE = process.env.PAPERWORK_BASE ?? "http://localhost:3000";
const longAgent = new Agent({ bodyTimeout: 1_800_000, headersTimeout: 1_800_000 });

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("usage: node scripts/retry-harden.mjs <case-slug>");
    process.exit(2);
  }
  const dir = join(ROOT, "test-artifacts", slug);

  const ingest = JSON.parse(await readFile(join(dir, "ingest.json"), "utf8"));
  const analysis = JSON.parse(await readFile(join(dir, "analysis.json"), "utf8"));
  const draft = JSON.parse(await readFile(join(dir, "draft.json"), "utf8"));
  const documents = ingest.documents;
  const option = draft.option;
  const response = draft.response;

  console.log(`harden retry for ${slug} (option=${option.id}, lang=${response.language})`);

  const res = await undiciFetch(`${BASE}/api/harden`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents, option, response, max_iterations: 1 }),
    dispatcher: longAgent,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status}: ${t.slice(0, 300)}`);
  }
  if (!res.body) throw new Error("no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let finalEvent = null;
  const t0 = Date.now();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      try {
        const evt = JSON.parse(line.slice(6));
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1).padStart(5);
        if (evt.type === "counterparty_done")
          console.log(`[${elapsed}s] counterparty: ${evt.weaknesses.length} weaknesses, rejection=${evt.rejection_likelihood}`);
        else if (evt.type === "researcher_done")
          console.log(`[${elapsed}s] researcher ${evt.weakness_id}: ${evt.evidence_count} evidence`);
        else if (evt.type === "researcher_failed")
          console.log(`[${elapsed}s] researcher ${evt.weakness_id} FAILED: ${evt.error}`);
        else if (evt.type === "reviser_working")
          console.log(`[${elapsed}s] reviser working...`);
        else if (evt.type === "reviser_done")
          console.log(`[${elapsed}s] reviser done, attachments=${evt.new_attachment_count}`);
        else if (evt.type === "final") finalEvent = evt;
        else if (evt.type === "error") throw new Error(`server: ${evt.message}`);
      } catch {}
    }
  }

  if (!finalEvent) throw new Error("never received final");

  await writeFile(join(dir, "harden.json"), JSON.stringify(finalEvent, null, 2));
  console.log(`saved → ${join(dir, "harden.json")}`);
  console.log(`evidence URLs: ${finalEvent.evidence_binder.filter((e) => e.source_url).length}`);
  console.log(`${finalEvent.original_response.response_text.length} → ${finalEvent.final_response.response_text.length} chars`);
}

main().catch((e) => {
  console.error(`RETRY FAILED: ${e.message} | cause=${e.cause?.code ?? ""}`);
  process.exit(1);
});
