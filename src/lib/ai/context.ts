import type { LectureKnowledge, LectureRecord, SlideRecord } from "../types";

export function compactLecture(lecture: LectureRecord): LectureRecord {
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

export function compactSlide(slide: SlideRecord): SlideRecord {
  return {
    id: slide.id,
    lectureId: slide.lectureId,
    slideNumber: slide.slideNumber,
    title: slide.title,
    extractedText: slide.extractedText.slice(0, 1200),
    visualKind: slide.visualKind,
    bullets: slide.bullets.slice(0, 12),
    diagramId: slide.diagramId,
    imageId: slide.imageId ? "1" : undefined,
  };
}

export function lectureMaterial(lecture: LectureRecord, slides: SlideRecord[]) {
  return {
    title: lecture.title,
    fileName: lecture.originalFileName,
    type: lecture.type,
    overview: lecture.overview,
    slides: slides.map((s) => ({
      slideNumber: s.slideNumber,
      title: s.title,
      extractedText: s.extractedText,
      bullets: s.bullets,
      hasVisual: Boolean(s.diagramId || s.imageId),
    })),
  };
}

export function trimKnowledge(knowledge?: LectureKnowledge | null, index?: number) {
  if (!knowledge) return null;
  const current = typeof index === "number" ? knowledge.slides[index] : null;
  return {
    topic: knowledge.topic,
    summary: knowledge.summary,
    sections: knowledge.sections,
    concepts: knowledge.concepts,
    terms: knowledge.terms.slice(0, 24),
    currentSlide: current,
    nearby: knowledge.slides
      .filter((s) => current && Math.abs(s.slideNumber - current.slideNumber) <= 2)
      .map((s) => ({
        slideNumber: s.slideNumber,
        mainConcept: s.mainConcept,
        takeaways: s.takeaways,
        teacherExplanation: s.teacherExplanation.slice(0, 1200),
      })),
  };
}
