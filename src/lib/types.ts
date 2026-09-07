export type FileKind = "pdf" | "pptx";
export type ProcessingStatus =
  | "queued"
  | "reading"
  | "structure"
  | "concepts"
  | "tutor"
  | "notes"
  | "ready"
  | "error";

export type WorkspaceMode = "study" | "notes" | "quiz";
export type NotesDetail = "concise" | "standard" | "detailed";
export type QuizDifficulty = "easy" | "medium" | "hard";
export type QuizQuestionType = "multiple_choice" | "true_false" | "short_answer";

export type SlideVisualKind =
  | "title"
  | "bullets"
  | "split"
  | "diagram"
  | "equation"
  | "summary";

export interface ClassRecord {
  id: string;
  name: string;
  createdAt: string;
}

export interface FolderRecord {
  id: string;
  classId: string;
  parentFolderId: string | null;
  name: string;
  createdAt: string;
}

export interface LectureRecord {
  id: string;
  classId: string | null;
  folderId: string | null;
  title: string;
  originalFileName: string;
  type: FileKind;
  createdAt: string;
  processingStatus: ProcessingStatus;
  processingError?: string;
  subject?: string;
  overview?: string;
  lastOpenedAt?: string;
}

export interface SlideRecord {
  id: string;
  lectureId: string;
  slideNumber: number;
  title: string;
  extractedText: string;
  visualKind: SlideVisualKind;
  bullets: string[];
  kicker?: string;
  footer?: string;
  diagramId?: string;
  imageId?: string;
  aiContext?: string;
}

export type MessageRole = "tutor" | "student";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  fromLecture?: boolean;
}

export interface ConversationRecord {
  id: string;
  lectureId: string;
  slideId: string;
  messages: ChatMessage[];
}

export interface NotesRecord {
  lectureId: string;
  detail: NotesDetail;
  markdown: string;
  createdAt: string;
  imageSlideNumbers: number[];
}

export interface QuizChoice {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  choices?: QuizChoice[];
  correctChoiceId?: string;
  correctBoolean?: boolean;
  acceptedAnswers?: string[];
  explanation: string;
  slideNumber: number;
  topic: string;
}

export interface QuizRecord {
  lectureId: string;
  title: string;
  difficulty: QuizDifficulty;
  questionTypes: QuizQuestionType[];
  questions: QuizQuestion[];
  answers: Record<string, string | boolean>;
  revealed: Record<string, boolean>;
  createdAt: string;
  completedAt?: string;
}

export interface LectureKnowledge {
  lectureId: string;
  topic: string;
  summary: string;
  sections: LectureSection[];
  concepts: LectureConcept[];
  terms: LectureTerm[];
  slides: SlideKnowledge[];
}

export interface LectureSection {
  title: string;
  slideNumbers: number[];
  idea: string;
}

export interface LectureConcept {
  id: string;
  name: string;
  definition: string;
  whyItMatters: string;
  slideNumbers: number[];
}

export interface LectureTerm {
  term: string;
  definition: string;
  slideNumbers: number[];
}

export interface SlideKnowledge {
  slideNumber: number;
  mainConcept: string;
  supporting: string[];
  complexity: "simple" | "moderate" | "complex";
  visualDescription?: string;
  relationPrevious?: string;
  relationNext?: string;
  fromLecture: string[];
  teacherExplanation: string;
  takeaways: string[];
  terms: { term: string; definition: string }[];
  misconceptions: string[];
}

export interface AppData {
  classes: ClassRecord[];
  folders: FolderRecord[];
  lectures: LectureRecord[];
  slides: SlideRecord[];
  conversations: ConversationRecord[];
  notes: NotesRecord[];
  quizzes: QuizRecord[];
  knowledge: LectureKnowledge[];
}

export interface TutorExplanation {
  headline: string;
  fromLecture: string[];
  explanation: string;
  terms: { term: string; definition: string }[];
  connections: string[];
  whyItMatters: string;
  diagramNote?: string;
}
