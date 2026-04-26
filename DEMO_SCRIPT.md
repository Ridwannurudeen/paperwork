# Paperwork — 2-Minute Demo Video Script

**Goal**: 1st-place-shaped pitch. Visceral opening. Multi-language flex. 3-agent loop visible. Tangible output. Done in 120 seconds.

---

## Pre-record checklist

- [ ] Two browser tabs ready: https://passage.gudman.xyz on a phone (or simulated mobile) AND on desktop
- [ ] Five test letters printed and stacked on a real table:
  1. UK DWP Universal Credit overpayment (English)
  2. IRCC visa refusal (English)
  3. CAF notification d'indu (French)
  4. AEAT requerimiento (Spanish)
  5. Receita Federal auto de infração (Portuguese)
- [ ] Pre-loaded `harden.json` outputs from `test-artifacts/{case}/` ready to scrub through
- [ ] Phone with PDF or photos of the 5 letters
- [ ] Recording: OBS or Screen Studio. Voiceover in Audacity, mixed in post.
- [ ] Captions burned in (especially the French/German/Spanish/Portuguese letters — most judges only read English)

---

## Beat sheet

### 0:00–0:08 · The hook (visceral, no Paperwork yet)

**On screen**: A pile of paper letters on a kitchen table. Hand reaches in, picks up the top one — it's in French. Then under it, English. Under that, Portuguese. Under that, German.

**Voiceover**:
> *"1.3 billion government letters arrive every year at the doors of people who can't fully read them, can't afford the lawyer who could, and don't know what they're allowed to do."*

### 0:08–0:18 · The product appears

**On screen**: Phone is held over the French letter. The Paperwork dropzone is on screen. User taps **"take a photo"**, snaps the letter, swipes up.

**Voiceover**:
> *"Paperwork is one tool that reads any government letter, in any language, from any country — and tells you exactly how to answer."*

### 0:18–0:35 · Vision extraction (the "wait, French?" moment)

**On screen**: The CAF document card populates in real-time. We see:
- `kind: benefit_review`
- `authority: Caisse d'Allocations Familiales (CAF) du Rhône — France`
- `language_detected: fr`
- `deadline: 2023-09-18` (highlighted red)
- The translated summary in English

**Voiceover**:
> *"It just read a French welfare-benefits letter — every fact, every deadline, the regulation it cites — without translation, without prep."*

### 0:35–0:50 · Pathway analysis (the depth flex)

**On screen**: Click "Show me my options". 6 options ranked appear. Camera zooms on the top option:
> *"Contest before Commission de Recours Amiable — invoke 2-year prescription on 2021 portion (article L.553-1 CSS)"*

**Voiceover**:
> *"It found six legal paths — strong, viable, weak — each citing the actual French Code de la sécurité sociale article. This is what costs €400 an hour at a French specialist advisor."*

### 0:50–1:25 · The harden loop (the killer feature)

**On screen**: Click **"Stress-test with opposition"**. Three columns appear: Counterparty (red), Researcher (blue), Reviser (green).

Time-lapse the harden loop — **compress the 10 minutes to 25 seconds**. Show:
- Counterparty card: 3 weaknesses popping in with severity tags
- Researcher card: 3 parallel queries firing, real URLs ticking in (legifrance.gouv.fr, juricaf.org Cour de cassation cases, defenseurdesdroits.fr) — each link clickable
- Reviser card: response_text rebuilding live

**Voiceover** (at this tempo):
> *"Now three agents go to war on the draft. One plays the CAF case officer and attacks. The second searches Legifrance, the Cour de cassation, the Défenseur des droits — pulls real, live URLs to defend each weakness. The third rewrites in proper French legal register."*
>
> *"Three-tier alternative pleading. Prescription biennale. Recours hiérarchique. Twelve verifiable citations. Ten minutes."*

### 1:25–1:40 · The polyglot flex (the kill shot)

**On screen**: Snap-cut montage. Five letters processed back-to-back, two seconds each:
- Spanish AEAT → "Don Carlos Ramírez Fernández... ante esa Administración comparece..."
- German Bürgergeld → "...gemäß §11a Abs. 3 SGB II..."
- Portuguese Receita → "ILUSTRÍSSIMO(A) SENHOR(A) DELEGADO(A)..."
- English IRCC → "...subsection 11(1) IRPA..."
- English UK DWP → "...regulation 7 of the Universal Credit Regulations 2013..."

**Voiceover**:
> *"Same product. Five jurisdictions. Five languages. Real legal register in every one."*

### 1:40–1:55 · The output the judge can hold

**On screen**: Click **"Download packet"**. A PDF lands. Open it. Scroll: cover page → response letter (French) → attachments needed → deadlines → evidence binder with twelve URLs → original letters.

**Voiceover**:
> *"The user gets a full filing packet. The response, the evidence, the deadlines, the citations. Ready to print, sign, send."*

### 1:55–2:00 · The close

**On screen**: Cut to the URL — `passage.gudman.xyz` — clean, no UI.

**Voiceover**:
> *"Paperwork. Built solo on Claude Opus 4.7, in one week. The first 1.3 billion people who'll never need a bureaucracy lawyer again."*

---

## Voiceover delivery notes

- **Pace**: ~140 words/minute. Conversational, not announcer.
- **Tone**: Grounded, slightly serious. NO "in this video" or "today I want to show you". Skip preamble.
- **Music**: One ambient bed, quiet, ducked when voice plays. Suggested: Apple Stock "Vibrant" track or similar. No copyright.
- **Sound design**: Camera shutter on the phone-snap. Soft click on each pathway. Silence the loop section so the URL ticks land.

## Captions

- Burn in English captions for ALL non-English content shown on screen
- Use a clean sans-serif, white text with black drop shadow, bottom 15% of frame
- For the polyglot flex (1:25–1:40), display the **language tag** + **one sentence** of English caption per case

## Recording technical

- Resolution: 1920×1080 minimum, 60fps if possible (smoother time-lapse on the harden loop)
- For phone segment: shoot vertical, then crop into a horizontal frame with the phone bezel visible
- For desktop: use Screen Studio's auto-zoom on cursor for the agent panels

## Editing

- Total cut should be 1:55–2:00. Don't over-run.
- Color grade slightly cool/desaturated for the "letter pile" hook — feels institutional
- Color grade neutral for the Paperwork screen captures
- Hard cuts between sections, no transitions

---

## What this video is NOT

- Not a feature tour
- Not a tutorial
- Not "here's what AI can do"
- Not generic "we built a tool that helps people"

It's a **before/after**: 1.3B people drowning in paper → one tool, every language, real citations.

---

## Backup plan if recording falls behind

If you can't record the time-lapse of the harden loop in time:
- Use a screen recording of one harden run, then speed up 25× in post
- OR cut to a static side-by-side "what it found" panel: 3 weaknesses on the left, 12 URLs ticking down a list on the right

If the phone-snap intro doesn't land:
- Open instead with the polyglot flex (start at 1:25 of the script). Move the hook to 1:40. Less viscerally compelling but still strong.

---

## Submission tag line (for Cerebral Valley form)

> **Paperwork: the universal AI lawyer for the 1.3B people receiving government letters they can't fully read.** A multi-agent system on Opus 4.7 that reads any letter in any language, finds every legal path you can take, drafts your response in correct legal register, then attacks its own draft until it can't be broken — gathering real evidence from the open web in the process. Five jurisdictions tested end-to-end. One person built it.
