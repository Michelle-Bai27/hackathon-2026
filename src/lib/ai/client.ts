import type {
  LectureKnowledge,
  LectureRecord,
  NotesDetail,
  NotesRecord,
  QuizDifficulty,
  QuizQuestionType,
  QuizRecord,
  SlideRecord,
  TutorExplanation,
} from "../types";
import { analyzeLectureLocal } from "./analyze";
import { compactLecture, compactSlide } from "./context";
import { generateNotes as localNotes, generateQuiz as localQuiz } from "./generate";
import { explanationFromKnowledge, answerFromKnowledge } from "./serve";

type AnalyzeRequest = {
  kind: "analyze";
  lecture: LectureRecord;
  slides: SlideRecord[];
};

type ExplainRequest = {
  kind: "explain";
  lecture: LectureRecord;
  slides: SlideRecord[];
  index: number;
  knowledge?: LectureKnowledge | null;
};

type ChatRequest = {
  kind: "chat";
  lecture: LectureRecord;
  slides: SlideRecord[];
  index: number;
  question: string;
  history: { role: "tutor" | "student"; content: string }[];
  knowledge?: LectureKnowledge | null;
};

type NotesRequest = {
  kind: "notes";
  lecture: LectureRecord;
  slides: SlideRecord[];
  detail: NotesDetail;
  knowledge?: LectureKnowledge | null;
};

type QuizRequest = {
  kind: "quiz";
  lecture: LectureRecord;
  slides: SlideRecord[];
  count: number;
  difficulty: QuizDifficulty;
  types: QuizQuestionType[];
  knowledge?: LectureKnowledge | null;
};

export type AiRequest = AnalyzeRequest | ExplainRequest | ChatRequest | NotesRequest | QuizRequest;

export async function analyzeLecture(lecture: LectureRecord, slides: SlideRecord[]): Promise<LectureKnowledge> {
  try {
    const parsed = await postAi<LectureKnowledge>("/api/ai", {
      kind: "analyze",
      lecture: compactLecture(lecture),
      slides: slides.map(compactSlide),
    });
    if (parsed?.slides?.length) {
      return { ...parsed, lectureId: lecture.id };
    }
  } catch {
    // upload still succeeds with a local outline
  }
  return analyzeLectureLocal(lecture, slides);
}

export async function runAi<T>(request: AiRequest): Promise<T> {
  return postAi<T>(endpointFor(request.kind), compactRequest(request));
}

async function postAi<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "message" in data && typeof data.message === "string"
        ? data.message
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

function endpointFor(kind: AiRequest["kind"]) {
  if (kind === "notes") return "/api/notes";
  if (kind === "quiz") return "/api/quiz";
  if (kind === "explain" || kind === "chat") return "/api/tutor";
  return "/api/ai";
}

export function localFallback(request: AiRequest) {
  if (request.kind === "analyze") return analyzeLectureLocal(request.lecture, request.slides);
  if (request.kind === "explain") {
    return explanationFromKnowledge(request.lecture, request.slides, request.index, request.knowledge);
  }
  if (request.kind === "chat") {
    return {
      content: answerFromKnowledge(
        request.lecture,
        request.slides,
        request.index,
        request.question,
        request.knowledge,
      ),
    };
  }
  if (request.kind === "notes") {
    return localNotes(request.lecture, request.slides, request.detail, request.knowledge);
  }
  return localQuiz(
    request.lecture,
    request.slides,
    { count: request.count, difficulty: request.difficulty, types: request.types },
    request.knowledge,
  );
}

function compactRequest(request: AiRequest): AiRequest {
  if (request.kind === "analyze") {
    return { ...request, lecture: compactLecture(request.lecture), slides: request.slides.map(compactSlide) };
  }
  if ("slides" in request) {
    return { ...request, lecture: compactLecture(request.lecture), slides: request.slides.map(compactSlide) };
  }
  return request;
}

export type { TutorExplanation, NotesRecord, QuizRecord };
