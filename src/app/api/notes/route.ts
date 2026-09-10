import { NextResponse } from "next/server";
import { createJsonResponse, jsonError } from "@/lib/openai";
import { TUTOR_SYSTEM } from "@/lib/ai/prompts";
import { lectureMaterial, trimKnowledge } from "@/lib/ai/context";
import { nowIso } from "@/lib/ids";
import type { LectureKnowledge, LectureRecord, NotesDetail, SlideRecord } from "@/lib/types";

export const maxDuration = 120;

type NotesBody = {
  lecture: LectureRecord;
  slides: SlideRecord[];
  detail?: NotesDetail;
  knowledge?: LectureKnowledge | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as NotesBody;
    if (!body.lecture || !body.slides?.length) {
      return NextResponse.json(
        { error: "bad_request", message: "Lecture and slides are required." },
        { status: 400 },
      );
    }
    const detail = body.detail ?? "standard";
    const parsed = await createJsonResponse({
      instructions: `${TUTOR_SYSTEM}

You write concise revision notes from uploaded lecture slides only. Organize important concepts, include useful definitions, and make the notes easy to review. Do not invent lecture-specific facts.`,
      temperature: 0.3,
      input: `Create revision notes. Detail level: ${detail} (concise = short bullets, standard = balanced, detailed = more explanation).
Return JSON:
{
  "lectureId": string,
  "detail": "${detail}",
  "markdown": "markdown notes with ## headings, bullets, **key terms**, and slide refs like Slide 3 or Slides 4-6",
  "imageSlideNumbers": number[]
}
Use only the supplied lecture material. imageSlideNumbers should list slides that contain diagrams or figures if that is clear.
Lecture: ${JSON.stringify(lectureMaterial(body.lecture, body.slides))}
Optional analysis: ${JSON.stringify(trimKnowledge(body.knowledge))}`,
    });
    const markdown = typeof parsed.markdown === "string" ? parsed.markdown.trim() : "";
    if (!markdown) {
      throw new Error("Notes generation returned empty markdown.");
    }
    const imageSlideNumbers = Array.isArray(parsed.imageSlideNumbers)
      ? parsed.imageSlideNumbers.map(Number).filter((n) => Number.isFinite(n))
      : body.slides.filter((s) => s.imageId || s.diagramId).map((s) => s.slideNumber);
    return NextResponse.json({
      lectureId: body.lecture.id,
      detail,
      markdown,
      createdAt: nowIso(),
      imageSlideNumbers,
    });
  } catch (error) {
    const mapped = jsonError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
