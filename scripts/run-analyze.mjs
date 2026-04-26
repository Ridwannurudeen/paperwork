import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetch, Agent } from "undici";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PAPERWORK_BASE ?? "http://localhost:3000";

const longAgent = new Agent({ bodyTimeout: 600_000, headersTimeout: 600_000 });

async function main() {
  const data = JSON.parse(
    await readFile(join(HERE, "..", "test-artifacts", "last-ingest.json"), "utf8"),
  );
  const userContext =
    "The GBP 15,300 in my account on 14 March was a temporary transfer from my brother Kwame who was closing his UK account to move to Ghana. I returned it to him three days later. It was never my money. I'm a single dad of a 6-year-old and depend on Universal Credit to make rent.";

  console.log(`analyze: ${BASE}/api/analyze — ${data.documents.length} docs`);
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents: data.documents, free_text_context: userContext }),
    dispatcher: longAgent,
  });
  const ms = Date.now() - t0;
  console.log(`analyze: HTTP ${res.status} in ${ms}ms`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? String(res.status));
  console.log(`options: ${body.analysis.options.length}`);
  console.log(`recommendation: ${body.analysis.recommendation}\n`);
  for (const o of body.analysis.options) {
    console.log(`  [${o.recommendation}] ${o.name} (${o.category})`);
  }
  await writeFile(
    join(HERE, "..", "test-artifacts", "last-analysis.json"),
    JSON.stringify(body.analysis, null, 2),
  );
}

main().catch((e) => {
  console.error(`analyze failed: ${e.message} | cause=${e.cause?.code ?? e.cause?.message ?? ""}`);
  process.exit(1);
});
