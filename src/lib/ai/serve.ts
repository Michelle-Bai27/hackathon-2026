import type { LectureKnowledge, LectureRecord, SlideRecord, TutorExplanation } from "../types";
import { analyzeLectureLocal } from "./analyze";

export function knowledgeFor(
  lecture: LectureRecord,
  slides: SlideRecord[],
  knowledge?: LectureKnowledge | null,
): LectureKnowledge {
  if (knowledge?.slides?.length) return knowledge;
  return analyzeLectureLocal(lecture, slides);
}

export function explanationFromKnowledge(
  lecture: LectureRecord,
  slides: SlideRecord[],
  index: number,
  knowledge?: LectureKnowledge | null,
): TutorExplanation {
  const k = knowledgeFor(lecture, slides, knowledge);
  const slide = slides[index];
  const taught = k.slides.find((s) => s.slideNumber === slide?.slideNumber) ?? k.slides[index];
  if (!taught) {
    return {
      headline: "Let's make this slide make sense.",
      fromLecture: [],
      explanation: "This lecture is still being understood. Stay with the current slide and ask a follow-up.",
      terms: [],
      connections: [],
      whyItMatters: "",
    };
  }
  return {
    headline: taught.complexity === "simple" ? taught.mainConcept : "Here's what this is really about.",
    fromLecture: taught.fromLecture,
    explanation: taught.teacherExplanation,
    terms: taught.terms,
    connections: [taught.relationPrevious, taught.relationNext].filter(Boolean) as string[],
    whyItMatters: k.concepts.find((c) => c.slideNumbers.includes(taught.slideNumber))?.whyItMatters ?? "",
    diagramNote: taught.visualDescription,
  };
}

export function formatTeacherMessage(exp: TutorExplanation) {
  const terms = exp.terms.map((t) => `• **${t.term}:** ${t.definition}`).join("\n");
  return [
    exp.explanation,
    exp.fromLecture.length
      ? `\nOn the slide itself (source material, not the whole lesson)\n${exp.fromLecture.map((l) => `• ${l}`).join("\n")}`
      : "",
    terms ? `\nLanguage you need\n${terms}` : "",
    exp.connections.length ? `\nIn the lecture's sequence\n${exp.connections.map((c) => `• ${c}`).join("\n")}` : "",
    exp.whyItMatters ? `\nWhy it matters\n${exp.whyItMatters}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function answerFromKnowledge(
  lecture: LectureRecord,
  slides: SlideRecord[],
  index: number,
  question: string,
  knowledge?: LectureKnowledge | null,
): string {
  const k = knowledgeFor(lecture, slides, knowledge);
  const slide = slides[index];
  const taught = k.slides.find((s) => s.slideNumber === slide?.slideNumber) ?? k.slides[index];
  const q = question.toLowerCase();
  const prev = k.slides.find((s) => s.slideNumber === (slide?.slideNumber ?? 0) - 1);
  const next = k.slides.find((s) => s.slideNumber === (slide?.slideNumber ?? 0) + 1);

  if (/previous|earlier|connect|next|later|whole lecture/.test(q)) {
    return [
      `Current idea: ${taught?.mainConcept ?? slide?.title}.`,
      prev ? `Before this, the lecture worked on “${prev.mainConcept}”. ${prev.takeaways[0] ?? ""}` : "",
      next ? `After this, it moves to “${next.mainConcept}”. ${next.takeaways[0] ?? ""}` : "",
      `Lecture arc: ${k.summary}`,
      "I am connecting slides from the analyzed lecture — not quoting an off-slide instructor remark.",
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  if (/simple|beginner|eli5|analogy|like i'm|like i am/.test(q)) {
    return `A useful way to think about this: ${taught?.takeaways[0] ?? taught?.mainConcept}. ${taught?.teacherExplanation.split("\n\n")[1] ?? taught?.teacherExplanation.slice(0, 500)}`;
  }
  if (/diagram|figure|graph|image/.test(q)) {
    return `${taught?.visualDescription ?? "Read the figure as a process or relationship."}\n\n${taught?.teacherExplanation.includes("looking at") ? "" : taught?.takeaways.join(" ")}`;
  }
  if (/mean|define|what is|what does/.test(q)) {
    const term = question.replace(/.*(?:mean|define|what is|what does)\s*/i, "").replace(/[?'"]/g, "").trim();
    const hit =
      taught?.terms.find((t) => t.term.toLowerCase().includes(term.toLowerCase()) || term.toLowerCase().includes(t.term.toLowerCase())) ||
      k.terms.find((t) => t.term.toLowerCase().includes(term.toLowerCase()));
    if (hit) {
      return `**${hit.term}:** ${hit.definition}\n\nTo understand this, it helps to know how the lecture uses it on Slide ${taught?.slideNumber ?? slide?.slideNumber}.`;
    }
  }

  const excerpt = taught?.teacherExplanation ?? k.summary;
  return `${excerpt.slice(0, 1200)}${excerpt.length > 1200 ? "…" : ""}\n\nAsk a more specific “why / what changed / how does this connect” question if you want a narrower cut.`;
}
