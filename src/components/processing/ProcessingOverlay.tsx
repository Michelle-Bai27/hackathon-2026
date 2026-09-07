"use client";

import { PROCESS_STAGES } from "@/lib/processing";
import type { ProcessingStatus } from "@/lib/types";

export function ProcessingOverlay({
  status,
  detail,
}: {
  status: ProcessingStatus;
  detail?: string;
}) {
  const currentIndex = PROCESS_STAGES.findIndex((s) => s.id === status);
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper/88 backdrop-blur-[2px]">
      <div className="w-[380px] rounded-3xl border border-line bg-paper p-8 shadow-xl">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Please wait</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl">Analyzing your lecture...</h2>
        {detail ? <p className="mt-2 text-sm text-muted">{detail}</p> : null}
        <ol className="mt-6 space-y-2.5">
          {PROCESS_STAGES.map((stage, i) => {
            const done = currentIndex > i || status === "ready";
            const active = stage.id === status;
            return (
              <li key={stage.id} className="flex items-center gap-3 text-sm">
                <span
                  className={`h-2 w-2 rounded-full ${
                    done ? "bg-accent" : active ? "bg-terracotta" : "bg-line"
                  }`}
                />
                <span className={active ? "text-ink" : "text-muted"}>{stage.label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
