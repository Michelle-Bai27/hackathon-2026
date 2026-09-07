import { StudyWorkspace } from "@/components/study/StudyWorkspace";

export default async function LecturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudyWorkspace lectureId={id} />;
}
