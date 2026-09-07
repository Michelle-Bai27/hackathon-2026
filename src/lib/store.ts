import { createId, nowIso } from "./ids";
import { deleteMedia, originalKey } from "./storage/idb";
import type {
  AppData,
  ChatMessage,
  ClassRecord,
  FolderRecord,
  LectureKnowledge,
  LectureRecord,
  NotesDetail,
  NotesRecord,
  ProcessingStatus,
  QuizRecord,
  SlideRecord,
} from "./types";

const STORAGE_KEY = "lumen.app.v2";

export function emptyData(): AppData {
  return {
    classes: [],
    folders: [],
    lectures: [],
    slides: [],
    conversations: [],
    notes: [],
    quizzes: [],
    knowledge: [],
  };
}

export function loadData(): AppData {
  if (typeof window === "undefined") return emptyData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw) as AppData;
    return {
      ...emptyData(),
      ...parsed,
      knowledge: parsed.knowledge ?? [],
    };
  } catch {
    return emptyData();
  }
}

export function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function createClass(data: AppData, name: string): AppData {
  const record: ClassRecord = { id: createId("class"), name, createdAt: nowIso() };
  return { ...data, classes: [...data.classes, record] };
}

export function createFolder(
  data: AppData,
  classId: string,
  name: string,
  parentFolderId: string | null,
): AppData {
  const record: FolderRecord = {
    id: createId("folder"),
    classId,
    parentFolderId,
    name,
    createdAt: nowIso(),
  };
  return { ...data, folders: [...data.folders, record] };
}

export function renameClass(data: AppData, id: string, name: string): AppData {
  return {
    ...data,
    classes: data.classes.map((c) => (c.id === id ? { ...c, name } : c)),
  };
}

export function renameFolder(data: AppData, id: string, name: string): AppData {
  return {
    ...data,
    folders: data.folders.map((f) => (f.id === id ? { ...f, name } : f)),
  };
}

export function renameLecture(data: AppData, id: string, title: string): AppData {
  return {
    ...data,
    lectures: data.lectures.map((l) => (l.id === id ? { ...l, title } : l)),
  };
}

export function moveLecture(
  data: AppData,
  lectureId: string,
  folderId: string | null,
  classId: string | null,
): AppData {
  return {
    ...data,
    lectures: data.lectures.map((l) =>
      l.id === lectureId ? { ...l, folderId, classId } : l,
    ),
  };
}

export async function deleteLecture(data: AppData, lectureId: string): Promise<AppData> {
  const slides = data.slides.filter((s) => s.lectureId === lectureId);
  await deleteMedia(originalKey(lectureId));
  for (const slide of slides) {
    if (slide.imageId) await deleteMedia(slide.imageId);
  }
  return {
    ...data,
    lectures: data.lectures.filter((l) => l.id !== lectureId),
    slides: data.slides.filter((s) => s.lectureId !== lectureId),
    conversations: data.conversations.filter((c) => c.lectureId !== lectureId),
    notes: data.notes.filter((n) => n.lectureId !== lectureId),
    quizzes: data.quizzes.filter((q) => q.lectureId !== lectureId),
    knowledge: data.knowledge.filter((k) => k.lectureId !== lectureId),
  };
}

export async function deleteFolder(data: AppData, folderId: string): Promise<AppData> {
  const nested = collectFolderIds(data.folders, folderId);
  let next = { ...data, folders: data.folders.filter((f) => !nested.includes(f.id)) };
  const lectures = next.lectures.filter((l) => l.folderId && nested.includes(l.folderId));
  for (const lec of lectures) {
    next = await deleteLecture(next, lec.id);
  }
  return next;
}

export async function deleteClass(data: AppData, classId: string): Promise<AppData> {
  let next = { ...data, classes: data.classes.filter((c) => c.id !== classId) };
  const folders = next.folders.filter((f) => f.classId === classId);
  for (const folder of folders) {
    next = await deleteFolder(next, folder.id);
  }
  const lectures = next.lectures.filter((l) => l.classId === classId);
  for (const lec of lectures) {
    next = await deleteLecture(next, lec.id);
  }
  return next;
}

