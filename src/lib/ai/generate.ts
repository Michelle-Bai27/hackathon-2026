import { nowIso } from "../ids";
import type {
  LectureKnowledge,
  LectureRecord,
  NotesDetail,
  NotesRecord,
  QuizDifficulty,
  QuizQuestionType,
  QuizRecord,
  SlideRecord,
} from "../types";
import { analyzeLectureLocal } from "./analyze";
import { notesFromKnowledge, quizFromKnowledge } from "./derive";

export function generateNotes(
  lecture: LectureRecord,
  slides: SlideRecord[],
  detail: NotesDetail,
  knowledge?: LectureKnowledge | null,
): NotesRecord {
  const k = knowledge?.lectureId === lecture.id ? knowledge : analyzeLectureLocal(lecture, slides);
  return { ...notesFromKnowledge(k, detail), createdAt: nowIso() };
}

export function generateQuiz(
  lecture: LectureRecord,
  slides: SlideRecord[],
  options: {
    count: number;
    difficulty: QuizDifficulty;
    types: QuizQuestionType[];
  },
  knowledge?: LectureKnowledge | null,
): QuizRecord {
  const k = knowledge?.lectureId === lecture.id ? knowledge : analyzeLectureLocal(lecture, slides);
  return quizFromKnowledge(k, options);
}
