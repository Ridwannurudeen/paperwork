// Per-case end-to-end runner. Generates synthetic PDFs reconstructed from a public forum post,
// then ingest → analyze → draft → harden → save artifacts.
//
// Usage:  node scripts/run-case.mjs <case-slug>
// Cases:  ircc-egyptian | caf-prime-activite

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fetch as undiciFetch, Agent } from "undici";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const BASE = process.env.PAPERWORK_BASE ?? "http://localhost:3000";
const longAgent = new Agent({ bodyTimeout: 1_800_000, headersTimeout: 1_800_000 });

// Use global fetch for multipart (undici's FormData has Content-Type quirks).
// Use undici's fetch with long-timeout dispatcher for slow JSON endpoints.
const nativeFetch = globalThis.fetch;

function banner(s) {
  console.log(`\n${"═".repeat(70)}\n  ${s}\n${"═".repeat(70)}`);
}

// ---------------------------------------------------------------------------
// PDF builder
// ---------------------------------------------------------------------------

async function buildPdf(title, lines, watermark) {
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
  page.drawText(watermark, {
    x: 40,
    y: 768,
    size: 9,
    font: bold,
    color: rgb(0.6, 0, 0),
  });

  page.drawText(title, {
    x: 40,
    y: 720,
    size: 14,
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
      size: isHeader ? 11 : 10,
      font: isHeader ? bold : font,
      color: rgb(0, 0, 0),
    });
    y -= isHeader ? 18 : 14;
    if (y < 50) break;
  }
  return pdf.save();
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

