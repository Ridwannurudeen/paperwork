import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetch, Agent } from "undici";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PAPERWORK_BASE ?? "http://localhost:3000";
const longAgent = new Agent({ bodyTimeout: 1_200_000, headersTimeout: 1_200_000 });

function banner(s) {
  console.log(`\n${"═".repeat(70)}\n  ${s}\n${"═".repeat(70)}`);
}

async function main() {
  const data = JSON.parse(
    await readFile(join(HERE, "..", "test-artifacts", "last-e2e.json"), "utf8"),
  );

  banner("HARDEN — adversarial loop (SSE stream)");
  const res = await fetch(`${BASE}/api/harden`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documents: data.documents,
      option: data.option,
      response: data.response,
      max_iterations: 1,
    }),
    dispatcher: longAgent,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`harden: HTTP ${res.status} ${body.slice(0, 500)}`);
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
      const evt = JSON.parse(line.slice(6));
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1).padStart(5);
      switch (evt.type) {
        case "started":
          console.log(`[${elapsed}s] started (max ${evt.max_iterations} iterations)`);
          break;
        case "iteration_started":
          console.log(`[${elapsed}s] ── iteration ${evt.iteration} ──`);
          break;
        case "counterparty_working":
          console.log(`[${elapsed}s]   counterparty reviewing…`);
          break;
        case "counterparty_done":
          console.log(
            `[${elapsed}s]   counterparty done: ${evt.weaknesses.length} weaknesses, rejection ${evt.rejection_likelihood}`,
          );
          for (const w of evt.weaknesses) {
            console.log(`              • [${w.severity}] ${w.title}`);
          }
          break;
        case "converged":
          console.log(`[${elapsed}s]   ✓ converged at iteration ${evt.iteration}`);
          break;
        case "research_dispatched":
          console.log(
            `[${elapsed}s]   researching ${evt.weakness_count} weaknesses in parallel…`,
          );
          break;
        case "researcher_working":
          console.log(`[${elapsed}s]     → ${evt.weakness_title}`);
          break;
        case "researcher_done":
          console.log(
            `[${elapsed}s]     ✓ ${evt.weakness_id}: ${evt.evidence_count} evidence items`,
          );
          break;
        case "researcher_failed":
          console.log(`[${elapsed}s]     ✗ ${evt.weakness_id}: ${evt.error}`);
          break;
        case "reviser_working":
          console.log(`[${elapsed}s]   reviser rewriting…`);
          break;
        case "reviser_done":
          console.log(
            `[${elapsed}s]   reviser done: attachments=${evt.new_attachment_count}`,
          );
          break;
        case "final":
          finalEvent = evt;
          console.log(`[${elapsed}s] FINAL received`);
          break;
        case "error":
          throw new Error(`server error: ${evt.message}`);
        default:
          console.log(`[${elapsed}s] ? ${evt.type}`);
      }
    }
  }

  if (!finalEvent) throw new Error("never received final event");

  const artifactsDir = join(HERE, "..", "test-artifacts");
  await mkdir(artifactsDir, { recursive: true });
  await writeFile(
    join(artifactsDir, "last-harden.json"),
    JSON.stringify(finalEvent, null, 2),
  );

  banner("HARDENED RESULT");
  console.log(`  iterations: ${finalEvent.iterations.length}`);
  console.log(`  total evidence items: ${finalEvent.evidence_binder.length}`);
  console.log(
    `  original response: ${finalEvent.original_response.response_text.length} chars`,
  );
  console.log(
    `  final response:    ${finalEvent.final_response.response_text.length} chars`,
  );
  console.log(
    `  original attachments: ${finalEvent.original_response.attachments_needed.length}`,
  );
  console.log(
    `  final attachments:    ${finalEvent.final_response.attachments_needed.length}`,
  );

  const urls = finalEvent.evidence_binder
    .filter((e) => e.source_url)
    .map((e) => e.source_url);
  console.log(`\n  evidence URLs gathered (${urls.length}):`);
  for (const u of urls.slice(0, 12)) console.log(`    ${u}`);
  if (urls.length > 12) console.log(`    ... +${urls.length - 12} more`);

  banner("HARDEN E2E PASS");
}

main().catch((e) => {
  console.error(`\nHARDEN FAILED: ${e.message}`);
  process.exit(1);
});
