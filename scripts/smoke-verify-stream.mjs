import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetch, Agent } from "undici";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "..", "public", "demo", "uk-dwp.json");
const demo = JSON.parse(readFileSync(FILE, "utf8"));
const BASE = process.env.PAPERWORK_BASE ?? "http://localhost:3000";

console.log(`[t0] streaming verify against ${BASE}/api/verify`);
const dispatcher = new Agent({ bodyTimeout: 600_000, headersTimeout: 600_000 });
const start = Date.now();

const r = await fetch(`${BASE}/api/verify`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  },
  body: JSON.stringify({
    response: demo.response,
    jurisdiction_hint: "United Kingdom",
  }),
  dispatcher,
});
console.log(`[+${Math.round((Date.now() - start) / 1000)}s] HTTP ${r.status} | content-type: ${r.headers.get("content-type")}`);
if (!r.ok) {
  console.log(await r.text());
  process.exit(1);
}

const reader = r.body.getReader();
const dec = new TextDecoder();
let buf = "";
let extracted = 0;
let working = 0;
let done = 0;
let finalRes = null;

while (true) {
  const { value, done: streamDone } = await reader.read();
  if (streamDone) break;
  buf += dec.decode(value, { stream: true });
  let idx;
  while ((idx = buf.indexOf("\n\n")) !== -1) {
    const frame = buf.slice(0, idx);
    buf = buf.slice(idx + 2);
    const line = frame.split("\n").find((l) => l.startsWith("data: "));
    if (!line) continue;
    let evt;
    try {
      evt = JSON.parse(line.slice(6));
    } catch {
      continue;
    }
    const dt = Math.round((Date.now() - start) / 1000);
    if (evt.type === "extracted") {
      extracted = evt.citations.length;
      console.log(`[+${dt}s] extracted ${extracted} citations`);
      for (const c of evt.citations) console.log(`    - ${c.id}: ${c.text}`);
    } else if (evt.type === "verifier_working") {
      working++;
      console.log(`[+${dt}s] verifier_working: ${evt.citation_id} (${working}/${extracted})`);
    } else if (evt.type === "verifier_done") {
      done++;
      const v = evt.verification;
      console.log(`[+${dt}s] verifier_done [${v.status}] ${v.citation_id} -> ${v.source_url ?? "(no url)"}`);
    } else if (evt.type === "final") {
      finalRes = evt.result;
      console.log(`[+${dt}s] final: summary=${JSON.stringify(evt.result.summary)}`);
    } else if (evt.type === "error") {
      console.log(`[+${dt}s] ERROR: ${evt.message}`);
      process.exit(1);
    }
  }
}

if (!finalRes) {
  console.log("no final received");
  process.exit(1);
}
console.log(`OK — extracted=${extracted}, done=${done}, summary OK=${JSON.stringify(finalRes.summary)}`);