const CASES = {
  "ircc-egyptian": {
    title: "Egyptian senior engineer in Germany — Canadian visitor visa refusal",
    source_url:
      "https://www.canadavisa.com/canada-immigration-discussion-board/threads/visitor-visa-refusal-strong-profile-but-denied-for-ties-and-purpose-advice-needed.874788/",
    user_context:
      "I am Egyptian, single, 32. I have lived and worked in Germany since January 2025 (10 months) as a senior engineer at a major German engineering firm — I have been with this employer for 3+ years total (2 in their Egypt office, then transferred to Germany). My German Aufenthaltstitel (residence permit) is the standard 4-year skilled-worker permit, not permanent. My immediate family (parents, two siblings) all live in Cairo. I have travelled to the UK (study), Australia (tourism), and France (tourism) without overstaying. I applied for a 3-week TRV to visit Quebec in October 2025, with a friend in Montreal for part of the trip. I provided employment letter, German residence permit, payslips for 6 months, hotel and flight bookings, and EUR 8000 in savings. I want a real plan: reconsideration, judicial review, or reapply, and I want a draft response letter.",
    files: [
      {
        name: "01-ircc-refusal-letter.pdf",
        title: "IMMIGRATION, REFUGEES AND CITIZENSHIP CANADA — Decision",
        watermark: "RECONSTRUCTED FROM PUBLIC FORUM POST — DEMO ONLY",
        lines: [
          "## File reference:        F000123456",
          "Decision date:           14 October 2025",
          "Application type:        Temporary Resident Visa (Visitor)",
          "",
          "## To",
          "Mr. ALI HASSAN MAHMOUD",
          "Egyptian national, residing in Frankfurt am Main, Germany",
          "Date of birth:           02 November 1992",
          "Passport No.:            A12345678 (Arab Republic of Egypt)",
          "",
          "## Decision",
          "After careful and thorough review of your application, I am not satisfied",
          "that you will leave Canada at the end of your stay. In reaching this",
          "decision, I considered several factors, including:",
          "",
          "## Officer notes",
          "I have reviewed the application. I have considered the following factors",
          "in my decision. The applicant does not have significant family ties",
          "outside Canada. The purpose of the applicant's visit to Canada is not",
          "consistent with a temporary stay given the details provided in the",
          "application. Weighing the factors in this application, I am not satisfied",
          "that the applicant will depart Canada at the end of the period authorized",
          "for their stay. For these reasons, I have refused this application.",
          "",
          "## Section 11(1) Immigration and Refugee Protection Act",
          "Subsection 11(1) of the Act states that a foreign national must, before",
          "entering Canada, apply to an officer for a visa or any other document",
          "required by the Regulations.",
          "",
          "Signed: Officer ID 1842, IRCC Visa Office, Vienna",
        ],
      },
      {
        name: "02-employment-letter.pdf",
        title: "EMPLOYMENT VERIFICATION — KraussTech GmbH (Frankfurt am Main)",
        watermark: "RECONSTRUCTED FROM PUBLIC FORUM POST — DEMO ONLY",
        lines: [
          "## To Whom It May Concern",
          "Date: 28 September 2025",
          "",
          "We confirm that Mr. Ali Hassan Mahmoud (date of birth 02 Nov 1992) is",
          "currently employed with KraussTech GmbH in the position of",
          "Senior Mechanical Engineer, Drive Systems Division.",
          "",
          "## Employment record",
          "Total tenure with KraussTech group:   3 years 4 months",
          "  - April 2022 – December 2024:        KraussTech Cairo (Egypt office)",
          "  - January 2025 – present:            KraussTech GmbH, Frankfurt",
          "",
          "Current annual salary:                EUR 78,400 gross",
          "Working hours:                        Full-time, permanent contract",
          "",
          "## Approved leave for travel",
          "Mr. Mahmoud has been granted approved leave for the period",
          "06 October 2025 – 27 October 2025 inclusive (15 working days).",
          "He is expected and required to return to his role on 28 October 2025,",
          "where significant project responsibilities (Project KX-440 Drive",
          "Subsystem) await his completion.",
          "",
          "Signed: Dr. Ines Hartmann, Head of Drive Systems",
          "        KraussTech GmbH, Mainzer Landstrasse 233, 60326 Frankfurt",
        ],
      },
      {
        name: "03-applicant-bio.pdf",
        title: "APPLICANT BIOGRAPHICAL FACT SHEET",
        watermark: "USER-PROVIDED CONTEXT — DEMO ONLY",
        lines: [
          "## Personal",
          "Full name:           Ali Hassan Mahmoud",
          "Nationality:         Egyptian (Arab Republic of Egypt)",
          "Date of birth:       02 November 1992 (age 32)",
          "Marital status:      Single, no children",
          "",
          "## Residence",
          "Current:             Frankfurt am Main, Germany (since January 2025)",
          "German residence:    Skilled-worker permit (Aufenthaltstitel),",
          "                     valid 12 Jan 2025 – 11 Jan 2029",
          "",
          "## Family ties (all outside Canada)",
          "Mother (60), Cairo                 — retired teacher",
          "Father (65), Cairo                 — retired civil servant",
          "Brother (28), Cairo                — works at Vodafone Egypt",
          "Sister (24), Cairo                 — medical resident",
          "",
          "## Travel history (all returned on time)",
          "United Kingdom:     2014–2017 (MSc Mechanical Engineering, Manchester)",
          "Australia:          2018 (3-week tourism)",
          "France:             2023 (1-week tourism)",
          "Schengen Area:      2025–present (resident)",
          "",
          "## This trip",
          "Destination:        Quebec — Montreal, Quebec City, Mont-Tremblant",
          "Dates:              06 Oct 2025 – 27 Oct 2025 (3 weeks)",
          "Companion:          1 friend (Egyptian-Canadian, lives in Montreal)",
          "Funds:               EUR 8,000 in savings + employer-paid leave",
          "Purpose:            Tourism + visit one Canadian friend (university classmate)",
        ],
      },
    ],
  },

  "caf-prime-activite": {
    title: "Notification d'indu CAF — Prime d'activité (Coconuts case)",
    source_url:
      "https://www.alexia.fr/questions/451433/recours-dette-trop-percu-de-la-caf.htm",
    user_context:
      "Je suis mère célibataire, deux enfants à charge (8 et 11 ans). J'ai reçu en juillet 2023 un avis de la CAF me reclamant 6 200 EUR de prime d'activité versés entre avril 2021 et juillet 2023. La CAF dit que je n'ai pas déclaré la pension alimentaire que je reçois pour mes enfants (250 EUR/mois). J'ai déclaré cette pension dans ma déclaration d'impôts mais pas à la CAF — je ne savais pas qu'il fallait. La CAF a refusé ma première demande de remise de dette. Maintenant ils retiennent 193 EUR par mois sur mes 340 EUR d'allocations restantes (212 EUR allocations familiales + 128 EUR APL), ce qui me met en grande difficulté financière. Je veux contester, demander la prescription biennale pour la partie 2021, et obtenir une nouvelle remise de dette ou un échéancier supportable.",
    files: [
      {
        name: "01-caf-notification-indu.pdf",
        title: "CAISSE D'ALLOCATIONS FAMILIALES — Notification d'indu",
        watermark: "RECONSTITUTION D'UN POST PUBLIC — DEMONSTRATION UNIQUEMENT",
        lines: [
          "## CAF du Rhône",
          "245 rue Garibaldi, 69422 Lyon Cedex 03",
          "Date d'edition: 18 juillet 2023",
          "",
          "## Destinataire",
          "Madame DUPONT MARIE",
          "Numero allocataire:        785 432 19 K",
          "Adresse:                   42 rue de la Republique, 69002 Lyon",
          "",
          "## Objet: Notification d'indu — Prime d'activite",
          "",
          "Madame,",
          "",
          "Apres reexamen de votre dossier, nous avons constate qu'une somme vous",
          "a ete versee a tort au titre de la Prime d'activite. Vous n'avez pas",
          "declare la pension alimentaire percue pour vos enfants, qui doit etre",
          "prise en compte dans le calcul de la Prime d'activite (article L.842-4",
          "du Code de la securite sociale).",
          "",
          "## Detail de l'indu",
          "Periode du 01/04/2021 au 31/03/2022:        2 054,00 EUR",
          "Periode du 01/04/2022 au 31/07/2023:        4 577,00 EUR",
          "TOTAL DE L'INDU:                            6 631,00 EUR",
          "",
          "## Modalites de recouvrement",
          "Conformement a l'article L.553-2 du Code de la securite sociale,",
          "la CAF procedera au recouvrement de cet indu par retenues mensuelles",
          "de 193,00 EUR sur vos prestations a venir, a compter du 01/09/2023.",
          "",
          "## Vos droits",
          "Vous disposez d'un delai de DEUX MOIS a compter de la presente",
          "notification pour saisir la Commission de Recours Amiable (CRA) de",
          "votre CAF en vue de contester cette decision (article R.142-1 CSS).",
          "Vous pouvez egalement demander une remise de dette si vous etes en",
          "situation de precarite.",
          "",
          "Le Directeur de la CAF du Rhone",
        ],
      },
      {
        name: "02-allocataire-bio.pdf",
        title: "Fiche allocataire — situation familiale et financiere",
        watermark: "CONTEXTE UTILISATEUR — DEMONSTRATION",
        lines: [
          "## Identite",
          "Nom:                       DUPONT Marie",
          "Date de naissance:         15 mars 1982 (41 ans)",
          "Nationalite:               Francaise",
          "Situation:                 Separee depuis 2019 (jugement TGI Lyon)",
          "",
          "## Foyer",
          "Enfant 1:    Lea Dupont, nee 22 mai 2014 (11 ans), a charge",
          "Enfant 2:    Tom Dupont, ne 04 octobre 2017 (8 ans), a charge",
          "",
          "## Revenus mensuels actuels",
          "Salaire net (CDI mi-temps, aide a domicile):    980,00 EUR",
          "Pension alimentaire (jugement TGI 2019):        250,00 EUR / enfant",
          "                                                = 500,00 EUR au total",
          "Allocations familiales:                          212,99 EUR",
          "Aide personnalisee au logement (APL):           128,00 EUR",
          "",
          "## Charges mensuelles fixes",
          "Loyer (apres APL):                               680,00 EUR",
          "EDF + eau:                                       120,00 EUR",
          "Mutuelle:                                         85,00 EUR",
          "Cantine + activites enfants:                     130,00 EUR",
          "Transport (abonnement TCL):                       33,00 EUR",
          "",
          "## Apres retenue CAF de 193 EUR par mois",
          "Reste a vivre apres charges fixes:               environ 480 EUR",
          "  pour 3 personnes, soit 5,30 EUR par jour et par personne.",
          "",
          "Note: la pension alimentaire a toujours ete declaree aux impots",
          "      (avis d'imposition 2021, 2022, 2023 disponibles).",
        ],
      },
      {
        name: "03-jugement-resume.pdf",
        title: "Resume du jugement TGI Lyon 2019 (extrait)",
        watermark: "EXTRAIT — DEMONSTRATION",
        lines: [
          "## TRIBUNAL DE GRANDE INSTANCE DE LYON",
          "Affaire:    DUPONT / DUPONT (separation de corps et de biens)",
          "Date:       12 juin 2019",
          "Reference:  RG 19/02184",
          "",
          "## Dispositif (extrait)",
          "Le Tribunal:",
          "",
          "FIXE la residence habituelle des enfants Lea et Tom au domicile de",
          "leur mere, Madame Marie Dupont;",
          "",
          "ACCORDE un droit de visite et d'hebergement classique au pere",
          "(un week-end sur deux et la moitie des vacances scolaires);",
          "",
          "CONDAMNE Monsieur Pierre Dupont a verser a Madame Marie Dupont une",
          "pension alimentaire mensuelle de 250 EUR (deux cent cinquante euros)",
          "par enfant, soit 500 EUR (cinq cents euros) au total, due le 5 de",
          "chaque mois, indexee chaque annee sur l'indice INSEE des prix a la",
          "consommation hors tabac.",
          "",
          "## Important",
          "Cette pension alimentaire a ete versee regulierement par M. Dupont",
          "depuis juillet 2019 et a toujours ete declaree par Mme Dupont a",
          "l'administration fiscale (avis d'imposition annexes).",
        ],
      },
    ],
  },

  "aeat-autonomo": {
    title: "AEAT requerimiento — autonomo madrileno (IRPF 2023)",
    source_url:
      "https://www.rankia.com/foros/fiscalidad/temas/3268636-contestacion-requerimiento-aeat",
    user_context:
      "Soy autonomo desde 2019 en Madrid (servicios de diseno grafico). El 14 de abril de 2026 he recibido un requerimiento de la AEAT pidiendome aclaraciones sobre mi declaracion de IRPF 2023 — dicen que detectan ingresos no declarados de 8.400 euros que vienen de una plataforma extranjera (Upwork) que no aparecen en mis registros. Yo SI declare esos ingresos pero los puse como rendimientos de actividades economicas no como rendimientos del trabajo, lo que la AEAT parece haber malinterpretado. Tengo todas las facturas y los justificantes de pago de Upwork. Quiero contestar dentro del plazo, evitar la sancion (la AEAT propone 4.200 euros entre cuota y multa) y, si me deniegan, presentar reclamacion economico-administrativa.",
    files: [
      {
        name: "01-aeat-requerimiento.pdf",
        title: "AGENCIA TRIBUTARIA — Requerimiento (Gestion Tributaria)",
        watermark: "RECONSTRUCCION DE CASO PUBLICO — DEMO UNICAMENTE",
        lines: [
          "## Delegacion Especial de Madrid",
          "Administracion de Vallecas",
          "Calle Concejal Francisco Jose Jimenez Martin, 17",
          "28038 Madrid",
          "",
          "Numero de referencia:    2026GR00123456789",
          "CSV:                     A1B2C3D4E5F67890",
          "Fecha de notificacion:   14/04/2026",
          "Plazo de contestacion:   10 dias habiles desde notificacion",
          "",
          "## DESTINATARIO",
          "Don CARLOS RAMIREZ FERNANDEZ",
          "NIF:                     12345678-Z",
          "Domicilio fiscal:        Calle Bravo Murillo 156, 4B, 28020 Madrid",
          "",
          "## OBJETO: Requerimiento — IRPF ejercicio 2023",
          "",
          "Se ha iniciado un procedimiento de gestion tributaria respecto",
          "de su autoliquidacion del IRPF 2023 (modelo 100). En el cruce",
          "de informacion realizado por esta Administracion se ha detectado",
          "una discrepancia con los datos declarados.",
          "",
          "## DETALLE DE LA REGULARIZACION PROPUESTA",
          "Ingresos no declarados (plataforma Upwork Inc., USA): 8.400,00 EUR",
          "Cuota tributaria adicional propuesta:                  3.024,00 EUR",
          "Sancion propuesta (art. 191 LGT 58/2003 — leve):      1.176,00 EUR",
          "Total a ingresar:                                      4.200,00 EUR",
          "",
          "## DOCUMENTACION REQUERIDA",
          "Se le requiere para que en el plazo de DIEZ (10) DIAS HABILES",
          "aporte la siguiente documentacion: justificantes bancarios de",
          "los cobros recibidos durante 2023, copia de los contratos con",
          "los clientes, y aclaracion del epigrafe IAE/CNAE en que se",
          "encuadra la actividad.",
          "",
          "## RECURSOS",
          "Contra el presente requerimiento, una vez dictada resolucion",
          "expresa, podra interponer recurso de reposicion en plazo de",
          "un mes (art. 222 LGT), o reclamacion economico-administrativa",
          "ante el TEAR de Madrid (art. 226 LGT y RD 520/2005).",
          "",
          "El Jefe de la Unidad de Gestion",
        ],
      },
      {
        name: "02-modelo-100-resumen.pdf",
        title: "Resumen autoliquidacion IRPF 2023 (Modelo 100)",
        watermark: "DOCUMENTO DEL CONTRIBUYENTE — DEMO",
        lines: [
          "## Datos del declarante",
          "NIF:                     12345678-Z",
          "Nombre:                  Carlos Ramirez Fernandez",
          "Ejercicio:                2023",
          "",
          "## Rendimientos de actividades economicas (epigrafe IAE 776)",
          "Estimacion directa simplificada",
          "",
          "Ingresos integros declarados:",
          "  - Clientes en Espana (con factura):        21.500,00 EUR",
          "  - Clientes UE (operaciones intra):           4.800,00 EUR",
          "  - Clientes terceros paises (Upwork):         8.400,00 EUR",
          "  Total ingresos integros:                   34.700,00 EUR",
          "",
          "Gastos deducibles:",
          "  - Cuota autonomos RETA:                      3.288,00 EUR",
          "  - Material y software:                       1.420,00 EUR",
          "  - Telefono e internet:                         480,00 EUR",
          "  - Asesoria fiscal:                             720,00 EUR",
          "  Total gastos deducibles:                    5.908,00 EUR",
          "",
          "Rendimiento neto declarado:                  28.792,00 EUR",
          "",
          "## Importante",
          "Los 8.400 EUR de Upwork SI se han declarado",
          "como rendimiento de actividad economica, no",
          "como rendimientos del trabajo. La AEAT parece haber consultado",
          "un cruce con datos del modelo 296 (rentas no residentes) que",
          "no aplica a un autonomo dado de alta en epigrafe IAE 776.",
        ],
      },
      {
        name: "03-comprobantes-upwork.pdf",
        title: "Comprobantes Upwork — pagos recibidos 2023",
        watermark: "DOCUMENTO DEL CONTRIBUYENTE — DEMO",
        lines: [
          "## Resumen pagos recibidos via Upwork Inc. (Delaware, USA)",
          "Cuenta bancaria de abono: ES12 0049 1234 56 7890123456 (BBVA)",
          "Periodo: 01/01/2023 — 31/12/2023",
          "Moneda original: USD; conversion a EUR al tipo del dia",
          "",
          "Total bruto recibido:           USD  9.412,00",
          "Comision plataforma (Upwork):   USD    752,96  (8 por ciento)",
          "Total neto recibido en cuenta:  USD  8.659,04",
          "Equivalente en EUR (T/C medio): EUR  8.420,17",
          "",
          "## 12 facturas emitidas",
          "Todas las facturas se han emitido correctamente con NIF, IVA",
          "(operacion no sujeta a IVA — art. 69.5 LIVA, prestacion de",
          "servicios a empresas extranjeras), y se conservan en el libro",
          "registro de facturas emitidas. Detalle disponible.",
          "",
          "## Conclusion contribuyente",
          "El importe declarado en IRPF 2023 (8.400 EUR) coincide en",
          "esencia con los pagos recibidos (8.420 EUR), con diferencia",
          "minima por redondeo del tipo de cambio. NO existe ingreso",
          "no declarado. La discrepancia es presunta y procedimental.",
        ],
      },
    ],
  },

  "buergergeld-berlin": {
    title: "Bürgergeld Aufhebungsbescheid — alleinerziehende Mutter Berlin",
    source_url: "https://hartz4widerspruch.de/ratgeber/rechtliches/widerspruch/",
    user_context:
      "Ich bin alleinerziehend (zwei Kinder, 4 und 7 Jahre) und beziehe seit Januar 2024 Buergergeld vom Jobcenter Berlin Neukoelln. Am 12. April 2026 habe ich einen Aufhebungs- und Erstattungsbescheid bekommen, der besagt, ich haette 2.800 Euro zu Unrecht erhalten, weil ich eine Erbschaft von 4.500 Euro nach dem Tod meiner Mutter im November 2025 nicht angegeben habe. Das stimmt — ich habe es nicht gemeldet, aber die 4.500 Euro waren ZWECKGEBUNDEN: meine Mutter hatte testamentarisch festgelegt, dass das Geld fuer ihre Beerdigung verwendet werden muss, und genau das ist passiert (Bestatter-Rechnung 4.620 Euro). Ich habe die Erbschaft also faktisch nie zur Verfuegung gehabt. Ich will Widerspruch einlegen, die Zweckbindung mit dem Testament und der Bestatter-Rechnung belegen, und Erlass auf Haerte beantragen. Ich brauche einen Brief in deutscher Rechtssprache.",
    files: [
      {
        name: "01-jobcenter-aufhebungsbescheid.pdf",
        title: "JOBCENTER BERLIN NEUKOELLN — Aufhebungs- und Erstattungsbescheid",
        watermark: "REKONSTRUKTION EINES OEFFENTLICHEN FALLS — NUR ZUR DEMO",
        lines: [
          "## Jobcenter Berlin Neukoelln",
          "Mainzer Strasse 27, 12053 Berlin",
          "BG-Nummer:               12345 // 0067890",
          "Aktenzeichen:            JC-NK-2026/04/3344",
          "Bescheid vom:            12. April 2026",
          "",
          "## An",
          "Frau ANNA SCHMIDT",
          "geb. 14.06.1987",
          "Hermannstrasse 142, 12051 Berlin",
          "",
          "## ENTSCHEIDUNG",
          "Mit Bezug auf Ihren Buergergeld-Antrag (BG 12345/0067890):",
          "1. Der Bewilligungsbescheid vom 02.12.2024 wird hiermit teilweise",
          "   aufgehoben fuer den Zeitraum 01.11.2025 bis 28.02.2026,",
          "   gestuetzt auf Paragraph 48 Abs. 1 Satz 2 SGB X.",
          "2. Sie haben in diesem Zeitraum Leistungen in Hoehe von",
          "   2.800,00 EUR zu Unrecht bezogen.",
          "3. Der zu Unrecht erhaltene Betrag ist gemaess Paragraph 50",
          "   Abs. 1 SGB X zu erstatten.",
          "",
          "## BEGRUENDUNG",
          "Im Rahmen des Datenabgleichs nach Paragraph 52 SGB II haben",
          "wir festgestellt, dass Sie am 18.11.2025 eine Erbschaft in",
          "Hoehe von 4.500,00 EUR aus dem Nachlass Ihrer verstorbenen",
          "Mutter erhalten haben. Diese Einnahme stellt einmaliges",
          "Einkommen im Sinne von Paragraph 11 Abs. 3 SGB II dar und",
          "war anrechenbar auf Ihren Bedarf. Sie haben es versaeumt,",
          "diese Einkommensaenderung gemaess Paragraph 60 SGB I",
          "unverzueglich anzuzeigen.",
          "",
          "## RECHTSBEHELFSBELEHRUNG",
          "Gegen diesen Bescheid koennen Sie innerhalb eines Monats",
          "nach Zustellung Widerspruch einlegen. Der Widerspruch ist",
          "schriftlich oder zur Niederschrift beim Jobcenter Berlin",
          "Neukoelln einzureichen. Erfolgt keine Rechtsbehelfsbelehrung",
          "verlaengert sich die Frist auf ein Jahr (Par. 66 SGG).",
          "",
          "## TILGUNG",
          "Rueckforderung wird ab 01.06.2026 monatlich in Hoehe von",
          "30 Prozent des Regelbedarfs (175,80 EUR) verrechnet, bis",
          "der Betrag von 2.800,00 EUR getilgt ist.",
          "",
          "Sachbearbeiterin: K. Mueller",
        ],
      },
      {
        name: "02-testament-und-bestatter.pdf",
        title: "Testament der Mutter + Bestatter-Rechnung (Belege)",
        watermark: "BELEGE DES BETROFFENEN — DEMO",
        lines: [
          "## Auszug aus dem handschriftlichen Testament",
          "Erblasserin: Frau Helga Schmidt, geb. 22.03.1956,",
          "  verstorben 04.11.2025 in Berlin",
          "Hinterlegt beim Amtsgericht Berlin-Tempelhof-Kreuzberg,",
          "  Az. VI 0734/2025",
          "",
          "Wortlaut (Ausschnitt):",
          "",
          "  'Mein letzter Wille: Meine Tochter Anna Schmidt soll von",
          "   meinem Sparbuch bei der Berliner Sparkasse einen Betrag",
          "   von 4.500 EUR erhalten, der jedoch ausschliesslich fuer",
          "   meine Bestattung und die damit verbundenen Kosten zu",
          "   verwenden ist. Was darueber hinaus geht, soll Anna fuer",
          "   die Pflege meines Grabes verwenden.'",
          "",
          "## Rechnung Bestattungsinstitut Hartmann",
          "Bestattungsinstitut Hartmann GmbH",
          "Karl-Marx-Strasse 218, 12055 Berlin",
          "",
          "Rechnung Nr.:            BH-2025-1184",
          "Rechnungsdatum:          21.11.2025",
          "Verstorbene:              Helga Schmidt",
          "Bestattungsart:           Erdbestattung mit Trauerfeier",
          "",
          "Saerge und Innenausstattung:        1.840,00 EUR",
          "Trauerfeier und Trauerredner:         920,00 EUR",
          "Friedhofsgebuehren (30 Jahre):        1.480,00 EUR",
          "Grabstein und Erstpflege:              380,00 EUR",
          "                              ------------------",
          "Gesamtbetrag (inkl. 19% USt.):       4.620,00 EUR",
          "",
          "Bezahlt am 25.11.2025 von Anna Schmidt aus dem Erbe der",
          "Verstorbenen (Ueberweisung von Konto IBAN DE12...4567).",
        ],
      },
      {
        name: "03-haushaltslage.pdf",
        title: "Aktuelle Haushaltslage — Anna Schmidt",
        watermark: "BENUTZERANGABE — DEMO",
        lines: [
          "## Bedarfsgemeinschaft",
          "Anna Schmidt, geb. 1987 (alleinerziehend)",
          "Lukas Schmidt, geb. 2018 (7 Jahre)",
          "Mia Schmidt, geb. 2021 (4 Jahre)",
          "",
          "## Monatliches Einkommen",
          "Buergergeld Regelbedarf (Mutter):         586,00 EUR",
          "Sozialgeld Lukas (7 J.):                  347,00 EUR",
          "Sozialgeld Mia (4 J.):                    347,00 EUR",
          "Mehrbedarf alleinerziehend (36 Prozent):   211,00 EUR",
          "Kindergeld Lukas:                          255,00 EUR",
          "Kindergeld Mia:                            255,00 EUR",
          "Unterhaltsvorschuss (vom Jugendamt):       330,00 EUR",
          "                              ----------------------",
          "Gesamteinkommen monatlich:               2.331,00 EUR",
          "",
          "## Monatliche Fixkosten",
          "Warmmiete (45 qm, Hermannstrasse):         920,00 EUR",
          "Strom:                                     145,00 EUR",
          "Telefon und Internet:                       45,00 EUR",
          "Kita-Beitrag (Mia):                          0,00 EUR",
          "Schulausstattung Lukas:                     85,00 EUR",
          "Lebensmittel (3 Personen):                 580,00 EUR",
          "                              ----------------------",
          "Gesamte Fixkosten:                       1.775,00 EUR",
          "",
          "## Verfuegbares Restbudget",
          "Vor 175,80 EUR Tilgungsabzug:              556,00 EUR",
          "Nach 175,80 EUR Tilgungsabzug:             380,20 EUR",
          "",
          "Bei drei Personen entspricht das 4,22 EUR pro Person und Tag.",
          "Diese Lage erfuellt nach gaengiger Rechtsprechung das Merkmal",
          "der besonderen Haerte i.S.v. Par. 44 SGB X.",
        ],
      },
    ],
  },

  "receita-mei": {
    title: "Receita Federal auto de infracao — vendedora online MEI Sao Paulo",
    source_url:
      "https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/malha-fiscal/notificacao",
    user_context:
      "Sou Maria Silva, MEI desde 2021 em Sao Paulo, vendo artesanato em plataformas online (Mercado Livre, Shopee, Etsy). Em 18 de abril de 2026 recebi um auto de infracao da Receita Federal cobrando R$ 8.500 (sendo R$ 4.250 de imposto e R$ 4.250 de multa de oficio de 75 por cento) porque dizem que minha receita bruta de 2024 ultrapassou o limite de R$ 81.000 anual do MEI (chegou a R$ 92.300) e portanto eu deveria ter migrado para Microempresa (ME) e pago tributos sobre o excedente. Eu nao sabia desse limite — meu contador (informal) so me orientava sobre o DAS mensal. Nao tenho como pagar R$ 8.500 de uma vez. Quero apresentar impugnacao no prazo de 30 dias, alegar boa-fe, pedir parcelamento, e tentar reducao da multa pela margem do art. 44 da Lei 9.430/96.",
    files: [
      {
        name: "01-rfb-auto-de-infracao.pdf",
        title: "RECEITA FEDERAL DO BRASIL — Auto de Infracao",
        watermark: "RECONSTRUCAO DE CASO PUBLICO — APENAS PARA DEMO",
        lines: [
          "## RECEITA FEDERAL DO BRASIL",
          "Delegacia da Receita Federal em Sao Paulo (DERAT/SP)",
          "Avenida Pres. Juscelino Kubitschek, 1830, Itaim Bibi",
          "Sao Paulo - SP, 04543-900",
          "",
          "Numero do processo:    19515.726789/2026-15",
          "Data de emissao:       18/04/2026",
          "Codigo de receita:     7556 (IRPF complementar)",
          "Prazo de defesa:       30 (trinta) dias da ciencia",
          "",
          "## DESTINATARIO",
          "MARIA APARECIDA SILVA",
          "CPF:                   123.456.789-00",
          "CNPJ MEI:              52.847.391/0001-77",
          "Endereco:              Rua dos Bandeirantes 187, ap. 4",
          "                       Vila Mariana, Sao Paulo - SP",
          "                       CEP 04123-456",
          "",
          "## OBJETO DO LANCAMENTO",
          "Auto de infracao por descumprimento dos limites do regime",
          "do Microempreendedor Individual (MEI), conforme art. 18-A",
          "Paragrafo 1 da Lei Complementar 123/2006, com o consequente",
          "lancamento de IRPF complementar e multa de oficio.",
          "",
          "## DESCRICAO DOS FATOS",
          "Em cruzamento com informacoes recebidas das plataformas",
          "Mercado Livre, Shopee e Etsy (declaracoes DECRED/e-Financeira)",
          "constatou-se que a contribuinte auferiu receita bruta no",
          "exercicio de 2024 no montante de R$ 92.300,00, superando o",
          "limite de R$ 81.000,00 estabelecido para o regime MEI.",
          "",
          "## CALCULO DO LANCAMENTO",
          "Receita bruta 2024:                    R$ 92.300,00",
          "Limite MEI:                            R$ 81.000,00",
          "Excedente sujeito a tributacao:         R$ 11.300,00",
          "",
          "Imposto IRPF complementar (37,6%):     R$  4.250,00",
          "Multa de oficio (75% — art. 44, I,",
          "  Lei 9.430/96):                       R$  4.250,00",
          "                                       ---------------",
          "TOTAL DEVIDO:                          R$  8.500,00",
          "",
          "Acrescimos legais (juros SELIC) sao calculados ate a data",
          "do efetivo pagamento.",
          "",
          "## DEFESA",
          "A contribuinte podera, no prazo de 30 dias da ciencia,",
          "apresentar impugnacao por escrito a este lancamento, com",
          "as razoes e documentos que entender necessarios, dirigida",
          "a Delegacia da Receita Federal de Julgamento (DRJ).",
          "Base legal: art. 14 e seguintes do Decreto 70.235/72.",
          "",
          "Auditor-Fiscal da Receita Federal: Joao Pereira Santos",
        ],
      },
      {
        name: "02-extrato-mei-2024.pdf",
        title: "Extrato MEI 2024 — Maria Silva (DAS-MEI e DASN-SIMEI)",
        watermark: "DOCUMENTO DA CONTRIBUINTE — DEMO",
        lines: [
          "## Identificacao",
          "Razao social:           MARIA APARECIDA SILVA 52847391000177",
          "CNPJ:                   52.847.391/0001-77",
          "Atividade principal:    47.89-0-99 (Comercio varejista de outros",
          "                         produtos nao especificados)",
          "Optante por SIMEI:      Sim — desde 04/2021",
          "",
          "## Receitas brutas declaradas (DASN-SIMEI 2024)",
          "Comercio (saida de mercadorias):     R$ 88.420,00",
          "Servicos:                            R$  3.880,00",
          "                                     -------------",
          "Total da receita bruta 2024:         R$ 92.300,00",
          "",
          "## DAS-MEI pago em 2024 (12 parcelas)",
          "Valor mensal medio:                  R$     71,60",
          "Total recolhido em DAS:              R$    859,20",
          "(INSS 5% + ISS R$ 5)",
          "",
          "## Observacao da contribuinte",
          "1) A DASN-SIMEI 2024 foi entregue em 28/05/2025 com a receita",
          "   total de R$ 92.300, ou seja, o excedente foi auto-declarado.",
          "2) A contribuinte desconhecia que ao ultrapassar R$ 81.000",
          "   anuais o regime MEI deve ser desenquadrado e a tributacao",
          "   muda para o regime ME (Simples Nacional anexo I).",
          "3) Em 2025 a receita foi R$ 76.400 (abaixo do limite).",
          "4) Houve boa-fe — a propria contribuinte declarou o excedente.",
        ],
      },
      {
        name: "03-situacao-financeira-maria.pdf",
        title: "Situacao financeira da contribuinte (Maria Silva)",
        watermark: "DOCUMENTO DA CONTRIBUINTE — DEMO",
        lines: [
          "## Composicao familiar",
          "Maria Silva (38 anos)",
          "Ana Silva (filha, 9 anos, 4o ano fundamental)",
          "Renato Silva (filho, 6 anos, alfabetizacao)",
          "",
          "## Renda mensal",
          "Vendas online (media 2025):       R$  5.800,00",
          "Pensao alimenticia (pai dos filhos):     R$  1.200,00",
          "                                  ----------------",
          "Renda bruta familiar:             R$  7.000,00",
          "DAS-MEI mensal:                   R$    -71,60",
          "",
          "## Despesas mensais fixas",
          "Aluguel (Vila Mariana, 45 m2):    R$  2.400,00",
          "Energia + agua + gas:             R$    380,00",
          "Internet + celulares:             R$    220,00",
          "Mercado e produtos basicos:       R$  1.600,00",
          "Escola e materiais (2 criancas):  R$    480,00",
          "Plano de saude familiar:          R$    640,00",
          "Transporte:                       R$    280,00",
          "                                  ----------------",
          "Total despesas fixas:             R$  6.000,00",
          "",
          "## Capacidade de pagamento",
          "Saldo medio em conta corrente:    R$    320,00",
          "Aplicacao Tesouro Direto:         R$  1.150,00",
          "Sem outros bens em nome da contribuinte.",
          "",
          "Pagamento de R$ 8.500 a vista e inviavel.",
          "Parcelamento em 60 meses (art. 10 Lei 10.522/2002):",
          "  R$ 8.500 / 60 = R$ 142/mes — viavel.",
        ],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

async function ingest(file, filename) {
  const buf = Buffer.isBuffer(file) ? file : Buffer.from(file);
  const blob = new Blob([buf], { type: "application/pdf" });
  const fd = new FormData();
  fd.append("file", blob, filename);
  // native fetch — handles multipart Content-Type properly
  const res = await nativeFetch(`${BASE}/api/ingest`, { method: "POST", body: fd });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(
      `ingest ${filename}: HTTP ${res.status} non-JSON (first 200): ${text.slice(0, 200)}`,
    );
  }
  if (!res.ok) throw new Error(`ingest ${filename}: ${body.error ?? res.status}`);
  return body.document;
}

async function analyze(documents, free_text_context) {
  const res = await undiciFetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents, free_text_context }),
    dispatcher: longAgent,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`analyze: ${body.error ?? res.status}`);
  return body.analysis;
}

