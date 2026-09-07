import { createId, nowIso } from "../ids";
import type {
  LectureKnowledge,
  NotesDetail,
  NotesRecord,
  QuizDifficulty,
  QuizQuestion,
  QuizQuestionType,
  QuizRecord,
  SlideKnowledge,
} from "../types";

export function notesFromKnowledge(knowledge: LectureKnowledge, detail: NotesDetail): NotesRecord {
  const lines: string[] = [`# ${knowledge.topic}`, ""];
  lines.push(detail === "concise" ? "Compressed from the taught lecture, not copied from slides." : "Revision notes compressed from the teacher explanations.");
  lines.push("");
  if (detail !== "concise") {
    lines.push(`> ${knowledge.summary}`);
    lines.push("");
  }

  const bySection = knowledge.sections.length
    ? knowledge.sections
    : [{ title: knowledge.topic, slideNumbers: knowledge.slides.map((s) => s.slideNumber), idea: knowledge.summary }];

  for (const section of bySection) {
    const taught = knowledge.slides.filter((s) => section.slideNumbers.includes(s.slideNumber));
    const refs = formatRange(section.slideNumbers);
    lines.push(`## ${section.title} — Slides ${refs}`);
    if (detail === "detailed" && section.idea) lines.push(`*${section.idea}*`, "");
    const takeaways = unique(taught.flatMap((s) => s.takeaways)).slice(
      0,
      detail === "concise" ? 4 : detail === "detailed" ? 10 : 6,
    );
    for (const t of takeaways) lines.push(`- ${ensurePeriod(stripMd(t))}`);
    if (detail !== "concise") {
      const extra = taught
        .filter((s) => s.complexity !== "simple")
        .map((s) => firstWhy(s))
        .filter(Boolean)
        .slice(0, 2);
      for (const e of extra) lines.push(`- ${e}`);
    }
    lines.push("");
  }

  if (knowledge.terms.length) {
    lines.push("## Key terms");
    const take = knowledge.terms.slice(0, detail === "concise" ? 5 : 12);
    for (const t of take) {
      const refs = formatRange(t.slideNumbers);
      lines.push(`- **${t.term}** — ${ensurePeriod(t.definition)} _(Slides ${refs})_`);
    }
    lines.push("");
  }

  const imageSlideNumbers = knowledge.slides
    .filter((s) => s.visualDescription)
    .map((s) => s.slideNumber)
    .slice(0, 4);

  return {
    lectureId: knowledge.lectureId,
    detail,
    markdown: lines.join("\n"),
    createdAt: nowIso(),
    imageSlideNumbers,
  };
}

export function quizFromKnowledge(
  knowledge: LectureKnowledge,
  options: { count: number; difficulty: QuizDifficulty; types: QuizQuestionType[] },
): QuizRecord {
  const pool = buildPool(knowledge, options.difficulty).filter((q) => options.types.includes(q.type));
  const spread = spreadQuestions(pool.length ? pool : buildPool(knowledge, options.difficulty), options.count);

  return {
    lectureId: knowledge.lectureId,
    title: `Quiz me on ${knowledge.topic}`,
    difficulty: options.difficulty,
    questionTypes: options.types,
    questions: spread,
    answers: {},
    revealed: {},
    createdAt: nowIso(),
  };
}

function buildPool(knowledge: LectureKnowledge, difficulty: QuizDifficulty): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const meat = knowledge.slides.filter(
    (s) => (s.takeaways.length && s.complexity !== "simple") || s.fromLecture.length > 1,
  );
  const roster = meat.length ? meat : knowledge.slides;

  roster.forEach((slide, i) => {
    const concept = slide.mainConcept;
    const why = firstWhy(slide);
    const others = roster.filter((s) => s.slideNumber !== slide.slideNumber);

    const correct = why || slide.takeaways[0] || slide.fromLecture[0];
    const distractors = others.slice(0, 5).map((s) => s.takeaways[0] || s.mainConcept);
    const choices = shuffle([
      { id: "a", text: correct },
      ...distractors.slice(0, 3).map((text, idx) => ({ id: String.fromCharCode(98 + idx), text })),
    ]).slice(0, 4);
    const correctChoice = choices.find((c) => c.text === correct) ?? choices[0];

    questions.push({
      id: createId("q"),
      type: "multiple_choice",
      prompt: `Why does “${concept}” matter in this lecture — what is the mechanism or change, not just the label?`,
      choices,
      correctChoiceId: correctChoice.id,
      explanation: `${correct} This is from the taught understanding of Slide ${slide.slideNumber}, not a copied bullet.`,
      slideNumber: slide.slideNumber,
      topic: concept,
    });

    if (slide.misconceptions[0]) {
      questions.push({
        id: createId("q"),
        type: "true_false",
        prompt: `True or false: knowing the name “${concept}” is enough; you do not need the cause-and-effect underneath it.`,
        correctBoolean: false,
        explanation: slide.misconceptions[0],
        slideNumber: slide.slideNumber,
        topic: concept,
      });
    }

    const term = slide.terms[0] || knowledge.terms.find((t) => t.slideNumbers.includes(slide.slideNumber));
    if (term && (difficulty !== "easy" || i % 2 === 0)) {
      questions.push({
        id: createId("q"),
        type: "short_answer",
        prompt: `In your own words, what is ${term.term}?`,
        acceptedAnswers: [term.term.toLowerCase(), ...term.definition.toLowerCase().split(/[,.]/).map((p) => p.trim()).filter((p) => p.length > 4).slice(0, 3)],
        explanation: `${term.definition} See Slide ${slide.slideNumber}.`,
        slideNumber: slide.slideNumber,
        topic: term.term,
      });
    }
  });

  return questions;
}

function spreadQuestions(pool: QuizQuestion[], count: number) {
  if (pool.length <= count) return pool.slice(0, count);
  const bySlide = new Map<number, QuizQuestion[]>();
  for (const q of pool) {
    const list = bySlide.get(q.slideNumber) ?? [];
    list.push(q);
    bySlide.set(q.slideNumber, list);
  }
  const slides = [...bySlide.keys()].sort((a, b) => a - b);
  const picked: QuizQuestion[] = [];
  let guard = 0;
  while (picked.length < count && guard < count * slides.length + 5) {
    const slide = slides[guard % slides.length];
    const bucket = bySlide.get(slide);
    if (bucket?.length) picked.push(bucket.shift()!);
    guard += 1;
  }
  return picked;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function firstWhy(slide: SlideKnowledge) {
  const hit = slide.takeaways.find((t) => /because|so that|which allows|this means|therefore/i.test(t));
  return hit || slide.takeaways[0] || "";
}

function formatRange(nums: number[]) {
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  if (!sorted.length) return "";
  if (sorted.length === 1) return String(sorted[0]);
  if (sorted[sorted.length - 1] - sorted[0] === sorted.length - 1) return `${sorted[0]}–${sorted[sorted.length - 1]}`;
  return sorted.join(", ");
}

function ensurePeriod(text: string) {
  const t = text.trim();
  return /[.!?)]$/.test(t) ? t : `${t}.`;
}

function stripMd(text: string) {
  return text.replace(/\*\*/g, "");
}

function unique(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
