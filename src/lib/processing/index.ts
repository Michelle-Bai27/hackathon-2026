import { createId, nowIso } from "../ids";
import { analyzeLecture } from "../ai/client";
import { notesFromKnowledge, quizFromKnowledge } from "../ai/derive";
import { putOriginalFile } from "../storage/idb";
import type { FileKind, LectureRecord, ProcessingStatus, SlideRecord } from "../types";
import { extractPdfSlides } from "./pdf";
import { extractPptxSlides } from "./pptx";

export const PROCESS_STAGES: { id: ProcessingStatus; label: string }[] = [
  { id: "reading", label: "Reading slides" },
  { id: "structure", label: "Understanding lecture structure" },
  { id: "concepts", label: "Identifying key concepts" },
  { id: "tutor", label: "Preparing your AI tutor" },
  { id: "notes", label: "Preparing revision notes" },
];

export function detectKind(file: File): FileKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (
    name.endsWith(".pptx") ||
    file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return "pptx";
  }
  return null;
}

export async function processUploadedLecture(options: {
  file: File;
  classId: string | null;
  folderId: string | null;
  lectureId?: string;
  onStatus: (status: ProcessingStatus, detail?: string) => void;
}) {
  const kind = detectKind(options.file);
  if (!kind) {
    throw new Error("unsupported");
  }

  const lectureId = options.lectureId ?? createId("lec");
  await putOriginalFile(lectureId, options.file);
  const lecture: LectureRecord = {
    id: lectureId,
    classId: options.classId,
    folderId: options.folderId,
    title: options.file.name.replace(/\.(pdf|pptx)$/i, "").replace(/[_-]+/g, " "),
    originalFileName: options.file.name,
    type: kind,
    createdAt: nowIso(),
    processingStatus: "reading",
    lastOpenedAt: nowIso(),
  };

  options.onStatus("reading");
  let slides: SlideRecord[] = [];
  if (kind === "pdf") {
    slides = await extractPdfSlides(options.file, lectureId, (current, total) => {
      options.onStatus("reading", `Slide ${current} of ${total}`);
    });
  } else {
    slides = await extractPptxSlides(options.file, lectureId, (current, total) => {
      options.onStatus("reading", `Slide ${current} of ${total}`);
    });
  }

  if (!slides.length) {
    throw new Error("empty");
  }

  options.onStatus("structure");
  const knowledge = await analyzeLecture(lecture, slides);
  lecture.overview = knowledge.summary;
  lecture.subject = knowledge.topic;

  options.onStatus("concepts");
  await wait(200);

  options.onStatus("tutor");
  for (const slide of slides) {
    const taught = knowledge.slides.find((s) => s.slideNumber === slide.slideNumber);
    slide.aiContext = taught?.teacherExplanation.slice(0, 500) ?? knowledge.summary;
  }
  await wait(150);

  options.onStatus("notes");
  const notes = notesFromKnowledge(knowledge, "standard");
  const quiz = quizFromKnowledge(knowledge, {
    count: Math.min(10, Math.max(5, Math.ceil(slides.length * 0.4))),
    difficulty: "medium",
    types: ["multiple_choice", "true_false", "short_answer"],
  });

  lecture.processingStatus = "ready";
  return { lecture, slides, notes, quiz, knowledge };
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
