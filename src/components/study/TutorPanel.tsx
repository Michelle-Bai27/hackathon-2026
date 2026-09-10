"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import type { ChatMessage, LectureKnowledge, LectureRecord, SlideRecord, TutorExplanation } from "@/lib/types";
import { runAi } from "@/lib/ai/client";
import { formatTeacherMessage } from "@/lib/ai/serve";
import { createId, nowIso } from "@/lib/ids";
import { useApp } from "@/context/AppContext";

export function TutorPanel({
  lecture,
  slides,
  index,
  conversation,
  knowledge,
}: {
  lecture: LectureRecord;
  slides: SlideRecord[];
  index: number;
  conversation: ChatMessage[];
  knowledge?: LectureKnowledge | null;
}) {
  const { pushMessage } = useApp();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiDown, setAiDown] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const slide = slides[index];

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.length, slide?.id]);

  useEffect(() => {
    if (!slide) return;
    if (conversation.length) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const exp = await runAi<TutorExplanation>({
          kind: "explain",
          lecture,
          slides,
          index,
          knowledge,
        });
        if (cancelled) return;
        setAiDown(false);
        setAiError(null);
        pushMessage(lecture.id, slide.id, {
          id: createId("msg"),
          role: "tutor",
          content: formatTeacherMessage(exp),
          createdAt: nowIso(),
          fromLecture: true,
        });
      } catch (error) {
        if (!cancelled) {
          setAiDown(true);
          setAiError(error instanceof Error ? error.message : "The tutor could not explain this slide.");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation.length, index, knowledge, lecture, pushMessage, slide, slides]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slide || !draft.trim()) return;
    const question = draft.trim();
    setDraft("");
    pushMessage(lecture.id, slide.id, {
      id: createId("msg"),
      role: "student",
      content: question,
      createdAt: nowIso(),
    });
    setBusy(true);
    try {
      const result = await runAi<{ content: string }>({
        kind: "chat",
        lecture,
        slides,
        index,
        question,
        history: conversation.map((m) => ({ role: m.role, content: m.content })),
        knowledge,
      });
      pushMessage(lecture.id, slide.id, {
        id: createId("msg"),
        role: "tutor",
        content: result.content,
        createdAt: nowIso(),
      });
      setAiDown(false);
      setAiError(null);
    } catch (error) {
      setAiDown(true);
      setAiError(error instanceof Error ? error.message : "The tutor could not answer that question.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-line bg-tutor">
      <div className="border-b border-line px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">AI tutor</p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl text-ink">
          {slide ? `On “${slide.title}”` : "Waiting for a slide"}
        </h2>
        <p className="mt-1 text-xs text-muted">
          Current slide first, then the rest of {lecture.title}.
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {aiDown ? (
          <p className="rounded-xl border border-line bg-paper px-3 py-2 text-sm text-muted">
            {aiError ?? "Your lecture is still available. AI explanations are temporarily unavailable."}
          </p>
        ) : null}
        {conversation.map((message) => (
          <div key={message.id} className={message.role === "student" ? "ml-8" : "mr-2"}>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted">
              {message.role === "student" ? "You" : "Tutor"}
            </p>
            <div
              className={`whitespace-pre-wrap rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${
                message.role === "student"
                  ? "bg-ink text-paper"
                  : "border border-line bg-paper text-ink"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {busy ? <p className="text-sm text-muted">Thinking with the lecture in mind…</p> : null}
        <div ref={bottom} />
      </div>
      <form onSubmit={onSubmit} className="border-t border-line p-4">
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-paper px-3 py-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Why does this happen? What does this diagram mean?"
            className="max-h-28 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted/70"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="mb-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </form>
    </aside>
  );
}