async function draft(documents, option, free_text_context) {
  const res = await undiciFetch(`${BASE}/api/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents, option, free_text_context }),
    dispatcher: longAgent,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`draft: ${body.error ?? res.status}`);
  return body.response;
}

async function harden(documents, option, response) {
  const res = await undiciFetch(`${BASE}/api/harden`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents, option, response, max_iterations: 1 }),
    dispatcher: longAgent,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`harden: HTTP ${res.status} ${t.slice(0, 300)}`);
  }
  if (!res.body) throw new Error("no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let finalEvent = null;
  const events = [];
  const t0 = Date.now();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = frame.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      try {
        const evt = JSON.parse(line.slice(6));
        events.push(evt);
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1).padStart(5);
        if (evt.type === "counterparty_done")
          console.log(`    [${elapsed}s] counterparty: ${evt.weaknesses.length} weaknesses, rejection=${evt.rejection_likelihood}`);
        else if (evt.type === "researcher_done")
          console.log(`    [${elapsed}s] researcher ${evt.weakness_id}: ${evt.evidence_count} evidence`);
        else if (evt.type === "researcher_failed")
          console.log(`    [${elapsed}s] researcher ${evt.weakness_id} FAILED: ${evt.error}`);
        else if (evt.type === "reviser_done")
          console.log(`    [${elapsed}s] reviser done, attachments=${evt.new_attachment_count}`);
        else if (evt.type === "final") finalEvent = evt;
        else if (evt.type === "error") throw new Error(`server: ${evt.message}`);
      } catch {
        // skip malformed
      }
    }
  }
  if (!finalEvent) throw new Error("never received final");
  return { final: finalEvent, events };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const slug = process.argv[2];
  if (!slug || !CASES[slug]) {
    console.error(`usage: node scripts/run-case.mjs <case-slug>`);
    console.error(`available: ${Object.keys(CASES).join(", ")}`);
    process.exit(2);
  }

  const cfg = CASES[slug];
  const outDir = join(ROOT, "test-artifacts", slug);
  await mkdir(outDir, { recursive: true });

  banner(`CASE: ${slug}`);
  console.log(`title:  ${cfg.title}`);
  console.log(`source: ${cfg.source_url}`);

  banner(`SEED — generating ${cfg.files.length} synthetic PDFs`);
  const pdfs = [];
  for (const f of cfg.files) {
    const bytes = await buildPdf(f.title, f.lines, f.watermark);
    const path = join(outDir, f.name);
    await writeFile(path, bytes);
    console.log(`  wrote ${path}`);
    pdfs.push({ name: f.name, bytes });
  }

  banner(`1/4 INGEST`);
  const documents = [];
  for (const p of pdfs) {
    const t0 = Date.now();
    const doc = await ingest(p.bytes, p.name);
    console.log(
      `  ✓ ${p.name} (${Date.now() - t0}ms) → kind=${doc.kind}, authority=${doc.issuing_authority ?? "—"}, deadline=${doc.deadline ?? "—"}`,
    );
    documents.push(doc);
  }
  await writeFile(join(outDir, "ingest.json"), JSON.stringify({ documents }, null, 2));

  banner(`2/4 ANALYZE`);
  const t1 = Date.now();
  const analysis = await analyze(documents, cfg.user_context);
  console.log(`  analyzer returned in ${Date.now() - t1}ms`);
  console.log(`  recommendation: ${analysis.recommendation.slice(0, 280)}…`);
  for (const o of analysis.options.slice(0, 6))
    console.log(`    [${o.recommendation.padEnd(16)}] ${o.name} (${o.category})`);
  await writeFile(join(outDir, "analysis.json"), JSON.stringify(analysis, null, 2));

  const top =
    analysis.options.find((o) => o.recommendation === "strong") ?? analysis.options[0];
  banner(`3/4 DRAFT — "${top.name}"`);
  const t2 = Date.now();
  const response = await draft(documents, top, cfg.user_context);
  console.log(`  drafter returned in ${Date.now() - t2}ms`);
  console.log(
    `  language=${response.language} | chars=${response.response_text.length} | next_steps=${response.next_steps.length}`,
  );
  await writeFile(
    join(outDir, "draft.json"),
    JSON.stringify({ option: top, response }, null, 2),
  );

  banner(`4/4 HARDEN — adversarial loop (1 iteration)`);
  const t3 = Date.now();
  const { final } = await harden(documents, top, response);
  console.log(`  harden returned in ${Date.now() - t3}ms`);
  console.log(
    `  evidence URLs: ${final.evidence_binder.filter((e) => e.source_url).length}`,
  );
  console.log(
    `  original ${final.original_response.response_text.length} → final ${final.final_response.response_text.length} chars`,
  );
  await writeFile(join(outDir, "harden.json"), JSON.stringify(final, null, 2));

  banner(`CASE COMPLETE: ${slug}`);
  console.log(`  artifacts in ${outDir}`);
  console.log(`  files: ingest.json, analysis.json, draft.json, harden.json + ${cfg.files.length} sample PDFs`);
}

main().catch((e) => {
  console.error(`\nCASE FAILED: ${e.message}`);
  if (e.cause) console.error(`  cause: ${e.cause.code ?? e.cause.message ?? JSON.stringify(e.cause)}`);
  process.exit(1);
});
