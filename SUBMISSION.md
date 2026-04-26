# Cerebral Valley × Anthropic — "Built with Opus 4.7" Submission

**Project name**: Paperwork
**Live URL**: https://passage.gudman.xyz
**Tagline**: AI that reads adverse government letters and drafts a defensible response packet — citations verified against primary sources, hardened against the issuing authority.
**Team size**: Solo
**Build window**: April 21–26, 2026

---

## The pitch (60 words)

Paperwork reads any government letter — tax notice, benefit denial, visa refusal, court summons — in any language, from any country. Every option, citation, and draft is grounded against primary legal sources via web search before it lands; a counterparty agent then attacks the draft as the issuing authority and a researcher gathers public evidence to defend it. The user downloads a complete filing packet in their letter's language.

---

## The problem

Every adult in every country receives, on average, **2–4 government letters a year that materially affect their finances or rights**: a tax assessment, a benefit overpayment, a permit denial, a visa refusal, an eviction notice, a labor dispute summons.

The market for help is brutal:
- **The poor go silent.** They can't afford the £200/hr welfare advisor or the €400/hr immigration lawyer. So they ignore the letter or sign it. Either way, they lose.
- **The middle pay too much.** A simple tax-notice response costs £600–£1,500 from a UK accountant; an EB-1A petition costs $10,000–$20,000 in the US.
- **The rich don't notice.** They have lawyers on retainer.

The work itself is **adversarial reasoning over jurisdictional rules**. Citations matter. Register matters. Deadlines matter. This is exactly the work an LLM at the Opus 4.7 capability level can finally do credibly, and the work that smaller models hallucinate.

## The solution

Paperwork is a multi-agent system on **`claude-opus-4-7`** with five HTTP endpoints:

| Endpoint | Agent | What it does |
|---|---|---|
| `/api/ingest` | Vision extraction | Reads any PDF/image of a letter (any language). Classifies type, extracts authority, deadline, identifiers, key facts. Translates to English on the side. |
| `/api/analyze` | Strategy (grounded) | Returns a ranked list of every realistic response option (appeal, contest, negotiate, escalate, comply, ignore). Uses `web_search_20260209` to verify every statute, regulation, and case citation against primary sources before it lands. Refuses to fabricate a section number when the search budget can't confirm it — paraphrases instead. |
| `/api/draft` | Drafter (grounded) | Produces the response letter in the source language and proper legal register. Every cited statute/regulation/section number is web-verified before it enters the letter. |
| `/api/verify` | **Citation verifier** | An extractor pulls every legal citation out of the final draft (statute, regulation, schedule paragraph, case decision, agency guidance). A verifier agent then independently checks each one against a primary source via `web_search` and returns a per-citation status: `verified`, `mismatch`, `not_found`, `ambiguous`, or `skipped`. The UI surfaces a green/red badge per citation; the PDF packet embeds the same audit table. On the UK DWP demo case, 5/5 citations pass with primary-source URLs (legislation.gov.uk, gov.uk, england.shelter.org.uk). |
| `/api/harden` | **3-agent SSE loop** | Counterparty agent attacks the draft; Researcher agents use `web_search_20260209` in parallel to gather public evidence; Reviser rewrites. |
| `/api/packet` | Export | Downloadable PDF: cover, response, attachments, deadlines, evidence binder, original letters. |

The killer feature is the **input-grounded → output-verified** spine. The drafter cites only what `web_search` confirmed; the verifier then independently re-checks every citation in the finished letter against primary sources and shows the audit table to the user. A skeptical user (or judge) can click any citation and land on the exact section of legislation.gov.uk it was confirmed against.

`/api/harden` is the third leg: a counterparty agent reads the draft adversarially as the actual reviewing officer, finds 3–7 specific weaknesses (with the regulation each one will be rejected under), and dispatches researcher sub-agents in parallel to gather real public evidence. A reviser rewrites the draft using that evidence; the verifier can then be re-run on the hardened version.

Server-Sent Events stream every agent action live. The UI shows three columns: Counterparty (red), Researcher (blue), Reviser (green) — populating in real time over 5–10 minutes per case.

## Why Opus 4.7 specifically

Four capability bets that smaller models fail:

