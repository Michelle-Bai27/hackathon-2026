"use client";

import { Plus } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { lecturePath } from "@/lib/store";

export function HomeDashboard() {
  const { recents, setUploadOpen, openLecture, data } = useApp();
  const isEmpty = data.lectures.length === 0;

  if (isEmpty) {
    return (
      <div className="flex h-full flex-col items-start justify-center px-16 py-12">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Lumen</p>
        <h1 className="mt-4 max-w-xl font-[family-name:var(--font-display)] text-5xl leading-[1.15] text-ink">
          Ready to study?
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-muted">
          Upload your first lecture to turn it into an interactive study session. We’ll read your
          PDF or PowerPoint, explain each slide, then help you revise and quiz yourself — from your
          material, not a sample course.
        </p>
        <button type="button" onClick={() => setUploadOpen(true)} className="btn-primary mt-10 inline-flex items-center gap-2">
          <Plus size={16} />
          Upload Lecture
        </button>
        <p className="mt-4 text-xs text-muted">PDF or PowerPoint (.pptx)</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-12 py-12">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Lumen</p>
      <h1 className="mt-4 max-w-xl font-[family-name:var(--font-display)] text-5xl leading-[1.15] text-ink">
        Ready to study?
      </h1>
      <p className="mt-4 max-w-lg text-base leading-relaxed text-muted">
        Open a lecture from the sidebar, or upload another file to start a new session.
      </p>
      <div className="mt-10 flex gap-3">
        <button type="button" onClick={() => setUploadOpen(true)} className="btn-primary inline-flex items-center gap-2">
          <Plus size={16} />
          Upload Lecture
        </button>
      </div>
      <div className="mt-14 max-w-3xl">
        <h2 className="text-sm font-medium text-ink">Recent lectures</h2>
        <div className="mt-3 divide-y divide-line rounded-2xl border border-line bg-paper">
          {recents.map((lec) => (
            <button
              key={lec.id}
              type="button"
              onClick={() => openLecture(lec.id)}
              className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-sidebar/60"
            >
              <div>
                <p className="text-sm font-medium">{lec.title}</p>
                <p className="text-xs text-muted">{lecturePath(data, lec)}</p>
              </div>
              <span className="text-xs capitalize text-muted">
                {lec.processingStatus === "ready" ? "Ready" : lec.processingStatus}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
