import { createId } from "../ids";
import type {
  LectureKnowledge,
  LectureRecord,
  LectureSection,
  SlideKnowledge,
  SlideRecord,
} from "../types";

const PROCESS =
  /\b(because|therefore|then|after|before|when|during|leads to|caused|results? in|→|->|process|form(?:ed|ation)|becomes?|transition)\b/i;
const VISUAL = /\b(diagram|figure|graph|chart|plot|schematic|shown|illustration)\b/i;
const STOP = new Set(
  "the a an and or of to in on for with from this that these those into over after before about as at by its it is are was were be been being slide week lecture today".split(
    " ",
  ),
);

export function analyzeLectureLocal(lecture: LectureRecord, slides: SlideRecord[]): LectureKnowledge {
  const ordered = [...slides].sort((a, b) => a.slideNumber - b.slideNumber);
  const sections = clusterSections(ordered);
  const slideKnowledge = ordered.map((slide, i) => teachSlide(lecture, ordered, i));
  const concepts = buildConcepts(slideKnowledge, sections);
  const terms = mergeTerms(slideKnowledge);

  return {
    lectureId: lecture.id,
    topic: inferTopic(lecture, ordered),
    summary: lectureSummary(lecture, ordered, sections, slideKnowledge),
    sections,
    concepts,
    terms,
    slides: slideKnowledge,
  };
}

function inferTopic(lecture: LectureRecord, slides: SlideRecord[]) {
  const titled = slides.find((s) => s.visualKind === "title" && s.title.trim())?.title;
  return titled || lecture.title;
}

function clusterSections(slides: SlideRecord[]): LectureSection[] {
  const groups: LectureSection[] = [];
  for (const slide of slides) {
    if (slide.slideNumber === 1 && slide.visualKind === "title") continue;
    if (/^(agenda|overview|today|objectives?|outline|recap|summary|questions?)$/i.test(slide.title.trim())) {
      continue;
    }
    const last = groups[groups.length - 1];
    const related =
      last &&
      (shareStem(last.title, slide.title) ||
        last.slideNumbers.length < 3 ||
        last.slideNumbers[last.slideNumbers.length - 1] === slide.slideNumber - 1);
    if (related && last && last.slideNumbers.length < 4) {
      last.slideNumbers.push(slide.slideNumber);
      last.idea = `${last.idea} Then ${slide.title.toLowerCase()}.`;
    } else {
      groups.push({
        title: slide.title || `Part ${groups.length + 1}`,
        slideNumbers: [slide.slideNumber],
        idea: `This part of the lecture develops “${slide.title}”.`,
      });
    }
  }
  return groups.length
    ? groups
    : [
        {
          title: slides[0]?.title || "Lecture",
          slideNumbers: slides.map((s) => s.slideNumber),
          idea: "The lecture is a single developing argument.",
        },
      ];
}

function shareStem(a: string, b: string) {
  const wa = a.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
  const wb = new Set(b.toLowerCase().split(/\W+/));
  return wa.some((w) => wb.has(w));
}

function lectureSummary(
  lecture: LectureRecord,
  slides: SlideRecord[],
  sections: LectureSection[],
  taught: SlideKnowledge[],
) {
  const arc = sections.map((s) => s.title).slice(0, 6).join(" → ");
  const cores = taught
    .filter((s) => s.complexity !== "simple")
    .map((s) => s.mainConcept)
    .slice(0, 4);
  return `${lecture.title} is a connected argument${arc ? ` moving through ${arc}` : ""}. The ideas that actually need teaching are: ${cores.join("; ") || slides.map((s) => s.title).filter(Boolean).slice(0, 4).join("; ")}. Treat sparse bullets as prompts for the underlying process, not as the whole lesson.`;
}

