import { NextResponse } from "next/server";
import { createJsonResponse, jsonError } from "@/lib/openai";
import { TUTOR_SYSTEM } from "@/lib/ai/prompts";
import { lectureMaterial, trimKnowledge } from "@/lib/ai/context";
import { createId, nowIso } from "@/lib/ids";
import type {
  LectureKnowledge,
  LectureRecord,
  QuizDifficulty,
  QuizQuestion,
  QuizQuestionType,
  QuizRecord,
  SlideRecord,
} from "@/lib/types";

export const maxDuration = 120;

type QuizBody = {
  lecture: LectureRecord;
  slides: SlideRecord[];
  count?: number;
  difficulty?: QuizDifficulty;
  types?: QuizQuestionType[];
  knowledge?: LectureKnowledge | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as QuizBody;
    if (!body.lecture || !body.slides?.length) {
      return NextResponse.json(
        { error: "bad_request", message: "Lecture and slides are required." },
        { status: 400 },
      );
    }
    const count = Math.min(12, Math.max(4, body.count ?? 5));
    const difficulty = body.difficulty ?? "medium";
    const types = body.types?.length ? body.types : (["multiple_choice", "true_false"] as QuizQuestionType[]);
    const parsed = await createJsonResponse({
      instructions: `${TUTOR_SYSTEM}

You write a short quiz from uploaded lecture slides only. Return structured JSON, never prose. Do not invent facts that are not supported by the material.`,
      temperature: 0.35,
      input: `Create about ${count} quiz questions (target ${count}) from this lecture.
Difficulty: ${difficulty}.
Allowed types: ${JSON.stringify(types)}.
Return JSON:
{
  "title": string,
  "questions": [
    {
      "type": "multiple_choice" | "true_false" | "short_answer",
      "prompt": string,
      "choices": [{ "id": "a"|"b"|"c"|"d", "text": string }],
      "correctChoiceId": "a",
      "correctBoolean": true,
      "acceptedAnswers": ["..."],
      "explanation": "short explanation",
      "slideNumber": 1,
      "topic": string
    }
  ]
}
Rules:
- multiple_choice: 3-4 choices, set correctChoiceId
- true_false: set correctBoolean, omit choices
- short_answer: set acceptedAnswers with 1-4 acceptable phrases
- Every question needs explanation and slideNumber from the lecture
Lecture: ${JSON.stringify(lectureMaterial(body.lecture, body.slides))}
Optional analysis: ${JSON.stringify(trimKnowledge(body.knowledge))}`,
    });

    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions = rawQuestions
      .map((item) => normalizeQuestion(item, types, body.slides))
      .filter((q): q is QuizQuestion => Boolean(q))
      .slice(0, count);

    if (questions.length < 1) {
      throw new Error("Quiz generation did not return any usable questions.");
    }

    const record: QuizRecord = {
      lectureId: body.lecture.id,
      title: typeof parsed.title === "string" ? parsed.title : `Quiz: ${body.lecture.title}`,
      difficulty,
      questionTypes: types,
      questions,
      answers: {},
      revealed: {},
      createdAt: nowIso(),
    };
    return NextResponse.json(record);
  } catch (error) {
    const mapped = jsonError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

function normalizeQuestion(
  item: unknown,
  types: QuizQuestionType[],
  slides: SlideRecord[],
): QuizQuestion | null {
  if (!item || typeof item !== "object") return null;
  const q = item as Record<string, unknown>;
  const type = (types.includes(q.type as QuizQuestionType) ? q.type : types[0]) as QuizQuestionType;
  const prompt = String(q.prompt ?? q.question ?? "").trim();
  if (!prompt) return null;
  const maxSlide = slides[slides.length - 1]?.slideNumber ?? 1;
  const slideNumber = Math.min(maxSlide, Math.max(1, Number(q.slideNumber) || 1));
  const explanation = String(q.explanation ?? "").trim() || "See the related slide in the lecture.";
  const topic = String(q.topic ?? "").trim() || slides.find((s) => s.slideNumber === slideNumber)?.title || "Lecture";
  const base = {
    id: createId("q"),
    prompt,
    explanation,
    slideNumber,
    topic,
  };
  if (type === "true_false") {
    const raw = q.correctBoolean ?? q.correct_answer ?? q.correctAnswer;
    return {
      ...base,
      type,
      correctBoolean: raw === true || raw === "true" || raw === "True",
    };
  }
  if (type === "short_answer") {
    const accepted = Array.isArray(q.acceptedAnswers)
      ? q.acceptedAnswers.map(String)
      : [String(q.correctAnswer ?? q.answer ?? "")].filter(Boolean);
    return { ...base, type, acceptedAnswers: accepted.length ? accepted : [prompt.slice(0, 40)] };
  }
  const choices = Array.isArray(q.choices)
    ? q.choices.map((choice, i) => {
        if (choice && typeof choice === "object" && "text" in choice) {
          const c = choice as { id?: string; text?: string };
          return { id: c.id || String.fromCharCode(97 + i), text: String(c.text ?? "") };
        }
        return { id: String.fromCharCode(97 + i), text: String(choice) };
      })
    : [];
  if (choices.length < 2) return null;
  const correctChoiceId = String(q.correctChoiceId ?? q.correct_answer ?? choices[0].id);
  return { ...base, type: "multiple_choice", choices, correctChoiceId };
}
