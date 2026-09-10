import { NextResponse } from "next/server";
import { createJsonResponse, jsonError } from "@/lib/openai";
import { TUTOR_SYSTEM } from "@/lib/ai/prompts";
import { lectureMaterial, trimKnowledge } from "@/lib/ai/context";
import type { LectureKnowledge, LectureRecord, SlideRecord } from "@/lib/types";

export const maxDuration = 120;

type TutorBody = {
  kind?: "explain" | "chat";
  lecture: LectureRecord;
  slides: SlideRecord[];
  index: number;
  question?: string;
  history?: { role: "tutor" | "student"; content: string }[];
  knowledge?: LectureKnowledge | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TutorBody;
    if (!body.lecture || !body.slides?.length) {
      return NextResponse.json(
        { error: "bad_request", message: "Lecture and slides are required." },
        { status: 400 },
      );
    }
    const index = Number.isFinite(body.index) ? body.index : 0;
    const slide = body.slides[index] ?? body.slides[0];
    const material = lectureMaterial(body.lecture, body.slides);
    const knowledge = trimKnowledge(body.knowledge, index);

    if (body.kind === "chat" || body.question?.trim()) {
      const parsed = await createJsonResponse({
        instructions: TUTOR_SYSTEM,
        temperature: 0.45,
        input: `Return JSON: { "content": "teacher reply in markdown-friendly plain text" }.
Answer the student's question using the current slide first, then the rest of the uploaded lecture.
Do not invent lecture-specific facts that are not in the material. You may use standard disciplinary knowledge to explain ideas the slides point at.
Never claim the instructor said something that is not in the upload.

Question: ${body.question}
Recent messages: ${JSON.stringify((body.history ?? []).slice(-8))}
Current slide ${slide.slideNumber}: ${JSON.stringify({ title: slide.title, extractedText: slide.extractedText, bullets: slide.bullets })}
Lecture material: ${JSON.stringify(material)}
Prior analysis (optional): ${JSON.stringify(knowledge)}`,
      });
      const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
      if (!content) {
        throw new Error("The tutor returned an empty answer.");
      }
      return NextResponse.json({ content });
    }

    const parsed = await createJsonResponse({
      instructions: TUTOR_SYSTEM,
      temperature: 0.4,
      input: `Return JSON for one slide tutor card:
{
  "headline": string,
  "fromLecture": string[],
  "explanation": "teacher deep-dive, markdown ok",
  "terms": [{ "term": string, "definition": string }],
  "connections": string[],
  "whyItMatters": string,
  "diagramNote": string | null
}
Teach the CURRENT slide clearly. Do not recap bullets as the explanation.
Current slide index ${index} (slide ${slide.slideNumber}).
Current slide: ${JSON.stringify({ title: slide.title, extractedText: slide.extractedText, bullets: slide.bullets, hasVisual: Boolean(slide.diagramId || slide.imageId) })}
Lecture material: ${JSON.stringify(material)}
Prior analysis (optional): ${JSON.stringify(knowledge)}`,
    });
    return NextResponse.json({
      headline: String(parsed.headline ?? slide.title),
      fromLecture: Array.isArray(parsed.fromLecture) ? parsed.fromLecture : [],
      explanation: String(parsed.explanation ?? ""),
      terms: Array.isArray(parsed.terms) ? parsed.terms : [],
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
      whyItMatters: String(parsed.whyItMatters ?? ""),
      diagramNote: typeof parsed.diagramNote === "string" ? parsed.diagramNote : undefined,
    });
  } catch (error) {
    const mapped = jsonError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