1. **Vision at depth on multi-page legal documents.** 4.7's vision upgrade was load-bearing for ingest — official letters are dense, multi-column, often poorly scanned.
2. **Long-running rigor.** A single harden cycle runs ~8 chained API calls over 8–12 minutes. The reviser produces 6,000–10,000-character legal letters in the third revision pass without losing context. Smaller models drift and contradict themselves.
3. **Multilingual legal register.** Correct three-tier alternative pleading in French (*à titre principal / subsidiaire / infiniment subsidiaire*). Brazilian deferential register (*Ilustríssimo Senhor Delegado*). German social-law citations (*§11a Abs. 3 SGB II*). Spanish administrative formula (*comparece y, como mejor proceda en Derecho, DICE*). 4.7 produces all of these correctly. 4.5 and below confabulate citations that don't exist.
4. **Web-search server tool agency at every legal-grounding stage.** Analyze, draft, and the researcher agents all autonomously decide what to query, when to stop, and what to keep. Not a tool-call harness — genuine agent behavior using the `web_search_20260209` server tool. The drafter actively refuses to write a section number it cannot verify and paraphrases the legal point instead — verified behavior on the UK DWP demo case, where it correctly declined to invent a disregard-regulation number under the UC Regs and surfaced a separate s.71-vs-s.71ZB defective-citation argument the un-grounded run missed entirely.

## End-to-end verification on six real-case-shaped scenarios

Each anchored to a public forum thread by a real human in real bureaucratic distress. Letters reconstructed from public posts; user identities synthetic. All run live against production:

| Case | Country | Language | Source | Status |
|---|---|---|---|---|
| Universal Credit overpayment | UK | English | r/UniversalCredit shape | E2E ✓ |
| TRV refusal — Egyptian engineer in Germany | Canada | English | canadavisa.com 874788 | E2E ✓ |
| Prime d'activité clawback — single mother | France | French | alexia.fr 451433 | E2E ✓ |
| AEAT requerimiento — Madrid autónomo | Spain | Spanish | rankia.com forum | E2E ✓ |
| Receita Federal auto de infração — São Paulo MEI | Brazil | Portuguese | jusbrasil article | E2E ✓ |
| Bürgergeld Aufhebungsbescheid — Berlin alleinerziehend | Germany | German | hartz4widerspruch.de pattern | E2E ✓ |

Each case end-to-end produced a 6,000–10,000-character response letter in the source language with **10–14 verifiable URLs** to authoritative sources (legifrance.gouv.fr, sede.agenciatributaria.gob.es, planalto.gov.br, laws-lois.justice.gc.ca, gov.uk, juricaf.org Cour de cassation decisions, BOE, STJ Súmula 360, USCIS Policy Manual, USCIS regs).

## The public-case methodology

Every demo case starts from a real publicly-posted forum thread. The applicant's letter is reconstructed from the OP's description with the real numbers, dates, and authorities preserved; identifying details are synthetic. This means:

- The pain is real
- The citations are testable
- The output can be compared against the forum's top advice — and consistently outperforms it on coverage, register, and citation quality

## Architecture

- **Stack**: Next.js 16 App Router, TypeScript, Tailwind v4, Anthropic SDK 0.91.0
- **Runtime**: Node.js 23.11 on Ubuntu 24.04 (Contabo VPS)
- **Streaming**: native ReadableStream + SSE with 10-second heartbeats; nginx tuned for 900s long-poll
- **Validation**: zod schemas at every model boundary — every JSON output is parsed and rejected if malformed
- **No DB**: case state is client-side in the React tree; nothing persisted server-side after the response is delivered
- **No auth**: every session is anonymous and ephemeral

Live demo at `https://passage.gudman.xyz`. Source at `https://github.com/Ridwannurudeen/paperwork`.

## Methodology — how the trust layer works

Most AI-legal tools fail in the same way: the model produces a citation, the user has no way to know if it's real, and the user finds out by sending an unsendable letter to an authority. Paperwork inverts this with two checkpoints:

**1. Input grounding** (analyze + draft, both tool-calling). Every option ranking and every drafted letter is generated by an Opus 4.7 call equipped with `web_search_20260209` and a system prompt that explicitly forbids citing section numbers from memory. When the search budget cannot confirm a specific number, the model is instructed to paraphrase the legal point rather than guess. We verified this empirically on the UK DWP demo: the un-grounded model previously cited "regulation 46 UC Regs 2013" eight times for the bare-trust disregard (regulation 46 is "What is included in capital", not the bare-trust disregard); the grounded model declined to cite a specific disregard regulation number and paraphrased instead. Same prompt, same case file, different epistemic posture.

**2. Output verification** (verify route). After the draft is finished, an extractor agent pulls every legal citation from the response text into a structured list. A verifier agent — also tool-calling — independently checks each one against a primary source (legislation.gov.uk, eur-lex, gov.uk, agency portals, court registries) and returns a status: `verified`, `mismatch`, `not_found`, `ambiguous`, or `skipped`. The user sees the audit table in the UI and again in the downloadable packet PDF. Each verified citation includes the exact text quoted from the source and a clickable URL.

