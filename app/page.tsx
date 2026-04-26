"use client";

import { useState } from "react";
import type {
  ExtractedDocument,
  ResponseAnalysis,
  ResponseOption,
  ResponseLetter,
  Weakness,
  EvidenceItem,
  CitationVerificationResult,
  CitationVerification,
  ExtractedCitation,
  HardenedResult,
} from "@/lib/types";

type VerifyEvent =
  | { type: "started" }
  | { type: "extracting" }
  | { type: "extracted"; citations: ExtractedCitation[] }
  | { type: "verifier_working"; citation_id: string }
  | { type: "verifier_done"; verification: CitationVerification }
  | { type: "final"; result: CitationVerificationResult }
  | { type: "error"; message: string };

type HardenEvent =
  | { type: "started"; max_iterations: number }
  | { type: "iteration_started"; iteration: number }
  | { type: "counterparty_working"; iteration: number }
  | {
      type: "counterparty_done";
      iteration: number;
      rejection_likelihood: "high" | "medium" | "low";
      overall_assessment: string;
      weaknesses: Weakness[];
    }
  | { type: "converged"; iteration: number }
  | { type: "research_dispatched"; iteration: number; weakness_count: number }
  | {
      type: "researcher_working";
      iteration: number;
      weakness_id: string;
      weakness_title: string;
      queries: string[];
    }
  | {
      type: "researcher_done";
      iteration: number;
      weakness_id: string;
      evidence_count: number;
      evidence: EvidenceItem[];
    }
  | {
      type: "researcher_failed";
      iteration: number;
      weakness_id: string;
      error: string;
    }
  | { type: "reviser_working"; iteration: number }
  | {
      type: "reviser_done";
      iteration: number;
      response_preview: string;
      new_attachment_count: number;
    }
  | {
      type: "final";
      original_response: ResponseLetter;
      final_response: ResponseLetter;
      iterations: unknown[];
      evidence_binder: EvidenceItem[];
    }
  | { type: "error"; message: string };

type UploadedDoc = {
  filename: string;
  document: ExtractedDocument;
};

type Stage = "upload" | "analyze" | "options" | "response" | "harden";

// Noto Sans (regular) covers Latin Extended + Cyrillic + Greek. RTL and CJK are
// roadmap. Returns false for languages the embedded PDF font cannot render.
function isPdfRenderableLanguage(lang: string | null | undefined): boolean {
  if (!lang) return true;
  const code = lang.toLowerCase().slice(0, 2);
  const unsupported = new Set([
    "ar", "fa", "ur", "he", "yi", "ku",   // RTL: Arabic, Persian, Urdu, Hebrew, Yiddish, Kurdish
    "zh", "ja", "ko",                       // CJK
    "th", "lo", "my", "km",                 // SEA: Thai, Lao, Burmese, Khmer
    "hi", "bn", "ta", "te", "ml", "kn", "gu", "pa", // Indic
    "am", "ti",                             // Ethiopic
  ]);
  return !unsupported.has(code);
}

