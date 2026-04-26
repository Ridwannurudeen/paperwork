import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetch, Agent } from "undici";

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLES = join(HERE, "..", "samples");
const BASE = process.env.PAPERWORK_BASE ?? "http://localhost:3000";

const longAgent = new Agent({ bodyTimeout: 900_000, headersTimeout: 900_000 });

function banner(s) {
  console.log(`\n${"═".repeat(70)}\n  ${s}\n${"═".repeat(70)}`);
}

async function ingest(filename) {
  const bytes = await readFile(join(SAMPLES, filename));
  const blob = new Blob([bytes], { type: "application/pdf" });
  const fd = new FormData();
  fd.append("file", blob, filename);
  const res = await fetch(`${BASE}/api/ingest`, { method: "POST", body: fd, dispatcher: longAgent });
  const body = await res.json();
  if (!res.ok) throw new Error(`ingest ${filename}: ${body.error ?? res.status}`);
  return body;
}

async function analyze(documents, free_text_context) {
  try {
    const res = await fetch(`${BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents, free_text_context }),
      dispatcher: longAgent,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`analyze: ${body.error ?? res.status}`);
    return body.analysis;
  } catch (e) {
    const cause = e.cause ? ` | cause=${e.cause.code ?? e.cause.message ?? JSON.stringify(e.cause)}` : "";
    throw new Error(`analyze: ${e.message}${cause}`);
  }
}

async function draft(documents, option, free_text_context) {
  const res = await fetch(`${BASE}/api/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents, option, free_text_context }),
    dispatcher: longAgent,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`draft ${option.name}: ${body.error ?? res.status}`);
  return body.response;
}

async function main() {
  banner("1/3  INGEST — vision extraction");
  const files = (await readdir(SAMPLES)).filter((f) => f.endsWith(".pdf")).sort();
  const extracted = [];
  for (const f of files) {
    const t0 = Date.now();
    const { document, filename } = await ingest(f);
    const ms = Date.now() - t0;
    console.log(
      `  ✓ ${filename} (${ms}ms) → kind=${document.kind}, authority=${document.issuing_authority ?? "—"}, deadline=${document.deadline ?? "—"}, facts=${document.key_facts.length}`,
    );
    extracted.push(document);
  }

  const artifactsDir = join(HERE, "..", "test-artifacts");
  await mkdir(artifactsDir, { recursive: true });
  await writeFile(
    join(artifactsDir, "last-ingest.json"),
    JSON.stringify({ documents: extracted }, null, 2),
  );
  console.log(`\n  (ingest saved → test-artifacts/last-ingest.json)`);

  const userContext =
    "The GBP 15,300 in my account on 14 March was a temporary transfer from my brother Kwame who was closing his UK account to move to Ghana. I returned it to him three days later. It was never my money. I'm a single dad of a 6-year-old and depend on Universal Credit to make rent.";

  banner("2/3  ANALYZE — ranked response options");
  const t1 = Date.now();
  const analysis = await analyze(extracted, userContext);
  console.log(`  analyzer returned in ${Date.now() - t1}ms`);
  console.log(`\n  Recommendation:\n  ${analysis.recommendation}\n`);
  console.log(`  Options (${analysis.options.length}):`);
  for (const o of analysis.options) {
    console.log(
      `    [${o.recommendation.padEnd(16)}] ${o.name} (${o.category})`,
    );
  }

  const top =
    analysis.options.find((o) => o.recommendation === "strong") ??
    analysis.options[0];
  banner(`3/3  DRAFT — response for "${top.name}"`);
  const t2 = Date.now();
  const response = await draft(extracted, top, userContext);
  console.log(`  drafter returned in ${Date.now() - t2}ms`);
  console.log(
    `\n  language: ${response.language} | attachments: ${response.attachments_needed.length} | next_steps: ${response.next_steps.length} | weak_points: ${response.weak_points.length}`,
  );
  console.log(
    `  response_text: ${response.response_text.length} chars, ${response.response_text.split(/\s+/).length} words`,
  );
  console.log(`\n  --- response preview (first 1000 chars) ---\n`);
  console.log(
    response.response_text.slice(0, 1000) +
      (response.response_text.length > 1000 ? "\n...[truncated]" : ""),
  );

  await writeFile(
    join(artifactsDir, "last-e2e.json"),
    JSON.stringify(
      { documents: extracted, analysis, option: top, response, free_text_context: userContext },
      null,
      2,
    ),
  );
  console.log(`\n  saved → test-artifacts/last-e2e.json`);

  banner("E2E PASS");
}

main().catch((e) => {
  console.error(`\nE2E FAILED: ${e.message}`);
  process.exit(1);
});
