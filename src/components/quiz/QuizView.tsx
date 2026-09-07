"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { runAi } from "@/lib/ai/client";
import { nowIso } from "@/lib/ids";
import type {
  LectureKnowledge,
  LectureRecord,
  QuizDifficulty,
  QuizQuestion,
  QuizQuestionType,
  QuizRecord,
  SlideRecord,
} from "@/lib/types";

const TYPES: { id: QuizQuestionType; label: string }[] = [
  { id: "multiple_choice", label: "Multiple choice" },
  { id: "true_false", label: "True / false" },
  { id: "short_answer", label: "Short answer" },
];

export function QuizView({
  lecture,
  slides,
  quiz,
  knowledge,
  onJumpToSlide,
}: {
  lecture: LectureRecord;
  slides: SlideRecord[];
  quiz?: QuizRecord;
  knowledge?: LectureKnowledge | null;
  onJumpToSlide?: (slideNumber: number) => void;
}) {
  const { saveQuiz } = useApp();
  const [count, setCount] = useState(quiz?.questions.length || 8);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>(quiz?.difficulty ?? "medium");
  const [types, setTypes] = useState<QuizQuestionType[]>(
    quiz?.questionTypes ?? ["multiple_choice", "true_false", "short_answer"],
  );
  const [started, setStarted] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [shortDraft, setShortDraft] = useState("");
  const [showResults, setShowResults] = useState(false);

  const finished = Boolean(started && quiz && showResults);
  const current = started && quiz ? quiz.questions[cursor] : undefined;
  const revealed = current ? Boolean(quiz?.revealed[current.id]) : false;
  const answer = current ? quiz?.answers[current.id] : undefined;

  const score = finished && quiz
    ? {
        correct: quiz.questions.filter((q) => isCorrect(q, quiz.answers[q.id])).length,
        total: quiz.questions.length,
      }
    : null;

  const review =
    quiz && score
      ? missedTopics(quiz)
      : [];

  async function generate() {
    setBusy(true);
    try {
      const next = await runAi<QuizRecord>({
        kind: "quiz",
        lecture,
        slides,
        count,
        difficulty,
        types,
        knowledge,
      });
      saveQuiz({ ...next, lectureId: lecture.id, answers: {}, revealed: {} });
      setCursor(0);
      setStarted(true);
    } finally {
      setBusy(false);
    }
  }

  function submitAnswer(value: string | boolean) {
    if (!quiz || !current) return;
    saveQuiz({
      ...quiz,
      answers: { ...quiz.answers, [current.id]: value },
      revealed: { ...quiz.revealed, [current.id]: true },
    });
    setShortDraft("");
  }

  function continueNext() {
    if (!quiz) return;
    if (cursor >= quiz.questions.length - 1) {
      saveQuiz({ ...quiz, completedAt: nowIso() });
      setShowResults(true);
      return;
    }
    setCursor((c) => c + 1);
  }

  if (!started || !quiz) {
    return (
      <div className="mx-auto flex h-full max-w-lg flex-col justify-center px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Practice quiz</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl">Quiz me on {lecture.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Questions are built from this lecture, not from general trivia.
        </p>
        <label className="mt-8 text-xs uppercase tracking-wider text-muted">Number of questions</label>
        <input
          type="range"
          min={4}
          max={12}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="mt-2"
        />
        <p className="text-sm">{count} questions</p>
        <label className="mt-6 text-xs uppercase tracking-wider text-muted">Difficulty</label>
        <div className="mt-2 flex gap-2">
          {(["easy", "medium", "hard"] as QuizDifficulty[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              className={`rounded-full border px-3 py-1.5 text-sm capitalize ${
                difficulty === d ? "border-ink bg-ink text-paper" : "border-line"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <label className="mt-6 text-xs uppercase tracking-wider text-muted">Question types</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {TYPES.map((t) => {
            const on = types.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypes((prev) => (on ? prev.filter((x) => x !== t.id) : [...prev, t.id]))}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  on ? "border-ink bg-ink text-paper" : "border-line"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="mt-10 flex gap-3">
          {quiz ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                saveQuiz({ ...quiz, answers: {}, revealed: {}, completedAt: undefined });
                setCursor(0);
                setShowResults(false);
                setStarted(true);
              }}
            >
              Start quiz
            </button>
          ) : null}
          <button type="button" onClick={generate} disabled={busy || types.length === 0} className="btn-primary">
            {busy ? "Writing questions…" : quiz ? "Regenerate" : "Generate quiz"}
          </button>
        </div>
      </div>
    );
  }

  if (finished && score) {
    return (
      <div className="mx-auto flex h-full max-w-xl flex-col justify-center px-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Results</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl">
          {score.correct} / {score.total}
        </h1>
        <div className="mt-6 space-y-2 text-sm leading-relaxed text-ink">
          {review.length ? (
            <>
              <p className="font-medium">You may want to review:</p>
              {review.map((item) => (
                <p key={item.topic}>
                  <button
                    type="button"
                    className="text-accent underline-offset-2 hover:underline"
                    onClick={() => onJumpToSlide?.(item.slide)}
                  >
                    {item.topic}
                  </button>
                  <span className="text-muted"> — Slide {item.slide}</span>
                </p>
              ))}
            </>
          ) : (
            <p>Strong pass — this lecture is holding.</p>
          )}
        </div>
        <div className="mt-8 flex gap-3">
          <button type="button" className="btn-primary" onClick={() => setStarted(false)}>
            New settings
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              saveQuiz({ ...quiz, answers: {}, revealed: {}, completedAt: undefined });
              setCursor(0);
              setShowResults(false);
              setShowResults(false);
            }}
          >
            Retry same quiz
          </button>
        </div>
      </div>
    );
  }

  if (!current || !quiz) return null;

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-10 py-12">
      <p className="text-sm text-muted">
        Question {cursor + 1} of {quiz.questions.length}
      </p>
      <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl leading-snug">{current.prompt}</h2>
      <div className="mt-8 space-y-2">
        {current.type === "multiple_choice" &&
          current.choices?.map((choice) => (
            <button
              key={choice.id}
              type="button"
              disabled={revealed}
              onClick={() => submitAnswer(choice.id)}
              className={`block w-full rounded-2xl border px-4 py-3 text-left text-sm ${
                revealed && choice.id === current.correctChoiceId
                  ? "border-accent bg-accent/10"
                  : revealed && answer === choice.id
                    ? "border-terracotta bg-terracotta/10"
                    : "border-line hover:bg-paper"
              }`}
            >
              {choice.text}
            </button>
          ))}
        {current.type === "true_false" &&
          [true, false].map((val) => (
            <button
              key={String(val)}
              type="button"
              disabled={revealed}
              onClick={() => submitAnswer(val)}
              className={`mr-2 rounded-full border px-5 py-2 text-sm ${
                revealed && val === current.correctBoolean ? "border-accent bg-accent/10" : "border-line"
              }`}
            >
              {val ? "True" : "False"}
            </button>
          ))}
        {current.type === "short_answer" && !revealed ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitAnswer(shortDraft);
            }}
          >
            <input
              value={shortDraft}
              onChange={(e) => setShortDraft(e.target.value)}
              className="flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none"
              placeholder="Answer in a phrase"
            />
            <button className="btn-primary" type="submit">
              Check
            </button>
          </form>
        ) : null}
      </div>
      {revealed ? (
        <div className="mt-8 rounded-2xl border border-line bg-paper px-5 py-4 text-sm leading-relaxed">
          <p className="font-medium">{isCorrect(current, answer) ? "Correct" : "Not quite"}</p>
          {current.type !== "multiple_choice" ? (
            <p className="mt-1">
              Correct answer:{" "}
              {current.type === "true_false"
                ? current.correctBoolean
                  ? "True"
                  : "False"
                : current.acceptedAnswers?.[0]}
            </p>
          ) : null}
          <p className="mt-2 text-muted">{current.explanation}</p>
          <button
            type="button"
            className="mt-3 text-xs uppercase tracking-wider text-muted hover:text-ink"
            onClick={() => onJumpToSlide?.(current.slideNumber)}
          >
            See Slide {current.slideNumber}
          </button>
          <button type="button" className="btn-primary mt-4" onClick={continueNext}>
            {cursor >= quiz.questions.length - 1 ? "See results" : "Continue"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function isCorrect(question: QuizQuestion, answer: string | boolean | undefined) {
  if (answer == null) return false;
  if (question.type === "multiple_choice") return answer === question.correctChoiceId;
  if (question.type === "true_false") return answer === question.correctBoolean;
  const normalized = String(answer).trim().toLowerCase();
  return (question.acceptedAnswers ?? []).some(
    (a) => normalized.includes(a.toLowerCase()) || a.toLowerCase().includes(normalized),
  );
}

function missedTopics(quiz: QuizRecord) {
  const missed = quiz.questions.filter((q) => !isCorrect(q, quiz.answers[q.id]));
  const groups = new Map<string, number>();
  for (const q of missed) {
    if (!groups.has(q.topic)) groups.set(q.topic, q.slideNumber);
  }
  return [...groups.entries()].map(([topic, slide]) => ({ topic, slide }));
}