export default function Home() {
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [freeText, setFreeText] = useState("");
  const [uploading, setUploading] = useState<string[]>([]);
  const [stage, setStage] = useState<Stage>("upload");
  const [analysis, setAnalysis] = useState<ResponseAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedOption, setSelectedOption] = useState<ResponseOption | null>(null);
  const [response, setResponse] = useState<ResponseLetter | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hardenEvents, setHardenEvents] = useState<HardenEvent[]>([]);
  const [hardening, setHardening] = useState(false);
  const [hardened, setHardened] = useState<Extract<
    HardenEvent,
    { type: "final" }
  > | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] =
    useState<CitationVerificationResult | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  const [fixSummary, setFixSummary] = useState<{
    before: string;
    after: string;
    notes: string;
  } | null>(null);
  const [demoHarden, setDemoHarden] = useState<HardenedResult | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    for (const file of Array.from(files)) {
      setUploading((u) => [...u, file.name]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/ingest", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Ingest failed");
        setDocs((d) => [...d, { filename: json.filename, document: json.document }]);
      } catch (e) {
        setError(`${file.name}: ${(e as Error).message}`);
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
  }

  async function runAnalysis() {
    setAnalyzing(true);
    setError(null);
    setStage("analyze");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: docs.map((d) => d.document),
          free_text_context: freeText,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analysis failed");
      setAnalysis(json.analysis);
      setStage("options");
    } catch (e) {
      setError((e as Error).message);
      setStage("upload");
    } finally {
      setAnalyzing(false);
    }
  }

  async function runDraft(option: ResponseOption) {
    setSelectedOption(option);
    setDrafting(true);
    setError(null);
    setStage("response");
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: docs.map((d) => d.document),
          option,
          free_text_context: freeText,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Draft failed");
      setResponse(json.response);
    } catch (e) {
      setError((e as Error).message);
      setStage("options");
    } finally {
      setDrafting(false);
    }
  }

  function replayDemoHarden(h: HardenedResult) {
    const synthetic: HardenEvent[] = [];
    synthetic.push({ type: "started", max_iterations: h.iterations.length });
    for (const it of h.iterations) {
      synthetic.push({ type: "iteration_started", iteration: it.iteration });
      synthetic.push({ type: "counterparty_working", iteration: it.iteration });
      synthetic.push({
        type: "counterparty_done",
        iteration: it.iteration,
        rejection_likelihood: it.counterparty_review.rejection_likelihood,
        overall_assessment: it.counterparty_review.overall_assessment,
        weaknesses: it.counterparty_review.weaknesses,
      });
      synthetic.push({
        type: "research_dispatched",
        iteration: it.iteration,
        weakness_count: it.counterparty_review.weaknesses.length,
      });
      for (const w of it.counterparty_review.weaknesses) {
        synthetic.push({
          type: "researcher_working",
          iteration: it.iteration,
          weakness_id: w.id,
          weakness_title: w.title,
          queries: w.suggested_search_queries,
        });
      }
      for (const r of it.research_results) {
        synthetic.push({
          type: "researcher_done",
          iteration: it.iteration,
          weakness_id: r.weakness_id,
          evidence_count: r.evidence.length,
          evidence: r.evidence,
        });
      }
      synthetic.push({ type: "reviser_working", iteration: it.iteration });
      synthetic.push({
        type: "reviser_done",
        iteration: it.iteration,
        response_preview: h.final_response.response_text.slice(0, 400),
        new_attachment_count: h.final_response.attachments_needed.length,
      });
    }
    const finalEvt: Extract<HardenEvent, { type: "final" }> = {
      type: "final",
      original_response: h.original_response,
      final_response: h.final_response,
      iterations: h.iterations,
      evidence_binder: h.evidence_binder,
    };
    synthetic.push(finalEvt);
    setHardenEvents(synthetic);
    setHardened(finalEvt);
  }

  async function runHarden() {
    if (!response || !selectedOption) return;
    setHardenEvents([]);
    setHardened(null);
    setHardening(true);
    setError(null);
    setStage("harden");

    // Pre-recorded harden replay for loaded demos — skips the 5-15 min live run.
    if (demoHarden) {
      replayDemoHarden(demoHarden);
      setHardening(false);
      return;
    }

    try {
      const res = await fetch("/api/harden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: docs.map((d) => d.document),
          option: selectedOption,
          response,
          max_iterations: 2,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
      }
      if (!res.body) throw new Error("no response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
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
          let evt: HardenEvent;
          try {
            evt = JSON.parse(line.slice(6)) as HardenEvent;
          } catch {
            continue;
          }
          setHardenEvents((prev) => [...prev, evt]);
          if (evt.type === "final") setHardened(evt);
          if (evt.type === "error") throw new Error(evt.message);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setHardening(false);
    }
  }

  async function loadDemo(slug: "uk-dwp" | "uk-dwp-corrupted" | "buergergeld") {
    setError(null);
    try {
      const res = await fetch(`/demo/${slug}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const demo = await res.json();
      setDocs(
        demo.documents.map((d: ExtractedDocument, i: number) => ({
          filename: `demo-${slug}-${i + 1}.pdf`,
          document: d,
        })),
      );
      setFreeText(demo.free_text_context ?? "");
      setAnalysis(demo.analysis);
      setSelectedOption(demo.option);
      setResponse(demo.response);
      setVerification(demo.verification ?? null);
      setDemoHarden(demo.hardened ?? null);
      setHardenEvents([]);
      setHardened(null);
      setFixSummary(null);
      setFixing(null);
      setStage("response");
    } catch (e) {
      setError(`Could not load demo: ${(e as Error).message}`);
    }
  }

  async function runVerify() {
    if (!response) return;
    setVerifying(true);
    setError(null);
    setVerification(null);
    try {
      const jurisdictionHint =
        docs.find((d) => d.document.jurisdiction)?.document.jurisdiction ?? undefined;
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response,
          jurisdiction_hint: jurisdictionHint,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        try {
          const j = JSON.parse(text);
          throw new Error(j.error ?? `HTTP ${res.status}`);
        } catch {
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
      }
      if (!res.body) throw new Error("no response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      // Build state incrementally as events stream in.
      let progressive: CitationVerificationResult = {
        citations: [],
        verifications: [],
        summary: {
          total: 0,
          verified: 0,
          mismatch: 0,
          not_found: 0,
          ambiguous: 0,
          skipped: 0,
        },
      };

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
          let evt: VerifyEvent;
          try {
            evt = JSON.parse(line.slice(6)) as VerifyEvent;
          } catch {
            continue;
          }
          if (evt.type === "extracted") {
            progressive = {
              ...progressive,
              citations: evt.citations,
            };
            setVerification({ ...progressive });
          } else if (evt.type === "verifier_done") {
            // Append the new verification, recompute summary on the fly.
            const verifications = [...progressive.verifications, evt.verification];
            const summary = {
              total: progressive.citations.length,
              verified: verifications.filter((v) => v.status === "verified").length,
              mismatch: verifications.filter((v) => v.status === "mismatch").length,
              not_found: verifications.filter((v) => v.status === "not_found").length,
              ambiguous: verifications.filter((v) => v.status === "ambiguous").length,
              skipped: verifications.filter((v) => v.status === "skipped").length,
            };
            progressive = { ...progressive, verifications, summary };
            setVerification({ ...progressive });
          } else if (evt.type === "final") {
            progressive = evt.result;
            setVerification(evt.result);
          } else if (evt.type === "error") {
            throw new Error(evt.message);
          }
        }
      }
    } catch (e) {
      setError(`Citation verification failed: ${(e as Error).message}`);
    } finally {
      setVerifying(false);
    }
  }

  async function runFixCitation(verification: CitationVerification) {
    if (!response || !verification) return;
    if (
      verification.status !== "mismatch" &&
      verification.status !== "not_found"
    )
      return;
    const cit = verification && verificationCitationById(verification.citation_id);
    if (!cit) return;
    setFixing(verification.citation_id);
    setError(null);
    try {
      const res = await fetch("/api/fix-citation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response,
          citation: cit,
          verification,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Auto-fix failed");
      if (json.changed) {
        // Replace the response with the fixed version. Clear verification
        // so the user can re-verify the corrected draft. Drop demo harden
        // because the underlying letter has changed.
        setResponse(json.response);
        setVerification(null);
        setDemoHarden(null);
        setFixSummary({
          before: json.before_excerpt,
          after: json.after_excerpt,
          notes: json.notes,
        });
      } else {
        setError(`Auto-fix declined: ${json.notes}`);
      }
    } catch (e) {
      setError(`Auto-fix failed: ${(e as Error).message}`);
    } finally {
      setFixing(null);
    }
  }

  function verificationCitationById(id: string): ExtractedCitation | null {
    return verification?.citations.find((c) => c.id === id) ?? null;
  }

  async function downloadPacket() {
    if (!response || !selectedOption) return;
    try {
      const res = await fetch("/api/packet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: docs.map((d) => d.document),
          option: selectedOption,
          response,
          evidence_binder: hardened ? hardened.evidence_binder : undefined,
          verification: verification ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `paperwork-${selectedOption.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`Packet download failed: ${(e as Error).message}`);
    }
  }

  function reset() {
    setDocs([]);
    setFreeText("");
    setAnalysis(null);
    setSelectedOption(null);
    setResponse(null);
    setStage("upload");
    setError(null);
    setHardenEvents([]);
    setHardened(null);
    setVerification(null);
    setDemoHarden(null);
    setFixSummary(null);
    setFixing(null);
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 flex items-center justify-center shadow-sm">
              <span className="text-zinc-50 dark:text-zinc-900 font-bold text-sm">P</span>
            </div>
            <div>
              <h1 className="font-semibold tracking-tight leading-none">Paperwork</h1>
              <p className="text-xs text-zinc-500 mt-0.5">answer the letter</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {stage !== "upload" && (
              <button
                onClick={reset}
                className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Start over
              </button>
            )}
            <a
              href="https://github.com/Ridwannurudeen/paperwork"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 px-3 py-1.5 text-zinc-700 dark:text-zinc-300"
              title="View source on GitHub"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              Source
            </a>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Live
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10">
        {error && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-4 py-3 text-sm text-red-900 dark:text-red-200">
            {error}
          </div>
        )}

        {stage === "upload" && (
          <UploadStage
            docs={docs}
            uploading={uploading}
            freeText={freeText}
            setFreeText={setFreeText}
            onFiles={handleFiles}
            onAnalyze={runAnalysis}
            onRemove={(i) => setDocs((d) => d.filter((_, idx) => idx !== i))}
            onLoadDemo={loadDemo}
          />
        )}

        {stage === "analyze" && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Spinner />
            <p className="text-zinc-600 dark:text-zinc-400">
              {analyzing
                ? "Reading the letter and every path you can take…"
                : "Working"}
            </p>
          </div>
        )}

        {stage === "options" && analysis && (
          <OptionsStage
            analysis={analysis}
            onSelect={runDraft}
            onBack={() => setStage("upload")}
          />
        )}

        {stage === "response" && selectedOption && (
          <ResponseStage
            option={selectedOption}
            response={response}
            drafting={drafting}
            verification={verification}
            verifying={verifying}
            fixing={fixing}
            fixSummary={fixSummary}
            onClearFixSummary={() => setFixSummary(null)}
            onFix={runFixCitation}
            onVerify={runVerify}
            onBack={() => {
              setResponse(null);
              setVerification(null);
              setFixSummary(null);
              setStage("options");
            }}
            onHarden={runHarden}
            onDownload={downloadPacket}
          />
        )}

        {stage === "harden" && selectedOption && (
          <HardenStage
            option={selectedOption}
            events={hardenEvents}
            hardening={hardening}
            hardened={hardened}
            onBack={() => setStage("response")}
            onUseHardened={() => {
              if (hardened?.final_response) {
                setResponse(hardened.final_response);
                setVerification(null);
                setStage("response");
              }
            }}
          />
        )}
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-12">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-zinc-500">
          <p className="max-w-2xl">
            Paperwork produces drafts for your review. Not legal advice. You
            are responsible for the accuracy of anything you send to any
            authority.
          </p>
          <div className="flex items-center gap-4 shrink-0">
            <a
              href="https://github.com/Ridwannurudeen/paperwork"
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1.5"
            >
              <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              GitHub
            </a>
            <span className="text-zinc-400 dark:text-zinc-600">·</span>
            <span>Built with Claude Opus 4.7</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function UploadStage({
  docs,
  uploading,
  freeText,
  setFreeText,
  onFiles,
  onAnalyze,
  onRemove,
  onLoadDemo,
}: {
  docs: UploadedDoc[];
  uploading: string[];
  freeText: string;
  setFreeText: (s: string) => void;
  onFiles: (files: FileList | null) => void;
  onAnalyze: () => void;
  onRemove: (i: number) => void;
  onLoadDemo: (slug: "uk-dwp" | "uk-dwp-corrupted" | "buergergeld") => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div className="flex flex-col gap-10">
      {/* Hero */}
      <section className="flex flex-col gap-5">
        <span className="inline-flex self-start items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-medium text-zinc-500 dark:text-zinc-400">
          <span className="h-px w-6 bg-zinc-300 dark:bg-zinc-700" />
          Built with Claude Opus 4.7 · Live demo
        </span>
        <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
          Answer the letter.
          <br />
          <span className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-blue-500 dark:from-emerald-400 dark:via-emerald-300 dark:to-blue-300 bg-clip-text text-transparent">
            Every citation, verified.
          </span>
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl text-base leading-relaxed">
          Adverse government letters — tax, benefits, visa, court, labor,
          utility — read, ranked, and answered in the source language. Three
          agents draft, attack, and rewrite. A fourth checks every legal
          citation against the actual statute on legislation.gov.uk and
          eur-lex before it lands in your packet.
        </p>
        <div className="flex flex-wrap gap-2 text-[11px] font-medium">
          <span className="rounded-full border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-zinc-600 dark:text-zinc-400">
            Web-grounded analyze + draft
          </span>
          <span className="rounded-full border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-zinc-600 dark:text-zinc-400">
            Source-verified citations
          </span>
          <span className="rounded-full border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-zinc-600 dark:text-zinc-400">
            Adversarial harden loop
          </span>
          <span className="rounded-full border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-zinc-600 dark:text-zinc-400">
            Open source · MIT
          </span>
        </div>
      </section>

      {/* Demo CTA card */}
      <section className="relative rounded-2xl border-2 border-emerald-300 dark:border-emerald-900 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-emerald-950/40 p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400 rounded bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5">
                Try first
              </span>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Skip the upload — load a finished case.
              </p>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5">
              Each demo populates the letter, response, and citation audit
              table instantly. Click any verified citation to land on the
              primary source. The corrupted variant shows the verifier
              catching a fabricated reference live.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onLoadDemo("uk-dwp")}
              className="group rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-colors px-4 py-2 text-xs font-medium whitespace-nowrap shadow-sm"
              title="UK Universal Credit overpayment — 5/5 citations verified against legislation.gov.uk."
            >
              🇬🇧 UK · 5/5 verified <span className="opacity-60 group-hover:opacity-100">→</span>
            </button>
            <button
              onClick={() => onLoadDemo("buergergeld")}
              className="group rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-colors px-4 py-2 text-xs font-medium whitespace-nowrap shadow-sm"
              title="German Bürgergeld Aufhebungsbescheid — letter and citations in German, verified against gesetze-im-internet.de."
            >
              🇩🇪 DE · 11/13 verified <span className="opacity-60 group-hover:opacity-100">→</span>
            </button>
            <button
              onClick={() => onLoadDemo("uk-dwp-corrupted")}
              className="group rounded-full bg-white dark:bg-zinc-950 border-2 border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors px-4 py-2 text-xs font-medium whitespace-nowrap"
              title="Same UK case with one citation deliberately mangled — watch the verifier catch the fake."
            >
              ✗ Corrupted draft <span className="opacity-60 group-hover:opacity-100">→</span>
            </button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section>
        <h3 className="text-sm uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 mb-4">
          How it works
        </h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <HowCard
            step="01"
            title="Read"
            body="Vision model extracts authority, deadline, identifiers, key facts. Translates the letter to English on the side, in any of the major language families."
            tone="zinc"
          />
          <HowCard
            step="02"
            title="Draft & verify"
            body="Three agents grounded in web search: ranks every realistic response option, drafts the letter in the source language, and a fourth re-checks every citation against the actual statute."
            tone="emerald"
          />
          <HowCard
            step="03"
            title="Harden"
            body="A counterparty agent attacks the draft as the issuing authority. A researcher gathers public evidence to defend each weakness. A reviser rewrites. You get the audit trail."
            tone="blue"
          />
        </div>
      </section>

      {/* Or upload your own */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 pt-8">
        <h3 className="text-2xl font-semibold tracking-tight">
          Or drop the letter you got.
        </h3>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400 max-w-2xl text-sm">
          Tax notice. Benefit review. Visa refusal. Court summons. Labor
          dispute. Utility fine. Any country, any language.
        </p>
      </section>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
        <span className="font-medium text-zinc-800 dark:text-zinc-200">Before you upload:</span>{" "}
        Your documents go directly to Anthropic for analysis and are not stored
        on our servers — no database, no logs, no retention. Case state lives in
        this browser tab; closing it erases everything. Redact anything you do
        not want a model or a researcher to see. Avoid uploading documents you
        cannot afford to share. By continuing you accept these terms and
        confirm the documents are yours or you have permission to share them.
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragging
            ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900"
            : "border-zinc-300 dark:border-zinc-700"
        }`}
      >
        <p className="text-zinc-700 dark:text-zinc-300">
          Drag files here, or{" "}
          <label className="underline cursor-pointer">
            browse
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>
          {" "}or{" "}
          <label className="underline cursor-pointer">
            take a photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
          </label>
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          PDF, JPG, PNG. Up to 20 MB each. Snap the letter on your kitchen
          table — Paperwork reads paper.
        </p>
      </div>

      {(docs.length > 0 || uploading.length > 0) && (
        <div className="flex flex-col gap-2">
          {uploading.map((name) => (
            <div
              key={name}
              className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm"
            >
              <span className="text-zinc-600 dark:text-zinc-400">{name}</span>
              <span className="text-xs text-zinc-500 flex items-center gap-2">
                <Spinner small /> reading with Opus 4.7
              </span>
            </div>
          ))}
          {docs.map((d, i) => (
            <DocCard key={i} doc={d} onRemove={() => onRemove(i)} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">
          Anything else Paperwork should know? (optional)
        </label>
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="e.g. I can't afford to pay this now. Or: I disagree — I was on leave that day and have proof. Or: I need this to stay legal in the UK while I move."
          className="min-h-[100px] w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {docs.length} document{docs.length === 1 ? "" : "s"} ready
        </p>
        <button
          disabled={docs.length === 0 || uploading.length > 0}
          onClick={onAnalyze}
          className="rounded-full bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-6 py-3 text-sm font-medium disabled:opacity-40"
        >
          Show me my options
        </button>
      </div>
    </div>
  );
}

function HowCard({
  step,
  title,
  body,
  tone,
}: {
  step: string;
  title: string;
  body: string;
  tone: "zinc" | "emerald" | "blue";
}) {
  const accent = {
    zinc: "text-zinc-400 dark:text-zinc-600",
    emerald: "text-emerald-600 dark:text-emerald-400",
    blue: "text-blue-600 dark:text-blue-400",
  }[tone];
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h4>
        <span className={`text-xs font-mono ${accent}`}>{step}</span>
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function DocCard({ doc, onRemove }: { doc: UploadedDoc; onRemove: () => void }) {
  const { document: d } = doc;
  const blockers = d.flags.filter((f) => f.severity === "blocker");
  const warns = d.flags.filter((f) => f.severity === "warn");
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{d.title}</span>
            <span className="text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-zinc-600 dark:text-zinc-400">
              {d.kind.replace(/_/g, " ")}
            </span>
            {d.issuing_authority && (
              <span className="text-xs rounded-full bg-blue-100 dark:bg-blue-950 px-2 py-0.5 text-blue-700 dark:text-blue-300">
                {d.issuing_authority}
              </span>
            )}
            {d.language_detected && (
              <span className="text-xs rounded-full bg-purple-100 dark:bg-purple-950 px-2 py-0.5 text-purple-700 dark:text-purple-300">
                {d.language_detected}
              </span>
            )}
            {blockers.length > 0 && (
              <span className="text-xs rounded-full bg-red-100 dark:bg-red-950 px-2 py-0.5 text-red-700 dark:text-red-300">
                {blockers.length} blocker{blockers.length === 1 ? "" : "s"}
              </span>
            )}
            {warns.length > 0 && (
              <span className="text-xs rounded-full bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                {warns.length} warning{warns.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1">{doc.filename}</p>
          {d.demanded_action && (
            <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">
              <span className="font-medium">Demands:</span> {d.demanded_action}
            </p>
          )}
          {d.deadline && (
            <p className="mt-1 text-xs text-red-700 dark:text-red-300">
              Deadline: {d.deadline}
            </p>
          )}
          {d.translated_summary && (
            <p className="mt-2 text-xs italic text-zinc-600 dark:text-zinc-400">
              “{d.translated_summary}”
            </p>
          )}
          {d.key_facts.length > 0 && (
            <ul className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 list-disc pl-4 space-y-0.5">
              {d.key_facts.slice(0, 4).map((f, i) => (
                <li key={i}>{f}</li>
              ))}
              {d.key_facts.length > 4 && (
                <li className="list-none text-zinc-500">
                  +{d.key_facts.length - 4} more
                </li>
              )}
            </ul>
          )}
          {d.flags.length > 0 && (
            <div className="mt-2 space-y-1">
              {d.flags.map((f, i) => (
                <p
                  key={i}
                  className={`text-xs ${
                    f.severity === "blocker"
                      ? "text-red-700 dark:text-red-300"
                      : f.severity === "warn"
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-zinc-500"
                  }`}
                >
                  • {f.message}
                </p>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onRemove}
          className="text-xs text-zinc-400 hover:text-red-600"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function OptionsStage({
  analysis,
  onSelect,
  onBack,
}: {
  analysis: ResponseAnalysis;
  onSelect: (o: ResponseOption) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Your response options
          </h2>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400 max-w-2xl text-sm">
            {analysis.recommendation}
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Edit case
        </button>
      </div>

      <div className="grid gap-4">
        {analysis.options.map((o) => (
          <OptionCard key={o.id} option={o} onSelect={() => onSelect(o)} />
        ))}
      </div>
    </div>
  );
}

function OptionCard({
  option,
  onSelect,
}: {
  option: ResponseOption;
  onSelect: () => void;
}) {
  const color = {
    strong: "border-green-400 bg-green-50 dark:border-green-900 dark:bg-green-950/30",
    viable: "border-blue-300 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30",
    weak: "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
    not_recommended:
      "border-zinc-300 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900",
  }[option.recommendation];
  const badge = {
    strong: "bg-green-600 text-white",
    viable: "bg-blue-600 text-white",
    weak: "bg-amber-600 text-white",
    not_recommended: "bg-zinc-500 text-white",
  }[option.recommendation];
  return (
    <div className={`rounded-xl border-2 ${color} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{option.name}</h3>
            <span className={`text-xs rounded-full px-2 py-0.5 ${badge}`}>
              {option.recommendation.replace(/_/g, " ")}
            </span>
            <span className="text-xs rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 text-zinc-600 dark:text-zinc-400">
              {option.category}
            </span>
          </div>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            {option.summary}
          </p>
          <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs">
            {option.why_it_fits.length > 0 && (
              <div>
                <p className="font-medium text-green-800 dark:text-green-300">
                  Why it fits
                </p>
                <ul className="mt-1 list-disc pl-4 text-zinc-700 dark:text-zinc-300 space-y-0.5">
                  {option.why_it_fits.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {option.why_it_might_not.length > 0 && (
              <div>
                <p className="font-medium text-red-800 dark:text-red-300">
                  Why it might not
                </p>
                <ul className="mt-1 list-disc pl-4 text-zinc-700 dark:text-zinc-300 space-y-0.5">
                  {option.why_it_might_not.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5">
              Timeline: {option.estimated_timeline_days.low}–
              {option.estimated_timeline_days.high} days
            </span>
            <span className="rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5">
              Cost: ${option.estimated_cost_usd.low}–$
              {option.estimated_cost_usd.high}
            </span>
            {option.forms_or_documents.length > 0 && (
              <span className="rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5">
                Forms: {option.forms_or_documents.slice(0, 2).join(", ")}
              </span>
            )}
          </div>
        </div>
        <button
          disabled={option.recommendation === "not_recommended"}
          onClick={onSelect}
          className="rounded-full bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-xs font-medium disabled:opacity-30 whitespace-nowrap"
        >
          Draft the response →
        </button>
      </div>
    </div>
  );
}

function ResponseStage({
  option,
  response,
  drafting,
  verification,
  verifying,
  fixing,
  fixSummary,
  onClearFixSummary,
  onFix,
  onVerify,
  onBack,
  onHarden,
  onDownload,
}: {
  option: ResponseOption;
  response: ResponseLetter | null;
  drafting: boolean;
  verification: CitationVerificationResult | null;
  verifying: boolean;
  fixing: string | null;
  fixSummary: { before: string; after: string; notes: string } | null;
  onClearFixSummary: () => void;
  onFix: (verification: CitationVerification) => void;
  onVerify: () => void;
  onBack: () => void;
  onHarden: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Response for</p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {option.name}
          </h2>
          {response && (
            <p className="text-xs text-zinc-500 mt-1">
              Written in{" "}
              <span className="font-mono">{response.language}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {response && (
            <>
              <button
                onClick={onDownload}
                disabled={!isPdfRenderableLanguage(response.language)}
                title={
                  isPdfRenderableLanguage(response.language)
                    ? undefined
                    : `Packet PDF currently embeds Noto Sans (Latin/Cyrillic/Greek). The response is in ${response.language} — copy the letter from the page above instead. RTL and CJK fonts are roadmap.`
                }
                className="rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium"
              >
                {isPdfRenderableLanguage(response.language)
                  ? "Download packet"
                  : "Download packet (script unsupported)"}
              </button>
              <button
                onClick={onVerify}
                disabled={verifying}
                className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 px-4 py-2 text-sm font-medium flex items-center gap-2"
                title={
                  verification
                    ? "Re-runs the verifier live — uses ~3 minutes and one of your hourly verify quota. The current panel below was loaded from the demo or a previous run."
                    : "A second-pass agent extracts every legal citation in your draft and verifies each one against primary sources via web search."
                }
              >
                {verifying ? (
                  <>
                    <Spinner small /> Verifying citations…
                  </>
                ) : verification ? (
                  <>↻ Re-verify live (~3 min)</>
                ) : (
                  <>✓ Verify citations</>
                )}
              </button>
              <button
                onClick={onHarden}
                className="rounded-full bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium flex items-center gap-2"
                title="Adversarial loop: a counterparty agent attacks this response, a researcher gathers web evidence, a reviser rewrites."
              >
                <span className="w-2 h-2 rounded-full bg-red-300 animate-pulse" />
                Stress-test with opposition
              </button>
            </>
          )}
          <button
            onClick={onBack}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Options
          </button>
        </div>
      </div>

      {drafting && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Spinner />
          <p className="text-zinc-600 dark:text-zinc-400">
            Drafting your reply…
          </p>
        </div>
      )}

      {response && (
        <div className="flex flex-col gap-6">
          <Section title="Your response letter">
            <pre className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 whitespace-pre-wrap font-sans text-sm leading-relaxed bg-white dark:bg-zinc-950">
              {response.response_text}
            </pre>
          </Section>

          {fixSummary && (
            <FixSummaryBanner summary={fixSummary} onDismiss={onClearFixSummary} />
          )}

          {(verification || verifying) && (
            <Section title="Citation verification">
              <CitationsPanel
                verification={verification}
                verifying={verifying}
                fixing={fixing}
                onFix={onFix}
              />
            </Section>
          )}

          {response.next_steps.length > 0 && (
            <Section title="Deadlines and next steps">
              <div className="flex flex-col gap-2">
                {response.next_steps.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 p-3 text-sm"
                  >
                    <span className="font-mono text-xs text-blue-700 dark:text-blue-300">
                      {s.by_date}
                    </span>
                    <span className="ml-3">{s.action}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {response.attachments_needed.length > 0 && (
            <Section title="Attachments to send with this response">
              <div className="flex flex-col gap-2">
                {response.attachments_needed.map((ex, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 text-sm"
                  >
                    <p className="font-medium">{ex.label}</p>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      {ex.description}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Source: {ex.source}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {response.weak_points.length > 0 && (
            <Section title="Weak points to address">
              <div className="flex flex-col gap-3">
                {response.weak_points.map((w, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 text-sm"
                  >
                    <p className="font-medium text-amber-900 dark:text-amber-200">
                      {w.point}
                    </p>
                    <p className="mt-1 text-amber-800 dark:text-amber-300">
                      → {w.mitigation}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function CitationsPanel({
  verification,
  verifying,
  fixing,
  onFix,
}: {
  verification: CitationVerificationResult | null;
  verifying: boolean;
  fixing: string | null;
  onFix: (verification: CitationVerification) => void;
}) {
  // No state yet — extractor still running.
  if (verifying && (!verification || verification.citations.length === 0)) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-sm flex items-center gap-3">
        <Spinner small />
        <span className="text-zinc-700 dark:text-zinc-300">
          Extracting citations from the draft…
        </span>
      </div>
    );
  }
  if (!verification) return null;
  const { summary, citations, verifications } = verification;

  if (citations.length === 0 && !verifying) {
    return (
      <p className="text-sm text-zinc-500 italic">
        No legal citations were extracted from this draft.
      </p>
    );
  }

  const verifMap = new Map<string, CitationVerification>(
    verifications.map((v) => [v.citation_id, v]),
  );

  const total = citations.length;
  const completed = verifications.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <SummaryPill label="verified" count={summary.verified} tone="green" />
        <SummaryPill label="mismatch" count={summary.mismatch} tone="red" />
        <SummaryPill label="not found" count={summary.not_found} tone="red" />
        <SummaryPill label="ambiguous" count={summary.ambiguous} tone="amber" />
        <SummaryPill label="skipped" count={summary.skipped} tone="zinc" />
        <span className="text-zinc-500 self-center ml-1">
          {verifying
            ? `${completed} of ${total} checked${completed < total ? "…" : ""}`
            : `out of ${total} extracted citation${total === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {citations.map((c) => {
          const v = verifMap.get(c.id);
          return (
            <CitationRow
              key={c.id}
              citation={c}
              verification={v}
              fixing={fixing === c.id}
              onFix={onFix}
            />
          );
        })}
      </div>
    </div>
  );
}

function FixSummaryBanner({
  summary,
  onDismiss,
}: {
  summary: { before: string; after: string; notes: string };
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-lg border-2 border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">
            Auto-fix applied
          </p>
          <p className="text-emerald-800 dark:text-emerald-300 text-xs mt-1">
            {summary.notes}
          </p>
          <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-medium text-red-700 dark:text-red-300 mb-1">
                Before
              </p>
              <p className="text-zinc-700 dark:text-zinc-300 italic line-through decoration-red-400/70">
                {summary.before}
              </p>
            </div>
            <div>
              <p className="font-medium text-emerald-700 dark:text-emerald-300 mb-1">
                After
              </p>
              <p className="text-zinc-700 dark:text-zinc-300">
                {summary.after}
              </p>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-3">
            Click <strong>Re-verify live</strong> to confirm the fix lands clean.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 shrink-0"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function SummaryPill({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "green" | "red" | "amber" | "zinc";
}) {
  if (count === 0)
    return (
      <span className="rounded-full px-2 py-0.5 bg-zinc-100 dark:bg-zinc-900 text-zinc-500">
        {count} {label}
      </span>
    );
  const cls = {
    green: "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200",
    red: "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200",
    amber: "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200",
    zinc: "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400",
  }[tone];
  return (
    <span className={`rounded-full px-2 py-0.5 font-medium ${cls}`}>
      {count} {label}
    </span>
  );
}

function CitationRow({
  citation,
  verification,
  fixing,
  onFix,
}: {
  citation: ExtractedCitation;
  verification: CitationVerification | undefined;
  fixing: boolean;
  onFix: (verification: CitationVerification) => void;
}) {
  // Pending — extractor returned this citation but verifier hasn't completed yet.
  if (!verification) {
    return (
      <div className="rounded-lg border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-3 text-sm flex items-center gap-2 flex-wrap">
        <span className="text-xs rounded-full px-2 py-0.5 font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 inline-flex items-center gap-1.5">
          <Spinner small />
          checking
        </span>
        <span className="font-medium">{citation.text}</span>
        {citation.type && (
          <span className="text-xs rounded-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 text-zinc-600 dark:text-zinc-400">
            {citation.type}
          </span>
        )}
        <span className="text-xs text-zinc-500 ml-auto truncate max-w-[40%]">
          {citation.lookup_query}
        </span>
      </div>
    );
  }

  const tone = {
    verified:
      "border-emerald-300 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30",
    mismatch: "border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30",
    not_found: "border-red-400 dark:border-red-900 bg-red-50 dark:bg-red-950/30",
    ambiguous:
      "border-amber-300 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30",
    skipped: "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50",
  }[verification.status];
  const badge = {
    verified: "bg-emerald-600 text-white",
    mismatch: "bg-red-600 text-white",
    not_found: "bg-red-700 text-white",
    ambiguous: "bg-amber-600 text-white",
    skipped: "bg-zinc-500 text-white",
  }[verification.status];
  const icon = {
    verified: "✓",
    mismatch: "≠",
    not_found: "✗",
    ambiguous: "?",
    skipped: "—",
  }[verification.status];
  const fixable =
    verification.status === "mismatch" || verification.status === "not_found";

  return (
    <details
      className={`rounded-lg border-2 ${tone} p-3 text-sm`}
      open={fixable}
    >
      <summary className="cursor-pointer flex items-center gap-2 flex-wrap">
        <span
          className={`text-xs rounded-full px-2 py-0.5 font-mono ${badge}`}
        >
          {icon} {verification.status.replace(/_/g, " ")}
        </span>
        <span className="font-medium">{citation.text}</span>
        {citation.type && (
          <span className="text-xs rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 text-zinc-600 dark:text-zinc-400">
            {citation.type}
          </span>
        )}
      </summary>
      <div className="mt-3 flex flex-col gap-2 text-xs">
        {citation.context && (
          <p className="italic text-zinc-600 dark:text-zinc-400">
            “{citation.context}”
          </p>
        )}
        <p className="text-zinc-700 dark:text-zinc-300">{verification.notes}</p>
        {verification.source_quote && (
          <blockquote className="border-l-2 border-zinc-400 dark:border-zinc-600 pl-3 text-zinc-700 dark:text-zinc-300">
            {verification.source_quote}
          </blockquote>
        )}
        {verification.source_url && (
          <a
            href={verification.source_url}
            target="_blank"
            rel="noreferrer"
            className="underline text-blue-700 dark:text-blue-300 break-all"
          >
            {verification.source_title ?? verification.source_url}
          </a>
        )}
        {fixable && (
          <div className="mt-1">
            <button
              onClick={(e) => {
                e.preventDefault();
                onFix(verification);
              }}
              disabled={fixing}
              className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 px-3 py-1.5 text-xs font-medium inline-flex items-center gap-2"
              title="Rewrite the response so this citation uses the correct primary source the verifier just found."
            >
              {fixing ? (
                <>
                  <Spinner small /> Fixing the letter…
                </>
              ) : (
                <>↻ Auto-fix this citation</>
              )}
            </button>
          </div>
        )}
      </div>
    </details>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-sm uppercase tracking-wider text-zinc-500 mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Spinner({ small = false }: { small?: boolean }) {
  const size = small ? "w-3 h-3 border-2" : "w-8 h-8 border-4";
  return (
    <span
      className={`inline-block ${size} border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100 rounded-full animate-spin`}
    />
  );
}

type CounterpartyDoneEvt = Extract<HardenEvent, { type: "counterparty_done" }>;
type ResearcherWorkingEvt = Extract<HardenEvent, { type: "researcher_working" }>;
type ResearcherDoneEvt = Extract<HardenEvent, { type: "researcher_done" }>;
type ResearcherFailedEvt = Extract<HardenEvent, { type: "researcher_failed" }>;
type ReviserDoneEvt = Extract<HardenEvent, { type: "reviser_done" }>;
type FinalEvt = Extract<HardenEvent, { type: "final" }>;

function HardenStage({
  option,
  events,
  hardening,
  hardened,
  onBack,
  onUseHardened,
}: {
  option: ResponseOption;
  events: HardenEvent[];
  hardening: boolean;
  hardened: FinalEvt | null;
  onBack: () => void;
  onUseHardened: () => void;
}) {
  const counter = events.find((e) => e.type === "counterparty_done") as
    | CounterpartyDoneEvt
    | undefined;
  const counterWorking =
    !counter && events.some((e) => e.type === "counterparty_working");

  const researcherWorking = events.filter(
    (e): e is ResearcherWorkingEvt => e.type === "researcher_working",
  );
  const researcherDone = events.filter(
    (e): e is ResearcherDoneEvt => e.type === "researcher_done",
  );
  const researcherFailed = events.filter(
    (e): e is ResearcherFailedEvt => e.type === "researcher_failed",
  );
  const doneIds = new Set([
    ...researcherDone.map((e) => e.weakness_id),
    ...researcherFailed.map((e) => e.weakness_id),
  ]);
  const researcherInFlight = researcherWorking.filter(
    (w) => !doneIds.has(w.weakness_id),
  );

  const reviserWorking =
    !events.some((e) => e.type === "reviser_done") &&
    events.some((e) => e.type === "reviser_working");
  const reviserDone = events.find((e) => e.type === "reviser_done") as
    | ReviserDoneEvt
    | undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Stress-testing</p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {option.name}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Three agents are fighting your response. One attacks as the
            authority, one researches, one rewrites.
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Response
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <AgentColumn
          title="Counterparty"
          subtitle="adversarial review"
          accent="red"
          working={counterWorking}
          done={!!counter}
        >
          {counter && (
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 uppercase">
                  Rejection likelihood
                </span>
                <span
                  className={`text-xs rounded-full px-2 py-0.5 ${
                    counter.rejection_likelihood === "high"
                      ? "bg-red-600 text-white"
                      : counter.rejection_likelihood === "medium"
                        ? "bg-amber-600 text-white"
                        : "bg-green-600 text-white"
                  }`}
                >
                  {counter.rejection_likelihood}
                </span>
              </div>
              <p className="text-zinc-700 dark:text-zinc-300 text-xs italic">
                {counter.overall_assessment}
              </p>
              <div className="flex flex-col gap-2 mt-2">
                {counter.weaknesses.map((w) => (
                  <div
                    key={w.id}
                    className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] uppercase rounded-full px-1.5 py-0.5 ${
                          w.severity === "high"
                            ? "bg-red-700 text-white"
                            : w.severity === "medium"
                              ? "bg-amber-600 text-white"
                              : "bg-zinc-500 text-white"
                        }`}
                      >
                        {w.severity}
                      </span>
                      <span className="text-xs font-medium">{w.title}</span>
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1">
                      {w.description}
                    </p>
                    <p className="text-xs text-red-800 dark:text-red-300 mt-1 italic">
                      They will cite: {w.what_counterparty_will_cite}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </AgentColumn>

        <AgentColumn
          title="Researcher"
          subtitle="web evidence"
          accent="blue"
          working={researcherInFlight.length > 0}
          done={!!counter && researcherInFlight.length === 0 && researcherDone.length > 0}
        >
          <div className="flex flex-col gap-2">
            {researcherInFlight.map((w) => (
              <div
                key={w.weakness_id}
                className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 p-3 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Spinner small />
                  <span className="font-medium">{w.weakness_title}</span>
                </div>
                <ul className="mt-1 list-disc pl-4 text-zinc-600 dark:text-zinc-400">
                  {w.queries.slice(0, 2).map((q, i) => (
                    <li key={i} className="truncate">
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {researcherDone.map((r) => (
              <div
                key={r.weakness_id}
                className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-white dark:bg-zinc-950 p-3 text-xs"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-blue-700 dark:text-blue-300">✓</span>
                  <span className="font-medium">{r.weakness_id}</span>
                  <span className="text-zinc-500">
                    {r.evidence_count} evidence
                  </span>
                </div>
                <ul className="list-disc pl-4 text-zinc-700 dark:text-zinc-300 space-y-0.5">
                  {r.evidence.slice(0, 3).map((e, i) => (
                    <li key={i}>
                      {e.source_url ? (
                        <a
                          href={e.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline truncate block"
                        >
                          {e.source_title}
                        </a>
                      ) : (
                        <span>{e.source_title}</span>
                      )}
                    </li>
                  ))}
                  {r.evidence.length > 3 && (
                    <li className="text-zinc-500 list-none">
                      +{r.evidence.length - 3} more
                    </li>
                  )}
                </ul>
              </div>
            ))}
            {researcherFailed.map((r) => (
              <div
                key={r.weakness_id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 text-xs text-zinc-500"
              >
                ✗ {r.weakness_id}: {r.error}
              </div>
            ))}
          </div>
        </AgentColumn>

        <AgentColumn
          title="Reviser"
          subtitle="response rewrite"
          accent="green"
          working={reviserWorking}
          done={!!reviserDone}
        >
          {reviserDone && (
            <div className="flex flex-col gap-2 text-xs">
              <p className="text-zinc-500">
                {reviserDone.new_attachment_count} attachments in revised
                response
              </p>
              <pre className="rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/30 p-3 whitespace-pre-wrap font-sans text-zinc-700 dark:text-zinc-300">
                {reviserDone.response_preview}
                {"\n…"}
              </pre>
            </div>
          )}
        </AgentColumn>
      </div>

      {hardened && (
        <div className="rounded-xl border-2 border-green-400 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold">Hardened response ready</h3>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">
              {hardened.evidence_binder.length} new evidence items gathered
              from the web.{" "}
              {Math.max(
                0,
                hardened.final_response.attachments_needed.length -
                  hardened.original_response.attachments_needed.length,
              )}{" "}
              new attachments added.{" "}
              {hardened.final_response.response_text.length -
                hardened.original_response.response_text.length}{" "}
              characters added to the letter.
            </p>
          </div>
          <button
            onClick={onUseHardened}
            className="rounded-full bg-green-600 text-white hover:bg-green-700 px-4 py-2 text-sm font-medium whitespace-nowrap"
          >
            Use hardened response →
          </button>
        </div>
      )}

      {hardening && !hardened && (
        <p className="text-xs text-zinc-500 text-center">
          This takes 5–15 minutes of live agent work. Heartbeats keep the
          connection open.
        </p>
      )}
    </div>
  );
}

function AgentColumn({
  title,
  subtitle,
  accent,
  working,
  done,
  children,
}: {
  title: string;
  subtitle: string;
  accent: "red" | "blue" | "green";
  working: boolean;
  done: boolean;
  children: React.ReactNode;
}) {
  const color = {
    red: "border-red-300 dark:border-red-900",
    blue: "border-blue-300 dark:border-blue-900",
    green: "border-green-300 dark:border-green-900",
  }[accent];
  const dot = {
    red: "bg-red-500",
    blue: "bg-blue-500",
    green: "bg-green-500",
  }[accent];
  return (
    <div className={`rounded-xl border-2 ${color} p-4 min-h-[300px]`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {working && <Spinner small />}
          {done && <span className={`w-2 h-2 rounded-full ${dot}`} />}
        </div>
      </div>
      {children ?? <p className="text-xs text-zinc-400 italic">waiting…</p>}
    </div>
  );
}
