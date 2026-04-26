import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "samples");

async function doc(title, lines) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({
    x: 0,
    y: 752,
    width: 612,
    height: 40,
    color: rgb(0.95, 0.95, 0.95),
  });
  page.drawText("SYNTHETIC SAMPLE — FOR PRODUCT DEMO ONLY", {
    x: 40,
    y: 768,
    size: 10,
    font: bold,
    color: rgb(0.6, 0, 0),
  });

  page.drawText(title, {
    x: 40,
    y: 720,
    size: 15,
    font: bold,
    color: rgb(0, 0, 0),
  });

  let y = 692;
  for (const line of lines) {
    if (line === "") {
      y -= 8;
      continue;
    }
    const isHeader = line.startsWith("## ");
    const text = isHeader ? line.slice(3) : line;
    page.drawText(text, {
      x: 40,
      y,
      size: isHeader ? 12 : 10,
      font: isHeader ? bold : font,
      color: rgb(0, 0, 0),
    });
    y -= isHeader ? 20 : 14;
    if (y < 40) break;
  }
  return pdf.save();
}

const samples = [
  {
    name: "01-uk-dwp-universal-credit-denial.pdf",
    title: "UK DEPARTMENT FOR WORK AND PENSIONS — DECISION NOTICE",
    lines: [
      "## Our ref: UC-2026/019843-K",
      "Date:                 14 April 2026",
      "",
      "## TO:",
      "Mr. Samuel Adjei",
      "42 Churchill Avenue, Flat 3C",
      "Birmingham B13 9QX",
      "",
      "## DECISION — Universal Credit entitlement review",
      "National Insurance Number:   AB 12 34 56 C",
      "Claim reference:             UC-5583-9921",
      "",
      "We have reviewed your Universal Credit claim for the assessment",
      "period 01 Mar 2026 to 31 Mar 2026 and have decided:",
      "",
      "You are NOT ENTITLED to Universal Credit for this period.",
      "",
      "## Reason",
      "Capital / savings reported in your account at Barclays (ending 4471)",
      "exceeded GBP 16,000 on 17 March 2026, which is the upper capital",
      "limit under Universal Credit Regulations 2013, reg. 18(1).",
      "",
      "Amount overpaid: GBP 742.00 — recoverable under s.71 Social",
      "Security Administration Act 1992.",
      "",
      "## Your rights",
      "If you disagree, you must request a MANDATORY RECONSIDERATION",
      "within ONE MONTH of the date of this letter (i.e. by 14 May 2026).",
      "After Mandatory Reconsideration you may appeal to HM Courts &",
      "Tribunals Service (Social Entitlement Chamber).",
      "",
      "Signed: J. Patel, Decision Maker, Wolverhampton Service Centre",
    ],
  },
  {
    name: "02-user-bank-statement.pdf",
    title: "Barclays Bank — Account statement (supporting document)",
    lines: [
      "## Account holder",
      "Mr. Samuel Adjei",
      "Sort code:   20-00-00    Account: ****4471",
      "Statement period: 01 Mar 2026 – 31 Mar 2026",
      "",
      "## Selected transactions",
      "02 Mar 2026   Salary (Odeon Cinemas PLC)         + 1,920.00",
      "05 Mar 2026   Rent — Birmingham City Housing     -   760.00",
      "14 Mar 2026   INCOMING TRANSFER — Kwame Adjei   +15,300.00",
      "              (memo: 'wedding gift — please return after')",
      "17 Mar 2026   OUTGOING TRANSFER — Kwame Adjei   -15,300.00",
      "              (memo: 'returned as agreed')",
      "25 Mar 2026   Tesco                              -    47.20",
      "",
      "## Balance",
      "Opening:      GBP   1,184.22",
      "Peak (14 Mar):       16,484.22",
      "Closing:             1,097.02",
      "",
      "## Note from account holder",
      "The GBP 15,300 held on 14–17 March was a short-term transfer from",
      "my brother Kwame to his own account after he closed his UK account",
      "to move to Ghana. Funds were returned to him on 17 Mar. This is not",
      "my money. Relationship: brother. Bank statement attached.",
    ],
  },
  {
    name: "03-user-id-card.pdf",
    title: "Biographical card — applicant identification",
    lines: [
      "## Personal data",
      "Full name:         Samuel Kwame Adjei",
      "Date of birth:     02 August 1988",
      "Nationality:       British (Ghanaian heritage)",
      "National Insurance: AB 12 34 56 C",
      "Current address:   42 Churchill Avenue, Flat 3C,",
      "                   Birmingham B13 9QX",
      "",
      "## Household",
      "Relationship status:      Single",
      "Dependants:               1 (Ama Adjei, age 6, daughter)",
      "",
      "## Income",
      "Employer:   Odeon Cinemas PLC (part-time, 24 hrs/week)",
      "Gross monthly pay:  GBP 1,920.00",
      "",
      "## Relevant contacts",
      "Brother: Kwame Adjei, relocated to Accra, Ghana March 2026",
      "Children's mother: resides in Manchester, separate household",
    ],
  },
];

await mkdir(OUT_DIR, { recursive: true });

// clean out old US-immigration samples
for (const f of await readdir(OUT_DIR)) {
  if (f.endsWith(".pdf")) await unlink(join(OUT_DIR, f));
}

for (const s of samples) {
  const bytes = await doc(s.title, s.lines);
  await writeFile(join(OUT_DIR, s.name), bytes);
  console.log(`wrote samples/${s.name}`);
}

console.log(`\n${samples.length} synthetic documents ready.`);
