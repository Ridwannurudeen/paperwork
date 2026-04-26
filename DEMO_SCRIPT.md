# Paperwork — 90-Second Demo Video Script

**Goal**: Hackathon-finalist-shaped pitch. The verifier moment is the kill shot. Done in 90 seconds — every cut earns its keep.

---

## Pre-record checklist

- [ ] Browser tabs ready: https://passage.gudman.xyz on desktop (1920×1080)
- [ ] Test the demo buttons twice end-to-end before recording — they must be instant
- [ ] Have a real letter on a kitchen table for the hook (any UK/US/EU government envelope works)
- [ ] Recording: OBS or Screen Studio with cursor zoom enabled
- [ ] Voiceover in Audacity, mixed in post; one quiet ambient bed, ducked under voice
- [ ] Captions burned in for the closing tagline only — not the demo (judges can read the UI)

---

## Beat sheet (timing assumes 90s; 120s gets one extra beat at the end)

### 0:00–0:08 · The hook

**On screen**: A pile of paper letters on a kitchen table — tax notice, benefit letter, visa refusal, court summons. Hand reaches in, picks up one, sets it down without opening.

**Voiceover**:
> *"Every adult gets two to four government letters a year that change their finances. The poor sign without reading. The middle pay £600 to a paralegal. The rich never see them. Everyone else loses by default."*

### 0:08–0:16 · Cut to the product. Skip the wait.

**On screen**: `passage.gudman.xyz` loads. Camera focuses on the green banner at the top:
> ✓ Just looking? Skip the upload — load a finished case.

Cursor moves to **"Load honest demo"** and clicks.

**Voiceover**:
> *"Paperwork reads any adverse government letter and writes the response. Watch this on a real UK Universal Credit overpayment."*

### 0:16–0:32 · The response letter is already there

**On screen**: Stage jumps to the response. Scroll the response letter for ~6 seconds — full UK formal register, paragraph 4 about bare trust, paragraph 7 about the bank memo, the `[INSERT DATE]` placeholder for the user.

**Voiceover**:
> *"Six thousand words of UK welfare-tribunal-grade English. Cites the Social Security Act, the Universal Credit Regulations, DWP's own decision-maker manual. The kind of letter Citizens Advice charges three hours of caseworker time to draft."*

### 0:32–0:55 · **THE VERIFIER MOMENT** ⭐

**On screen**: Cursor moves to **"✓ Verify citations"** and clicks.

(In post: compress the actual ~3-minute verify call to ~6 seconds. Cut to the panel as soon as it populates.)

The Citation Verification panel renders. **5 verified · 0 mismatch · 0 not found.** Each row has a green badge.

Click the first row: `regulation 18 of the Universal Credit Regulations 2013`. The panel expands to show:
- Notes from the verifier
- A direct quote from legislation.gov.uk
- A clickable link

Click the link. A new tab opens at `https://www.legislation.gov.uk/uksi/2013/376/regulation/18`. Linger for 1 second. Cut back.

**Voiceover** (deliberate, paced):
> *"Every citation in that letter — every section, every regulation, every guidance reference — gets independently verified by a second agent. Against the actual statute. Five out of five, with the live URLs. You can click one and land on legislation.gov.uk yourself."*
>
> *(beat)*
>
> *"Show me another AI tool that does that."*

### 0:55–1:15 · The corrupted demo (the kill shot)

**On screen**: Click "Start over" → land back on home. Click the red **"✗ Load corrupted demo"** button.

Stage jumps to the response again — same letter, but with one citation deliberately mangled (`regulation 19` instead of `regulation 18`). The verification panel is **already populated**: **4 verified · 1 mismatch.**

Click the mismatch row. Panel expands. The verifier's notes read:
> *"The £16,000 prescribed capital limit under the Universal Credit Regulations 2013 (SI 2013/376) is set out in regulation 18, not regulation 19. The letter cites the wrong regulation number for this proposition."*

Followed by an exact quote from legislation.gov.uk reg 18 — the real £16k passage. Source URL points at `/regulation/18`, NOT the cited /19.

**Voiceover** (the mic-drop):
> *"And when the model gets it wrong, the verifier catches it. Quotes the actual passage from the actual statute. Tells the user exactly what's broken before a single envelope leaves the house."*

### 1:15–1:35 · The packet (the artifact the user keeps)

**On screen**: Cursor scrolls back up, clicks **"Download packet"**. A PDF lands. Open it. Scroll past the cover, past the response letter, **stop on Section II — "Citation verification"**. The audit table is right there in the PDF: same five verified rows, same URLs, ready to print.

**Voiceover**:
> *"The user downloads a packet — letter, attachments, deadlines, the citation audit table — ready to print, sign, send."*

### 1:35–1:50 · The brief multilingual flex (optional if pacing allows)

**On screen**: Snap cuts, two seconds each — three other test cases ingested in past runs. Just the document cards lighting up:
- French CAF prime d'activité
- Spanish AEAT requerimiento
- German Bürgergeld Aufhebungsbescheid

**Voiceover**:
> *"Same product. Same verifier. Different jurisdiction every time."*

### 1:50–2:00 · Close

**On screen**: Cut to the URL `passage.gudman.xyz` — clean — and below it the GitHub URL.

**Voiceover**:
> *"Paperwork. Built solo on Claude Opus 4.7. The source is public. The demo is one click away."*

---

## Voiceover delivery notes

- **Pace**: 135–145 words/minute. Slower at the verifier moment, slower at the kill shot.
- **Tone**: Grounded. Slightly serious. The product earns the swagger — don't push it.
- **No filler**: skip "today I'll show you", "in this demo", "let's take a look at". Open with the hook.
- **The pause matters**: the silence after *"Show me another AI tool that does that"* is the most valuable second in the video. Don't fill it.

## Captions

- Burn in English captions only on the **closing tagline**, not the demo body. The UI text is already English.
- For the multilingual flex: caption with the **jurisdiction label only** ("CAF · France", "AEAT · Spain"). Don't translate — the point is that the model handles it.

## Recording technical

- Resolution: 1920×1080, 60fps if possible (the verifier panel reveal looks better at 60)
- Use Screen Studio's auto-zoom on cursor for the verifier reveal and the corrupted-mismatch click
- Phone segment optional — the hook can be a static letter on a desk

## Editing

- Total cut: 1:30–1:50. **Do not over-run 2:00.**
- Hard cuts. No transitions.
- Color grade: the kitchen-table hook slightly cool and desaturated. The Paperwork screen captures neutral.
- Music: one ambient bed, quiet, ducked under voice. Stop the music for the *"Show me another AI tool that does that"* beat.

---

## What this video is NOT

- Not a feature tour
- Not a tutorial
- Not "here's what AI can do"
- Not generic "we built a thing"

It's **the verifier moment**, set up by the response letter and paid off by the corrupted demo. Everything else exists to make those 30 seconds land.

---

## Submission one-liner (for Cerebral Valley form)

> **Paperwork**: AI that reads adverse government letters and drafts a defensible response — every citation independently verified against legislation.gov.uk and other primary sources, every fabrication caught before it reaches the envelope. Multi-agent system on Claude Opus 4.7. Six jurisdictions tested end-to-end. Source public, demo one click away.

---

## Backup plan if the live demo fails to record

The pre-loaded demo case removes the failure mode where ingest takes too long. If the verifier call itself runs slow on the day of recording:

1. Record once with the full live verify (3 min). Speed up 25× in post.
2. Or: open with the **corrupted demo** first (it loads instantly with verification baked in), then jump to the honest demo. You lose the "live verifier" moment but keep the kill shot.