The two checkpoints are independent. Grounding makes the model less likely to fabricate; verification catches it when grounding fails. Demonstrated on a deliberately-corrupted variant of the UK DWP draft: when "regulation 18" is mangled to "regulation 19" in the letter text, the verifier returns `mismatch` for that citation alone, links to the correct legislation.gov.uk regulation-18 page, and quotes the actual £16,000 capital-limit passage. Public artifact at `/demo/uk-dwp-corrupted.json`.

## Failure modes (what we know breaks)

- **Long-tail jurisdictions**: Opus 4.7's prior knowledge is excellent for OECD jurisdictions and weaker for, e.g., Vietnamese tax procedure or Egyptian labor disputes. The verifier degrades gracefully (returns `ambiguous` rather than fabricating), but option coverage in the analyze step will be thinner.
- **Right-to-left and CJK PDF rendering**: v1 embeds Noto Sans (Latin/Cyrillic/Greek). Arabic, Hebrew, and CJK draft text renders correctly in the browser but the PDF packet is currently disabled in the UI for those languages. Roadmap: add Noto Sans Arabic + Noto Sans CJK on demand (adds ~3 MB; trivial work).
- **Statutes without machine-addressable URLs**: legislation.gov.uk indexes UK SI numbers cleanly; eur-lex is patchier; some jurisdictions (e.g. Saudi Arabia) publish gazette PDFs that resist citation. Verifier returns `ambiguous` with notes; user is told what they would need to confirm offline.
- **Web search false positives**: occasionally the verifier finds a Westlaw summary or a third-party blog before the primary source and returns `verified` based on a secondary. Mitigation: the prompt prefers primary sources by name, and the response includes the URL the user can sanity-check.
- **Web search service outage**: if Anthropic's web_search server tool returns no results, the verifier returns `ambiguous` with notes; the analyze and draft steps fall back to paraphrasing without citation numbers. The product degrades to "still useful, less precise" rather than "produces wrong citations."

## Future work

1. **One real human case end-to-end** with permission to publish the anonymized result. The single highest-leverage credibility move; planned for the post-submission window via Reddit-community outreach.
2. **Comparison to baseline**: side-by-side output against Citizens Advice's UC overpayment template and a paralegal-scored rubric on five dimensions (legal precision, register, completeness, deadline awareness, attachment list). Targeted by week 2.
3. **Persistent shareable receipt URLs**: every case gets an anonymized public audit page (`/r/{id}`) showing the redacted letter, agent transcript, citation verification table, and evidence binder. Inverts AI-legal-tech from "trust us" to "audit us."
4. **RTL + CJK fonts** in the packet PDF. Trivial work; deferred only because the test cases above don't exercise it.
5. **Lawyer hand-off** for cases the verifier flags as "ambiguous" or where the user is escalating to court. Revenue model + product becomes an on-ramp, not a substitute.

## What's intentionally not in v1

- **No "smart" jurisdictional routing** — Opus 4.7's prior knowledge handles every jurisdiction we tested. We don't need a country selector.
- **No persistent user account** — letters are deeply personal; we keep zero record after the session.
- **No payment** — free, forever, by intent.
- **No legal-firm partnerships** — the goal is the 80% who never call a lawyer.

## Honest limitations

- **PDF packet glyph coverage**: v1 embeds Noto Sans for Latin (extended), Cyrillic, and Greek scripts — covering every test-case language above plus Polish, Romanian, Ukrainian, etc. Arabic, Hebrew, and CJK PDFs are roadmap (one font swap away — adds ~2 MB to the build).
- **Public deployment is rate-limited.** Each IP gets 30 ingests, 10 analyses, 10 drafts, and 3 hardens per hour — these are demo cost-caps, not product caps. Run locally for unlimited use; the README is one `npm install` away.
- **One-shot harden by default**: the UI ships with `max_iterations: 2`. The server caps weaknesses-per-iteration at 3 to keep the demo under 15 minutes; this is a dial, not a ceiling.
- **No human eval suite shipped.** Verification above is end-to-end correctness on six public-thread-anchored cases plus citation-grounding on the UK DWP demo (the model declined to fabricate a disregard-regulation number under the UC Regs and surfaced an s.71-vs-s.71ZB defective-citation argument the un-grounded run missed). A formal expert-review eval is the next milestone.

## Disclaimer

Paperwork is not a law firm and does not provide legal advice. Every output is a draft for human review. Each response_text closes with a disclaimer in the document's source language.

## Team

Solo. Self-funded. No prior law-firm or government-services experience — built because watching family in three countries lose sleep over letters they couldn't read was a reasonable enough excuse.

## Contact

[Your email]
[Your X handle]
GitHub: https://github.com/Ridwannurudeen/paperwork
