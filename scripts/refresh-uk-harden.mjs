import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetch, Agent } from "undici";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "..", "public", "demo", "uk-dwp.json");
const demo = JSON.parse(readFileSync(FILE, "utf8"));
console.log("[t0] starting harden against grounded UK draft");
const dispatcher = new Agent({ bodyTimeout: 1_200_000, headersTimeout: 1_200_000 });

const start = Date.now();
const r = await fetch("https://passage.gudman.xyz/api/harden", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    documents: demo.documents,
    option: demo.option,
    response: demo.response,
    max_iterations: 1,
  }),
  dispatcher,
});
console.log(`[+${Math.round((Date.now() - start) / 1000)}s] HTTP ${r.status}`);
if (!r.ok) {
  const t = await r.text();
  console.log("error body:", t.slice(0, 400));
  process.exit(1);
}

const reader = r.body.getReader();
const dec = new TextDecoder();
let buf = "";
let finalEvt = null;
let count = 0;
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  let idx;
  while ((idx = buf.indexOf("\n\n")) !== -1) {
    const frame = buf.slice(0, idx);
    buf = buf.slice(idx + 2);
    const line = frame.split("\n").find((l) => l.startsWith("data: "));
    if (!line) continue;
    try {
      const evt = JSON.parse(line.slice(6));
      count++;
      const dt = Math.round((Date.now() - start) / 1000);
      if (evt.type === "counterparty_done")
        console.log(
          `[+${dt}s] counterparty_done: ${evt.weaknesses.length} weaknesses, rejection=${evt.rejection_likelihood}`,
        );
      if (evt.type === "researcher_done")
        console.log(
          `[+${dt}s] researcher_done: ${evt.weakness_id} (${evt.evidence_count} evidence)`,
        );
      if (evt.type === "reviser_done")
        console.log(
          `[+${dt}s] reviser_done: preview ${evt.response_preview.length} chars`,
        );
      if (evt.type === "error") {
        console.log(`[+${dt}s] ERROR: ${evt.message}`);
        process.exit(1);
      }
      if (evt.type === "final") finalEvt = evt;
    } catch {}
  }
}
if (!finalEvt) {
  console.log("no final event");
  process.exit(1);
}
const elapsed = Math.round((Date.now() - start) / 1000);
console.log(`[+${elapsed}s] FINAL — total events: ${count}`);

demo.hardened = {
  original_response: finalEvt.original_response,
  final_response: finalEvt.final_response,
  iterations: finalEvt.iterations,
  evidence_binder: finalEvt.evidence_binder,
};
writeFileSync(FILE, JSON.stringify(demo));
const sz = statSync(FILE).size;
const match =
  demo.response.response_text === demo.hardened.original_response.response_text;
const reg46 = JSON.stringify(demo.hardened).match(/reg(\.|ulation)? ?46\b/g);
console.log(
  `saved ${FILE} (${sz} bytes) | match=${match} | reg46_hits=${reg46?.length ?? 0}`,
);