function collectFolderIds(folders: FolderRecord[], rootId: string): string[] {
  const ids = [rootId];
  const queue = [rootId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const child of folders.filter((f) => f.parentFolderId === current)) {
      ids.push(child.id);
      queue.push(child.id);
    }
  }
  return ids;
}

export function upsertLecturePack(
  data: AppData,
  lecture: LectureRecord,
  slides: SlideRecord[],
  notes?: NotesRecord,
  quiz?: QuizRecord,
  knowledge?: LectureKnowledge,
): AppData {
  return {
    ...data,
    lectures: [...data.lectures.filter((l) => l.id !== lecture.id), lecture],
    slides: [...data.slides.filter((s) => s.lectureId !== lecture.id), ...slides],
    notes: notes
      ? [...data.notes.filter((n) => n.lectureId !== lecture.id), notes]
      : data.notes.filter((n) => n.lectureId !== lecture.id),
    quizzes: quiz
      ? [...data.quizzes.filter((q) => q.lectureId !== lecture.id), quiz]
      : data.quizzes.filter((q) => q.lectureId !== lecture.id),
    knowledge: knowledge
      ? [...(data.knowledge ?? []).filter((k) => k.lectureId !== lecture.id), knowledge]
      : (data.knowledge ?? []).filter((k) => k.lectureId !== lecture.id),
  };
}

export function setLectureStatus(
  data: AppData,
  lectureId: string,
  processingStatus: ProcessingStatus,
  processingError?: string,
): AppData {
  return {
    ...data,
    lectures: data.lectures.map((l) =>
      l.id === lectureId ? { ...l, processingStatus, processingError } : l,
    ),
  };
}

export function touchLecture(data: AppData, lectureId: string): AppData {
  return {
    ...data,
    lectures: data.lectures.map((l) =>
      l.id === lectureId ? { ...l, lastOpenedAt: nowIso() } : l,
    ),
  };
}

export function addChatMessage(
  data: AppData,
  lectureId: string,
  slideId: string,
  message: ChatMessage,
): AppData {
  const existing = data.conversations.find(
    (c) => c.lectureId === lectureId && c.slideId === slideId,
  );
  if (!existing) {
    return {
      ...data,
      conversations: [
        ...data.conversations,
        { id: createId("convo"), lectureId, slideId, messages: [message] },
      ],
    };
  }
  return {
    ...data,
    conversations: data.conversations.map((c) =>
      c.id === existing.id ? { ...c, messages: [...c.messages, message] } : c,
    ),
  };
}

export function replaceNotes(data: AppData, notes: NotesRecord): AppData {
  return {
    ...data,
    notes: [...data.notes.filter((n) => n.lectureId !== notes.lectureId), notes],
  };
}

export function replaceQuiz(data: AppData, quiz: QuizRecord): AppData {
  return {
    ...data,
    quizzes: [...data.quizzes.filter((q) => q.lectureId !== quiz.lectureId), quiz],
  };
}

export function updateQuiz(data: AppData, quiz: QuizRecord): AppData {
  return replaceQuiz(data, quiz);
}

export function recentLectures(data: AppData, limit = 4): LectureRecord[] {
  return [...data.lectures]
    .sort((a, b) => (b.lastOpenedAt ?? b.createdAt).localeCompare(a.lastOpenedAt ?? a.createdAt))
    .slice(0, limit);
}

export function findSlides(data: AppData, lectureId: string): SlideRecord[] {
  return data.slides
    .filter((s) => s.lectureId === lectureId)
    .sort((a, b) => a.slideNumber - b.slideNumber);
}

export function lecturePath(data: AppData, lecture: LectureRecord): string {
  const cls = lecture.classId
    ? data.classes.find((c) => c.id === lecture.classId)?.name
    : null;
  if (!lecture.folderId) return cls ? `${cls} · ${lecture.title}` : lecture.title;
  const parts: string[] = [];
  let folder = data.folders.find((f) => f.id === lecture.folderId) ?? null;
  while (folder) {
    parts.unshift(folder.name);
    folder = folder.parentFolderId
      ? data.folders.find((f) => f.id === folder!.parentFolderId) ?? null
      : null;
  }
  return [cls, ...parts, lecture.title].filter(Boolean).join(" · ");
}

export type { NotesDetail };
