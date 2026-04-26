# Reddit Posts — for finding real users / soft launch

**Strategy**: post in 2–3 carefully-chosen subs, lead with a free offer, no hard sell, expect blunt feedback.

---

## Primary post — r/UniversalCredit

**Title**: Free: built an AI that drafts your DWP appeal letters with real legal citations — looking for a few real overpayment letters to test on (hackathon project, no signup, no email)

**Body**:

> I'm a solo dev, not a lawyer, not a law firm, not selling anything. I built something for Anthropic's Opus 4.7 hackathon (ends today) called Paperwork.
>
> You drop your DWP letter on the page. It reads it (handles photos of paper letters too — just snap from your phone). Then three AI agents go to work in front of you:
>
> 1. One tells you every option you have — Mandatory Reconsideration, tribunal appeal, beneficial-ownership argument, debt write-off — with the specific UC Regs 2013 / SSA 1998 article each one rests on.
> 2. A second plays a *DWP decision-maker* and adversarially attacks the draft, finding every RFE-trigger that could come back at you.
> 3. A third searches the public web — DWP Decision Maker's Guide, Garden Court Chambers, Shelter, CPAG — to gather evidence against each attack.
> 4. A fourth rewrites with the new citations.
>
> Output: a real ~10,000-char letter in proper UK welfare-rights register, plus the evidence binder, plus a downloadable PDF with the deadlines tracked.
>
> **Why posting**: the output looks credible to me, but I'm a dev not a welfare adviser. I want a few real cases to test on so I know if it holds up against what an actual CAB caseworker would write.
>
> **What I'm offering**: drop your DWP letter at https://passage.gudman.xyz, run it, message me the result if you're up for sharing feedback. Documents aren't stored after the session ends. No email, no signup.
>
> **What I'm asking**: one honest line — "this is solid" or "this is wrong because X". If you'd let me quote your first name (or anonymous) on the hackathon submission video, that'd be a huge help. No pressure either way.
>
> Not legal advice. Built by one person in 6 days. Will say that ten times.

**Posting notes**:
- Post during weekday morning UK time (09:00 BST max engagement)
- If mods flag it as self-promo, reply explaining hackathon context and offer to remove
- Watch for downvotes in first 30 min — that's your signal of whether the framing landed

---

## Secondary post — r/legaladviceuk

**Title**: Built a free AI welfare-rights tool for a hackathon — does it actually pass the sniff test?

**Body** (shorter, more peer-review tone):

> Hackathon project closing today. Tool reads a UK government letter (Universal Credit, HMRC, council tax, eviction), maps every legal option you have with statute citations, drafts your response, then runs an adversarial loop where a second AI plays the decision-maker and attacks the draft, with a third doing real web research to defend it.
>
> Sample output for a synthetic UC overpayment case: full Mandatory Reconsideration letter citing s.9 SSA 1998, reg. 7 of UC Regs 2013, beneficial-ownership case law, with 12 verifiable evidence URLs (DWP Decision Maker's Guide, Garden Court Chambers, etc.).
>
> Anyone who's worked welfare rights / housing law mind giving it 10 min and telling me where it fails? It's at https://passage.gudman.xyz. Roast it if it deserves roasting — that's the point.
>
> No signup, nothing stored, free.

---

## What to do if no real cases come back in 6 hours

- That's fine. Submit anyway with synthetic cases anchored to real public forum threads (the demo script already covers this — every case is anchored to a public canadavisa.com / alexia.fr / forums.moneysavingexpert.com URL).
- Real-user testimonial would be a +5pp prize-probability bump but isn't a hard requirement.

---

## What to do if someone says it's wrong

- Thank them publicly
- Ask for the specific defect
- If they're right, fix it tonight if simple; otherwise note it as future-work in the submission writeup
- DO NOT argue. Welfare advisors who push back in public threads have nuclear credibility — never antagonize them.
