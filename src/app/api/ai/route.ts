import { NextResponse } from "next/server";
import { analyzeLectureLocal } from "@/lib/ai/analyze";
import { ANALYZE_INSTRUCTION, TUTOR_SYSTEM } from "@/lib/ai/prompts";
import { lectureMaterial } from "@/lib/ai/context";
import { createJsonResponse, jsonError, OpenAIConfigError } from "@/lib/openai";
import type { AiRequest } from "@/lib/ai/client";

export async function POST(req: Request) {
  const body = (await req.json()) as AiRequest;
  if (body.kind !== "analyze") {
    return NextResponse.json(
      { error: "gone", message: "Use /api/tutor, /api/notes, or /api/quiz." },
      { status: 410 },
    );
  }
  try {
    const parsed = await createJsonResponse({
      instructions: TUTOR_SYSTEM,
      temperature: 0.35,
      input: `${ANALYZE_INSTRUCTION}\n\nLecture:\n${JSON.stringify(lectureMaterial(body.lecture, body.slides))}`,
    });
    return NextResponse.json({ ...parsed, lectureId: body.lecture.id });
  } catch (error) {
    if (error instanceof OpenAIConfigError) {
      return NextResponse.json(analyzeLectureLocal(body.lecture, body.slides));
    }
    const mapped = jsonError(error);
    if (mapped.body.error === "not_configured") {
      return NextResponse.json(analyzeLectureLocal(body.lecture, body.slides));
    }
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
