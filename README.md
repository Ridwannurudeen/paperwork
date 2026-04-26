# Paperwork

Answer the letter.

Paperwork reads adverse letters from any government, in any language, and produces a defensible response packet — drafted, adversarially stress-tested against the issuing authority, and grounded in primary legal sources via web search before a single citation is written.

Built on Claude Opus 4.7 (vision + long-running reasoning + web search).

## Try it without uploading anything

Open https://passage.gudman.xyz and click one of the three demo buttons at the top. Each loads a finished case instantly — letter, options, response, citation audit table, and a pre-recorded harden run already populated.

| Demo | What you'll see |
|---|---|
| 🇬🇧 **UK · 5/5 verified** | UK Universal Credit overpayment, full draft response, citation panel: 5/5 green. Click any row → land on legislation.gov.uk, see the exact passage quoted. |
| 🇩🇪 **DE · German welfare appeal** | Bürgergeld Aufhebungsbescheid response in German legal register, 13 citations checked against gesetze-im-internet.de — 11 green, 2 honest mismatches the verifier flags for the user to investigate. |
| ✗ **Corrupted draft** | Same UK case with one citation deliberately mangled (`regulation 18` → `regulation 19`). The verifier returns 4/5 verified + 1 mismatch, links to the *correct* /regulation/18 page, and quotes the actual £16,000 passage. The "we caught our own fake" beat. |

The verifier is a separate agent that extracts every citation from the draft and checks each one against a primary source via `web_search`. Status per citation: `verified`, `mismatch`, `not_found`, `ambiguous`, or `skipped`. Source URL + exact quote attached to every verified row.

![Verifier panel — UK case, 5/5 verified](docs/verifier-panel.png)

> _Drop your own screenshot at `docs/verifier-panel.png` — the demo on the live site is one click away if you'd rather grab it there._

## Stack

- Next.js 16 (App Router, Turbopack)
- TypeScript, Tailwind v4
- `@anthropic-ai/sdk` — `claude-opus-4-7`
- `web_search` server tool — every statute, regulation, or case citation is verified against primary sources (legislation.gov.uk, eur-lex, agency portals) before it lands in your draft
- `zod` — strict validation of model output
- `pdf-lib` — assembled response packet with cover letter + draft + evidence binder

## Run locally

```bash
cp .env.local.example .env.local
# paste your ANTHROPIC_API_KEY into .env.local
npm install
npm run dev
```

Open http://localhost:3000.

## Flow

1. **Ingest** (`/api/ingest`) — drop PDFs or images; Opus 4.7 classifies each document, extracts dates/identifiers/names/deadlines, and flags expirations, mismatches, unsigned letters.
2. **Analyze** (`/api/analyze`) — returns every realistic response option for the matter (appeal, contest, negotiate, extension, escalate, comply), ranked strong/viable/weak. Every legal citation in this stage is web-verified.
3. **Draft** (`/api/draft`) — given the chosen option, produces the actual response letter in the source language, in proper legal register for the issuing authority, with web-verified statutes/regulations and an attachments list.
4. **Harden** (`/api/harden`, SSE) — three adversarial agents loop over the draft: one plays the counterparty officer and finds every weakness, one researches public evidence to address each weakness, one revises the draft with the new evidence. Streams progress back to the UI.
5. **Packet** (`/api/packet`) — assembles cover letter + revised draft + evidence binder + checklist into a single downloadable PDF.

## Why this exists

Across every jurisdiction, the same pattern repeats: an authority sends a letter, the deadline is short, a paid advisor is unaffordable, and the recipient either ignores it or signs it. Both ways they lose. Paperwork compresses the work of a junior caseworker — research, drafting, anticipating counterparty objections, citing primary law — into a single session, and refuses to invent citations the model cannot verify.

## What isn't in this repo

- No auth — sessions are in-memory / client state.
- No database — case state lives in the browser until you download the packet.
- No attorney.
- No guarantees. Every draft is labeled for human review.

## Disclaimer

Paperwork is not a law firm and does not provide legal advice. Every output is a draft for your review. You are responsible for the accuracy of anything you submit to any authority.