function teachSlide(lecture: LectureRecord, slides: SlideRecord[], index: number): SlideKnowledge {
  const slide = slides[index];
  const prev = slides[index - 1];
  const next = slides[index + 1];
  const claims = claimsOf(slide);
  const complexity = scoreComplexity(slide, claims);
  const terms = termsOn(slide, slides);
  const fromLecture = claims.length ? claims : [slide.title].filter(Boolean);
  const mainConcept = slide.title || claims[0] || `Idea on slide ${slide.slideNumber}`;
  const visual = slide.diagramId || slide.imageId || VISUAL.test(slide.extractedText);

  const relationPrevious = prev
    ? `Slide ${prev.slideNumber} (“${prev.title}”) set up the prior move in the argument. This slide is not a reset — it uses that setup.`
    : `This is an early beat in ${lecture.title}, so the job is to establish the frame.`;
  const relationNext = next
    ? `What you understand here is what makes Slide ${next.slideNumber} (“${next.title}”) land.`
    : `This is late in the lecture; the point is to hold the whole chain together.`;

  const teacherExplanation = writeLesson({
    lecture,
    slide,
    prev,
    next,
    claims,
    complexity,
    terms,
    visual: Boolean(visual),
    index,
    slides,
  });

  const takeaways = compressTakeaways(claims, terms, complexity);
  const misconceptions = likelyMisconceptions(slide, claims, complexity);

  return {
    slideNumber: slide.slideNumber,
    mainConcept,
    supporting: claims.slice(1, 5),
    complexity,
    visualDescription: visual
      ? "A figure on this slide is doing explanatory work: treat it as a process or relationship, not decoration."
      : undefined,
    relationPrevious,
    relationNext,
    fromLecture,
    teacherExplanation,
    takeaways,
    terms,
    misconceptions,
  };
}

function claimsOf(slide: SlideRecord) {
  const fromBullets = slide.bullets.map((b) => b.replace(/^[-•]\s*/, "").trim()).filter((b) => b.length > 2);
  if (fromBullets.length) return unique(fromBullets);
  return slide.extractedText
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 18 && !/^slide\s+\d+/i.test(s));
}

function scoreComplexity(slide: SlideRecord, claims: string[]): SlideKnowledge["complexity"] {
  const text = `${slide.title} ${slide.extractedText}`;
  let score = 0;
  if (claims.length >= 4) score += 2;
  else if (claims.length <= 1 && text.length < 80) score -= 1;
  if (PROCESS.test(text)) score += 2;
  if (slide.diagramId || slide.imageId || VISUAL.test(text)) score += 1;
  if ((text.match(/\d/g) || []).length > 2) score += 1;
  if (termsOn(slide, [slide]).length >= 3) score += 1;
  if (score >= 4) return "complex";
  if (score <= 0) return "simple";
  return "moderate";
}

function termsOn(slide: SlideRecord, all: SlideRecord[]) {
  const blob = `${slide.title} ${slide.extractedText} ${slide.bullets.join(" ")}`;
  const found = new Set<string>();
  const capped = blob.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b/g) ?? [];
  const long = blob.match(/\b[A-Za-z][a-z]{6,}\b/g) ?? [];
  for (const t of [...capped, ...long]) {
    if (STOP.has(t.toLowerCase())) continue;
    found.add(t);
  }
  return [...found].slice(0, 6).map((term) => ({
    term,
    definition: defineFromLecture(term, all) ?? `A working idea in this lecture — understand it from how nearby slides use it, not as trivia.`,
  }));
}

function defineFromLecture(term: string, slides: SlideRecord[]) {
  const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  for (const s of slides) {
    const hit =
      s.bullets.find((b) => re.test(b) && b.length > term.length + 8) ||
      s.extractedText
        .split(/(?<=[.!?])\s+/)
        .find((p) => re.test(p) && p.length > term.length + 12);
    if (hit) return hit.replace(/\s+/g, " ").trim();
  }
  return null;
}

