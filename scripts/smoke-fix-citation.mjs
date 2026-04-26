import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetch, Agent } from "undici";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "..", "public", "demo", "uk-dwp-corrupted.json");
const demo = JSON.parse(readFileSync(FILE, "utf8"));
const BASE = process.env.PAPERWORK_BASE ?? "http://localhost:3000";

const mismatch = demo.verification.verifications.find(
  (v) => v.status === "mismatch" || v.status === "not_found",
);
if (!mismatch) {
  console.log("no mismatch in corrupted demo — nothing to fix");
  process.exit(1);
}
const cit = demo.verification.citations.find((c) => c.id === mismatch.citation_id);
console.log(`fixing citation: ${cit.text} (status=${mismatch.status})`);
console.log(`verifier said: ${mismatch.notes}`);
console.log(`correct source: ${mismatch.source_url}`);
console.log("");

const dispatcher = new Agent({ bodyTimeout: 300_000, headersTimeout: 300_000 });
const start = Date.now();
const r = await fetch(`${BASE}/api/fix-citation`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    response: demo.response,
    citation: cit,
    verification: mismatch,
  }),
  dispatcher,
});
console.log(`HTTP ${r.status} in ${Math.round((Date.now() - start) / 1000)}s`);
const json = await r.json();
if (!r.ok) {
  console.log("error:", json);
  process.exit(1);
}
console.log("changed:", json.changed);
console.log("notes:", json.notes);
console.log("--- BEFORE excerpt ---");
console.log(json.before_excerpt);
console.log("--- AFTER excerpt ---");
console.log(json.after_excerpt);
console.log("--- response_text length:", json.response.response_text.length);

// Sanity: did the bad citation actually disappear?
const stillContainsReg19 =
  json.response.response_text.match(/regulation 19 of the Universal Credit Regulations 2013/gi) || [];
const containsReg18 =
  json.response.response_text.match(/regulation 18 of the Universal Credit Regulations 2013/gi) || [];
console.log(
  `\nreg 19 occurrences in fixed letter: ${stillContainsReg19.length} (expect 0)`,
);
console.log(
  `reg 18 occurrences in fixed letter: ${containsReg18.length} (expect >= 1)`,
);
console.log(stillContainsReg19.length === 0 && containsReg18.length > 0 ? "✓ FIX OK" : "✗ FIX BROKEN");
