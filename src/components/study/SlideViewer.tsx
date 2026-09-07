"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import type { FileKind, SlideRecord } from "@/lib/types";
import { OriginalSlide } from "./OriginalSlide";

export function SlideViewer({
  slides,
  index,
  onIndex,
  lectureId,
  fileKind,
}: {
  slides: SlideRecord[];
  index: number;
  onIndex: (n: number) => void;
  lectureId: string;
  fileKind: FileKind;
}) {
  const [zoom, setZoom] = useState(1);
  const slide = slides[index];
  const total = slides.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onIndex(Math.min(total - 1, index + 1));
      if (e.key === "ArrowLeft") onIndex(Math.max(0, index - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onIndex, total]);

  const thumbs = useMemo(() => slides, [slides]);
  if (!slide) {
    return (
      <div className="flex h-full items-center justify-center text-muted">No slides yet.</div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex flex-1 items-center justify-center overflow-hidden px-6 py-4">
        <div
          className="aspect-video w-full max-w-4xl overflow-hidden rounded-xl border border-line bg-white shadow-[0_24px_60px_-32px_rgba(28,25,23,0.45)]"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
        >
          <OriginalSlide key={slide.id} slide={slide} lectureId={lectureId} fileKind={fileKind} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        <div className="flex items-center gap-1">
          <button type="button" className="icon-btn" onClick={() => onIndex(Math.max(0, index - 1))} aria-label="Previous slide">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-28 text-center text-sm text-muted">
            Slide {slide.slideNumber} of {total}
          </span>
          <button type="button" className="icon-btn" onClick={() => onIndex(Math.min(total - 1, index + 1))} aria-label="Next slide">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="hidden max-w-xl flex-1 items-center gap-1 overflow-x-auto md:flex">
          {thumbs.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onIndex(i)}
              className={`h-1.5 flex-1 rounded-full ${i === index ? "bg-accent" : "bg-line hover:bg-ink/20"}`}
              aria-label={`Go to slide ${s.slideNumber}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="icon-btn" onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))} aria-label="Zoom out">
            <Minus size={14} />
          </button>
          <button type="button" className="icon-btn" onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))} aria-label="Zoom in">
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