function writeLesson(args: {
  lecture: LectureRecord;
  slide: SlideRecord;
  prev?: SlideRecord;
  next?: SlideRecord;
  claims: string[];
  complexity: SlideKnowledge["complexity"];
  terms: { term: string; definition: string }[];
  visual: boolean;
  index: number;
  slides: SlideRecord[];
}) {
  const { lecture, slide, prev, next, claims, complexity, terms, visual, slides } = args;
  const parts: string[] = [];

  if (complexity === "simple") {
    parts.push(`## ${slide.title || "What this is about"}`);
    parts.push(
      `A useful way to think about this is as one clear move in ${lecture.title}: ${claims[0] || slide.title}. The point is not to memorize the heading. The point is to be able to say what changed, and why that change matters for what comes next.`,
    );
    if (terms[0]) {
      parts.push(`**${terms[0].term}:** ${terms[0].definition}`);
    }
    if (prev) {
      parts.push(
        `To understand this, it helps to know what just happened: “${prev.title}” is the setup. This slide is the consequence or the next distinction.`,
      );
    }
    return parts.join("\n\n");
  }

  parts.push(`## What this is really about`);
  parts.push(
    `“${slide.title}” is a label for a process or relationship, not a finished explanation. If you only read the words on the slide, you will miss the mechanism. Below is the teaching you would want in class: what the idea means, why it happens, and how it sits in the lecture.`,
  );

  parts.push(`## Unpacking the idea`);
  const toUnpack = complexity === "complex" ? claims.slice(0, 6) : claims.slice(0, 3);
  if (!toUnpack.length) {
    parts.push(
      `The slide is sparse on purpose. That usually means the work is in the figure, the heading, or the sequence of the lecture. Ask: what had to be true on the previous slide for this heading to make sense?`,
    );
  }
  for (const claim of toUnpack) {
    parts.push(`### ${shortHead(claim)}`);
    parts.push(expandClaim(claim, slide, prev, next, slides));
  }

  if (visual) {
    parts.push(`## What you are looking at`);
    parts.push(
      `The figure is part of the argument. Read it as a sequence (ingredients → mechanism → outcome) or as a comparison, not as a logo. Name the axes or stages in your own words. If a quantity increases, decreases, or binds/unbinds, that change is the lesson.`,
    );
  }

  if (complexity === "complex") {
    parts.push(`## Cause and effect`);
    parts.push(
      `Do not treat the items on this slide as a list of equal facts. Something enables the next thing. A useful check: if you reverse the order, does the story break? If yes, you have found the mechanism, not a vocabulary list.`,
    );
    parts.push(`## A common mix-up`);
    parts.push(
      `Students often confuse the name of the process with the reason it happens, or confuse “when” with “why.” Keep those separate. The lecture is training you to say both: the landmark, and the physics/logic underneath it.`,
    );
  }

  if (terms.length) {
    parts.push(`## Language you need`);
    for (const t of terms.slice(0, complexity === "complex" ? 5 : 3)) {
      parts.push(`- **${t.term}:** ${t.definition}`);
    }
  }

  if (prev || next) {
    parts.push(`## Where this sits in the lecture`);
    if (prev) {
      parts.push(
        `Earlier (“${prev.title}”), the lecture gave you the prior condition. This slide is what becomes possible — or what must be explained — because of that.`,
      );
    }
    if (next) {
      parts.push(
        `Next (“${next.title}”) will only make sense if you can restate this slide as a because-sentence, not as a title.`,
      );
    }
  }

  parts.push(`## Why it matters`);
  parts.push(
    `If you can teach this slide without looking at it, you can use it later in ${lecture.title} — in notes, in a quiz, and when a later slide assumes you already live in this idea.`,
  );

  return parts.join("\n\n");
}

function shortHead(claim: string) {
  const trimmed = claim.replace(/\.$/, "");
  return trimmed.length > 72 ? `${trimmed.slice(0, 70)}…` : trimmed;
}

