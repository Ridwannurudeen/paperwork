# Paperwork

Answer the letter.

Paperwork reads adverse letters from any government, in any language, and produces a defensible response packet — drafted, adversarially stress-tested against the issuing authority, and grounded in primary legal sources via web search before a single citation is written.

Built on Claude Opus 4.7 (vision + long-running reasoning + web search).

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
