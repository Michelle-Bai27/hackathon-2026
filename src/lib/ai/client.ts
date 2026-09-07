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
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "analyze", lecture: compactLecture(lecture), slides: slides.map(compactSlide) }),
    });
    if (res.ok) {
      const parsed = (await res.json()) as LectureKnowledge;
      if (parsed?.slides?.length) {
        return { ...parsed, lectureId: lecture.id };
      }
    }
  } catch {
    // local pipeline
  }
  return analyzeLectureLocal(lecture, slides);
}

export async function runAi<T>(request: AiRequest): Promise<T> {
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(compactRequest(request)),
    });
    if (res.ok) {
      return (await res.json()) as T;
    }
  } catch {
    // fall through
  }
  return localFallback(request) as T;
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

function compactLecture(lecture: LectureRecord): LectureRecord {
  return {
    id: lecture.id,
    classId: lecture.classId,
    folderId: lecture.folderId,
    title: lecture.title,
    originalFileName: lecture.originalFileName,
    type: lecture.type,
    createdAt: lecture.createdAt,
    processingStatus: lecture.processingStatus,
    subject: lecture.subject,
    overview: lecture.overview,
  };
}

function compactSlide(slide: SlideRecord): SlideRecord {
  return {
    id: slide.id,
    lectureId: slide.lectureId,
    slideNumber: slide.slideNumber,
    title: slide.title,
    extractedText: slide.extractedText.slice(0, 900),
    visualKind: slide.visualKind,
    bullets: slide.bullets.slice(0, 10),
    diagramId: slide.diagramId,
    imageId: slide.imageId ? "1" : undefined,
  };
}

export type { TutorExplanation, NotesRecord, QuizRecord };
