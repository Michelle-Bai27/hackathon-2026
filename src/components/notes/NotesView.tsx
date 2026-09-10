"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { runAi } from "@/lib/ai/client";
import { OriginalSlideThumb } from "@/components/study/OriginalSlide";
import type { LectureKnowledge, LectureRecord, NotesDetail, NotesRecord, SlideRecord } from "@/lib/types";

export function NotesView({
  lecture,
  slides,
  notes,
  knowledge,
  onJumpToSlide,
}: {
  lecture: LectureRecord;
  slides: SlideRecord[];
  notes?: NotesRecord;
  knowledge?: LectureKnowledge | null;
  onJumpToSlide?: (slideNumber: number) => void;
}) {
  const { saveNotes } = useApp();
  const [detail, setDetail] = useState<NotesDetail>(notes?.detail ?? "standard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (notes || busy) return;
    void regenerate(detail);
    // generate once when this lecture has no notes yet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecture.id]);
  const figureSlides = useMemo(
    () =>
      slides.filter(
        (s) =>
          notes?.imageSlideNumbers.includes(s.slideNumber) || Boolean(s.diagramId || s.imageId),
      ).slice(0, 3),
    [notes?.imageSlideNumbers, slides],
  );

  async function regenerate(next: NotesDetail) {
    setDetail(next);
    setBusy(true);
    setError(null);
    try {
      const generated = await runAi<NotesRecord>({
        kind: "notes",
        lecture,
        slides,
        detail: next,
        knowledge,
      });
      saveNotes({ ...generated, lectureId: lecture.id, detail: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Notes could not be generated from this lecture.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-y-auto px-10 py-10">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Revision notes</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl text-ink">{lecture.title}</h1>
        </div>
        <div className="flex rounded-full border border-line bg-paper p-1 text-xs">
          {(["concise", "standard", "detailed"] as NotesDetail[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => regenerate(level)}
              className={`rounded-full px-3 py-1.5 capitalize ${
                detail === level ? "bg-ink text-paper" : "text-muted"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
      {busy ? <p className="mb-4 text-sm text-muted">Regenerating notes…</p> : null}
      {error ? <p className="mb-4 text-sm text-terracotta">{error}</p> : null}
      {figureSlides.length ? (
        <div className="mb-8 grid grid-cols-3 gap-3">
          {figureSlides.map((slide) => (
            <div key={slide.id} className="overflow-hidden rounded-lg border border-line">
              <div className="aspect-video">
                <OriginalSlideThumb slide={slide} />
              </div>
              <button
                type="button"
                className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted hover:text-ink"
                onClick={() => onJumpToSlide?.(slide.slideNumber)}
              >
                See Slide {slide.slideNumber}
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <article className="notes-body pb-16">
        {(notes?.markdown ?? "_Notes will appear here after processing._").split("\n").map((line, i) => {
          if (line.startsWith("# ")) return <h1 key={i}>{line.slice(2)}</h1>;
          if (line.startsWith("## ")) {
            return (
              <h2 key={i}>
                {renderInline(line.slice(3), onJumpToSlide)}
              </h2>
            );
          }
          if (line.startsWith("### ")) return <h3 key={i}>{renderInline(line.slice(4), onJumpToSlide)}</h3>;
          if (line.startsWith("> ")) return <blockquote key={i}>{line.slice(2)}</blockquote>;
          if (line.startsWith("- ")) {
            return (
              <li key={i} className="ml-5 list-disc">
                {renderInline(line.slice(2), onJumpToSlide)}
              </li>
            );
          }
          if (!line.trim()) return <div key={i} className="h-3" />;
          return <p key={i}>{renderInline(line, onJumpToSlide)}</p>;
        })}
      </article>
    </div>
  );
}

function renderInline(text: string, onJumpToSlide?: (n: number) => void) {
  const parts = text.split(/(\*\*[^*]+\*\*|Slides?\s+\d+(?:\s*[–-]\s*\d+)?)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    const slideRef = part.match(/^Slides?\s+(\d+)(?:\s*[–-]\s*(\d+))?$/);
    if (slideRef && onJumpToSlide) {
      const start = Number(slideRef[1]);
      return (
        <button
          key={i}
          type="button"
          className="text-accent underline-offset-2 hover:underline"
          onClick={() => onJumpToSlide(start)}
        >
          {part}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