function expandClaim(
  claim: string,
  slide: SlideRecord,
  prev: SlideRecord | undefined,
  next: SlideRecord | undefined,
  slides: SlideRecord[],
) {
  const sentences = [
    `This means: ${soften(claim)} That is the claim to understand, not a line to copy.`,
  ];
  if (PROCESS.test(claim) || PROCESS.test(slide.extractedText)) {
    sentences.push(
      `There is a sequence here. Name the starting state, the change, and the new state. The “why” is whatever made the change possible (cooling, binding, energy, time, a threshold, a prior step on an earlier slide).`,
    );
  } else {
    sentences.push(
      `To understand this, it helps to know what problem the lecture is solving. If this claim were false, a later slide would not follow. That is how you tell a key idea from decoration.`,
    );
  }
  const neighbor = [prev, next].filter(Boolean) as SlideRecord[];
  const bridge = neighbor
    .map((s) => s.bullets[0] || s.title)
    .filter(Boolean)
    .slice(0, 2);
  if (bridge.length) {
    sentences.push(
      `Connected material nearby: ${bridge.join("; ")}. Use that as context — not as a quote of something the instructor said off-slide.`,
    );
  }
  const extra = defineFromLecture(claim.split(/\s+/).find((w) => w.length > 7) ?? "", slides);
  if (extra && !claim.includes(extra.slice(0, 20))) {
    sentences.push(`Related wording elsewhere in the lecture: ${extra}`);
  }
  return sentences.join(" ");
}

function soften(claim: string) {
  const c = claim.replace(/\.$/, "");
  return /[.!?]$/.test(c) ? c : `${c}.`;
}

function compressTakeaways(
  claims: string[],
  terms: { term: string; definition: string }[],
  complexity: SlideKnowledge["complexity"],
) {
  const n = complexity === "simple" ? 2 : complexity === "complex" ? 5 : 3;
  const out = claims.slice(0, n).map((c) => {
    const body = c.replace(/\.$/, "");
    return `${body}.`;
  });
  if (terms[0] && !out.some((o) => o.toLowerCase().includes(terms[0].term.toLowerCase()))) {
    out.push(`**${terms[0].term}:** ${terms[0].definition}`);
  }
  return unique(out).slice(0, n + 1);
}

function likelyMisconceptions(slide: SlideRecord, claims: string[], complexity: SlideKnowledge["complexity"]) {
  if (complexity === "simple") return [];
  const name = slide.title || "this process";
  return [
    `Mixing up the label “${name}” with the mechanism — being able to say the title is not the same as explaining why it happens.`,
    claims[1]
      ? `Treating “${claims[0]}” and “${claims[1]}” as unrelated facts instead of a cause-and-effect pair.`
      : `Treating the order of ideas on the slide as arbitrary rather than as a sequence.`,
  ];
}

function buildConcepts(slides: SlideKnowledge[], sections: LectureSection[]) {
  return slides
    .filter((s) => s.complexity !== "simple" || s.takeaways.length)
    .map((s) => ({
      id: createId("c"),
      name: s.mainConcept,
      definition: s.takeaways[0] || s.fromLecture[0] || s.mainConcept,
      whyItMatters: s.relationNext || s.takeaways[1] || "Needed to follow the rest of the lecture.",
      slideNumbers: [s.slideNumber],
    }))
    .slice(0, Math.max(8, sections.length * 2));
}

function mergeTerms(slides: SlideKnowledge[]) {
  const map = new Map<string, { term: string; definition: string; slideNumbers: number[] }>();
  for (const s of slides) {
    for (const t of s.terms) {
      const key = t.term.toLowerCase();
      const existing = map.get(key);
      if (existing) existing.slideNumbers.push(s.slideNumber);
      else map.set(key, { term: t.term, definition: t.definition, slideNumbers: [s.slideNumber] });
    }
  }
  return [...map.values()].slice(0, 24);
}

function unique(items: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
