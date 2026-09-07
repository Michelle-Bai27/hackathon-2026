"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { findSlides } from "@/lib/store";
import type { WorkspaceMode } from "@/lib/types";
import { SlideViewer } from "./SlideViewer";
import { TutorPanel } from "./TutorPanel";
import { NotesView } from "@/components/notes/NotesView";
import { QuizView } from "@/components/quiz/QuizView";
import { ProcessingOverlay } from "@/components/processing/ProcessingOverlay";

export function StudyWorkspace({ lectureId }: { lectureId: string }) {
  const { data, processing } = useApp();
  const lecture = data.lectures.find((l) => l.id === lectureId);
  const slides = useMemo(() => findSlides(data, lectureId), [data, lectureId]);
  const [mode, setMode] = useState<WorkspaceMode>("study");
  const [index, setIndex] = useState(0);
  const notes = data.notes.find((n) => n.lectureId === lectureId);
  const quiz = data.quizzes.find((q) => q.lectureId === lectureId);
  const knowledge = (data.knowledge ?? []).find((k) => k.lectureId === lectureId);
  const slide = slides[index];
  const conversation =
    data.conversations.find((c) => c.lectureId === lectureId && c.slideId === slide?.id)?.messages ?? [];

  function jumpToSlide(slideNumber: number) {
    const i = slides.findIndex((s) => s.slideNumber === slideNumber);
    if (i >= 0) {
      setIndex(i);
      setMode("study");
    }
  }

  if (!lecture) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        This lecture is no longer in your notebook.
      </div>
    );
  }

  const showProcessing =
    (processing?.lectureId === lectureId && processing.status !== "ready") ||
    ["queued", "reading", "structure", "concepts", "tutor", "notes"].includes(lecture.processingStatus);

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-line px-6 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
            {[
              lecture.classId ? data.classes.find((c) => c.id === lecture.classId)?.name : null,
              lecture.folderId ? data.folders.find((f) => f.id === lecture.folderId)?.name : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Lecture"}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-xl">{lecture.title}</h1>
        </div>
        <div className="flex rounded-full border border-line bg-paper p-1">
          {(["study", "notes", "quiz"] as WorkspaceMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 text-sm capitalize ${
                mode === m ? "bg-ink text-paper" : "text-muted hover:text-ink"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </header>
      {lecture.processingStatus === "error" ? (
        <div className="border-b border-line bg-terracotta/10 px-6 py-3 text-sm">
          {lecture.processingError ?? "We couldn't fully analyze this lecture. You can retry processing."}
        </div>
      ) : null}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {mode === "study" ? (
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-h-0 min-w-0 overflow-hidden">
              <SlideViewer
                slides={slides}
                index={index}
                onIndex={setIndex}
                lectureId={lecture.id}
                fileKind={lecture.type}
              />
            </div>
            <TutorPanel
              lecture={lecture}
              slides={slides}
              index={index}
              conversation={conversation}
              knowledge={knowledge}
            />
          </div>
        ) : null}
        {mode === "notes" ? (
          <NotesView
            lecture={lecture}
            slides={slides}
            notes={notes}
            knowledge={knowledge}
            onJumpToSlide={jumpToSlide}
          />
        ) : null}
        {mode === "quiz" ? (
          <QuizView
            lecture={lecture}
            slides={slides}
            quiz={quiz}
            knowledge={knowledge}
            onJumpToSlide={jumpToSlide}
          />
        ) : null}
        {showProcessing ? (
          <ProcessingOverlay
            status={processing?.lectureId === lectureId ? processing.status : lecture.processingStatus}
            detail={processing?.detail}
          />
        ) : null}
      </div>
    </div>
  );
}
