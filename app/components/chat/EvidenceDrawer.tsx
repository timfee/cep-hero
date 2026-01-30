import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface EvidenceDrawerProps {
  title?: string;
  planSteps?: string[];
  hypotheses?: Array<{
    cause: string;
    confidence: number;
    evidence?: string[];
  }>;
  nextSteps?: string[];
  missingQuestions?: Array<{
    question: string;
    why?: string;
    example?: string;
  }>;
  evidence?: {
    checks?: Array<{
      name: string;
      status: string;
      detail?: string;
      source?: string;
    }>;
    gaps?: Array<{ missing: string; why: string }>;
    signals?: Array<{
      type: string;
      source: string;
      summary: string;
      referenceUrl?: string;
    }>;
  };
}

export function EvidenceDrawer({
  title = "Reasoning & Evidence",
  planSteps = [],
  hypotheses = [],
  nextSteps = [],
  missingQuestions = [],
  evidence,
}: EvidenceDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left text-xs uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-300"
      >
        <span>{title}</span>
        {open ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3 text-sm">
          {planSteps.length ? (
            <Section label="What I checked">
              <ul className="list-disc space-y-1 pl-4 text-zinc-300">
                {planSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </Section>
          ) : null}

          {hypotheses.length ? (
            <Section label="Hypotheses">
              <ul className="list-disc space-y-1 pl-4 text-zinc-300">
                {hypotheses.map((h, i) => (
                  <li key={i}>
                    {h.cause} (confidence{" "}
                    {Math.round((h.confidence ?? 0) * 100)}%)
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {nextSteps.length ? (
            <Section label="Next steps">
              <ul className="list-disc space-y-1 pl-4 text-zinc-300">
                {nextSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </Section>
          ) : null}

          {missingQuestions.length ? (
            <Section label={`Need answers (${missingQuestions.length})`}>
              <ul className="list-disc space-y-1 pl-4 text-zinc-300">
                {missingQuestions.map((q, i) => (
                  <li key={i}>
                    <span className="text-zinc-100">{q.question}</span>
                    {q.why ? (
                      <span className="text-zinc-500"> — {q.why}</span>
                    ) : null}
                    {q.example ? (
                      <div className="text-[11px] text-zinc-500">
                        Example: {q.example}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {evidence?.checks?.length ? (
            <Section label="Checks">
              <ul className="space-y-1 text-zinc-300">
                {evidence.checks.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded border border-white/5 bg-black/30 px-2 py-1"
                  >
                    <div className="flex flex-col">
                      <span className="text-zinc-100">{c.name}</span>
                      {c.detail ? (
                        <span className="text-[11px] text-zinc-500">
                          {c.detail}
                        </span>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "text-[11px] uppercase tracking-[0.2em]",
                        c.status === "pass"
                          ? "text-emerald-400"
                          : c.status === "fail"
                            ? "text-red-400"
                            : "text-zinc-500"
                      )}
                    >
                      {c.status}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {evidence?.signals?.length ? (
            <Section label="Signals">
              <ul className="space-y-2 text-zinc-300">
                {evidence.signals.map((s, i) => (
                  <li
                    key={i}
                    className="rounded border border-white/5 bg-black/30 p-2"
                  >
                    <div className="text-zinc-100">{s.summary}</div>
                    <div className="text-[11px] text-zinc-500">
                      Source: {s.source}
                    </div>
                    {s.referenceUrl ? (
                      <a
                        href={s.referenceUrl}
                        target="_blank"
                        rel="noopener"
                        className="text-[11px] text-blue-400 hover:text-blue-300"
                      >
                        Reference
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {evidence?.gaps?.length ? (
            <Section label="Gaps">
              <ul className="list-disc space-y-1 pl-4 text-zinc-300">
                {evidence.gaps.map((g, i) => (
                  <li key={i}>
                    {g.missing} — {g.why}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </div>
      {children}
    </div>
  );
}
