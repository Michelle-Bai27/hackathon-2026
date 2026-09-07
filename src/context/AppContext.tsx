"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AppData,
  ChatMessage,
  LectureRecord,
  NotesRecord,
  ProcessingStatus,
  QuizRecord,
  SlideRecord,
} from "@/lib/types";
import {
  addChatMessage,
  createClass as addClass,
  createFolder as addFolder,
  deleteClass as removeClass,
  deleteFolder as removeFolder,
  deleteLecture as removeLecture,
  moveLecture as moveLec,
  recentLectures,
  renameClass,
  renameFolder,
  renameLecture,
  replaceNotes,
  replaceQuiz,
  setLectureStatus,
  touchLecture,
  upsertLecturePack,
} from "@/lib/store";
import { getAppSnapshot, setAppSnapshot, useAppSnapshot } from "@/lib/appStore";
import { detectKind, processUploadedLecture } from "@/lib/processing";
import { createId, nowIso } from "@/lib/ids";

type AppContextValue = {
  data: AppData;
  ready: boolean;
  uploadOpen: boolean;
  setUploadOpen: (open: boolean) => void;
  processing: { lectureId: string; status: ProcessingStatus; detail?: string } | null;
  createClass: (name: string) => void;
  createFolder: (classId: string, name: string, parentFolderId: string | null) => void;
  rename: (kind: "class" | "folder" | "lecture", id: string, name: string) => void;
  remove: (kind: "class" | "folder" | "lecture", id: string) => Promise<void>;
  moveLecture: (lectureId: string, folderId: string | null, classId: string | null) => void;
  openLecture: (id: string) => void;
  recents: LectureRecord[];
  uploadFile: (file: File, classId?: string | null, folderId?: string | null) => Promise<void>;
  retryProcessing: (lectureId: string, file: File) => Promise<void>;
  pushMessage: (lectureId: string, slideId: string, message: ChatMessage) => void;
  saveNotes: (notes: NotesRecord) => void;
  saveQuiz: (quiz: QuizRecord) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const data = useAppSnapshot();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [processing, setProcessing] = useState<AppContextValue["processing"]>(null);

  const update = useCallback((fn: (d: AppData) => AppData) => {
    setAppSnapshot(fn(getAppSnapshot()));
  }, []);

  const uploadFile = useCallback(
    async (file: File, classId?: string | null, folderId: string | null = null) => {
      if (!detectKind(file)) {
        throw new Error("unsupported");
      }
      setUploadOpen(false);
      const placeholderId = createId("lec");
      const targetClassId = classId || null;
      update((current) => {
        const draft: LectureRecord = {
          id: placeholderId,
          classId: targetClassId,
          folderId,
          title: file.name.replace(/\.(pdf|pptx)$/i, "").replace(/[_-]+/g, " "),
          originalFileName: file.name,
          type: detectKind(file)!,
          createdAt: nowIso(),
          processingStatus: "queued",
          lastOpenedAt: nowIso(),
        };
        return { ...current, lectures: [...current.lectures, draft] };
      });
      router.push(`/lecture/${placeholderId}`);
      setProcessing({ lectureId: placeholderId, status: "reading" });

      try {
        const pack = await processUploadedLecture({
          file,
          classId: targetClassId,
          folderId,
          lectureId: placeholderId,
          onStatus: (status, detail) => {
            setProcessing({ lectureId: placeholderId, status, detail });
            update((d) => setLectureStatus(d, placeholderId, status));
          },
        });
        pack.lecture.id = placeholderId;
        pack.lecture.classId = targetClassId;
        pack.lecture.folderId = folderId;
        pack.slides = pack.slides.map((s: SlideRecord) => ({ ...s, lectureId: placeholderId }));
        pack.notes.lectureId = placeholderId;
        pack.quiz.lectureId = placeholderId;
        if (pack.knowledge) pack.knowledge.lectureId = placeholderId;
        update((d) => upsertLecturePack(d, pack.lecture, pack.slides, pack.notes, pack.quiz, pack.knowledge));
        setProcessing(null);
      } catch (error) {
        const message =
          error instanceof Error && error.message === "unsupported"
            ? "This file type isn't supported yet. Please upload a PDF or PowerPoint."
            : "We couldn't fully analyze this lecture. You can retry processing.";
        update((d) => setLectureStatus(d, placeholderId, "error", message));
        setProcessing(null);
      }
    },
    [router, update],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      data,
      ready: true,
      uploadOpen,
      setUploadOpen,
      processing,
      createClass: (name) => update((d) => addClass(d, name)),
      createFolder: (classId, name, parentFolderId) => update((d) => addFolder(d, classId, name, parentFolderId)),
      rename: (kind, id, name) =>
        update((d) => {
          if (kind === "class") return renameClass(d, id, name);
          if (kind === "folder") return renameFolder(d, id, name);
          return renameLecture(d, id, name);
        }),
      remove: async (kind, id) => {
        if (kind === "lecture") {
          setAppSnapshot(await removeLecture(data, id));
          return;
        }
        if (kind === "folder") {
          setAppSnapshot(await removeFolder(data, id));
          return;
        }
        setAppSnapshot(await removeClass(data, id));
      },
      moveLecture: (lectureId, folderId, classId) => update((d) => moveLec(d, lectureId, folderId, classId)),
      openLecture: (id) => {
        update((d) => touchLecture(d, id));
        router.push(`/lecture/${id}`);
      },
      recents: recentLectures(data),
      uploadFile,
      retryProcessing: async (_lectureId, file) => uploadFile(file),
      pushMessage: (lectureId, slideId, message) => update((d) => addChatMessage(d, lectureId, slideId, message)),
      saveNotes: (notes) => update((d) => replaceNotes(d, notes)),
      saveQuiz: (quiz) => update((d) => replaceQuiz(d, quiz)),
    }),
    [data, processing, router, update, uploadFile, uploadOpen],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
