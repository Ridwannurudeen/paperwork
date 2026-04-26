import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetch, Agent } from "undici";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PAPERWORK_BASE ?? "http://localhost:3000";
const longAgent = new Agent({ bodyTimeout: 900_000, headersTimeout: 900_000 });

async function main() {
  const ingest = JSON.parse(
    await readFile(join(HERE, "..", "test-artifacts", "last-ingest.json"), "utf8"),
  );
  const analysis = JSON.parse(
    await readFile(join(HERE, "..", "test-artifacts", "last-analysis.json"), "utf8"),
  );
  const top =
    analysis.options.find((o) => o.recommendation === "strong") ?? analysis.options[0];
  const userContext =
    "The GBP 15,300 in my account on 14 March was a temporary transfer from my brother Kwame who was closing his UK account to move to Ghana. I returned it to him three days later. It was never my money. I'm a single dad of a 6-year-old and depend on Universal Credit to make rent.";

  console.log(`draft: ${BASE}/api/draft — option="${top.name}"`);
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documents: ingest.documents,
      option: top,
      free_text_context: userContext,
    }),
    dispatcher: longAgent,
  });
  const ms = Date.now() - t0;
  console.log(`draft: HTTP ${res.status} in ${ms}ms`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? String(res.status));
  const r = body.response;
  console.log(
    `language=${r.language} | chars=${r.response_text.length} | attachments=${r.attachments_needed.length} | next_steps=${r.next_steps.length} | weak_points=${r.weak_points.length}`,
  );
  console.log(`\n--- response preview ---\n`);
  console.log(r.response_text.slice(0, 1500));
  console.log(r.response_text.length > 1500 ? "\n...[truncated]" : "");

  await writeFile(
    join(HERE, "..", "test-artifacts", "last-e2e.json"),
    JSON.stringify(
      { documents: ingest.documents, analysis, option: top, response: r, free_text_context: userContext },
      null,
      2,
    ),
  );
  console.log("\nsaved → test-artifacts/last-e2e.json");
}

main().catch((e) => {
  console.error(`draft failed: ${e.message} | cause=${e.cause?.code ?? ""}`);
  process.exit(1);
});
