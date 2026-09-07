import { NextResponse } from "next/server";
import { analyzeLectureLocal } from "@/lib/ai/analyze";
import { generateNotes, generateQuiz } from "@/lib/ai/generate";
import { ANALYZE_INSTRUCTION, TUTOR_SYSTEM } from "@/lib/ai/prompts";
import { answerFromKnowledge, explanationFromKnowledge } from "@/lib/ai/serve";
import type { AiRequest } from "@/lib/ai/client";
import type { LectureKnowledge } from "@/lib/types";

export async function POST(req: Request) {
  const body = (await req.json()) as AiRequest;
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  if (!key) {
    return NextResponse.json(local(body));
  }

  try {
    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: body.kind === "analyze" ? 0.35 : 0.45,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: TUTOR_SYSTEM },
          { role: "user", content: userPrompt(body) },
        ],
      }),
    });
    if (!completion.ok) {
      return NextResponse.json(local(body));
    }
    const json = await completion.json();
    const text = json.choices?.[0]?.message?.content;
    if (!text) return NextResponse.json(local(body));
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (body.kind === "analyze") {
      return NextResponse.json({ ...parsed, lectureId: body.lecture.id });
    }
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(local(body));
  }
}

function local(body: AiRequest) {
  if (body.kind === "analyze") return analyzeLectureLocal(body.lecture, body.slides);
  if (body.kind === "explain") {
    return explanationFromKnowledge(body.lecture, body.slides, body.index, body.knowledge);
  }
  if (body.kind === "chat") {
    return {
      content: answerFromKnowledge(body.lecture, body.slides, body.index, body.question, body.knowledge),
    };
  }
  if (body.kind === "notes") {
    return generateNotes(body.lecture, body.slides, body.detail, body.knowledge);
  }
  return generateQuiz(
    body.lecture,
    body.slides,
    { count: body.count, difficulty: body.difficulty, types: body.types },
    body.knowledge,
  );
}

function userPrompt(body: AiRequest) {
  if (body.kind === "analyze") {
    return `${ANALYZE_INSTRUCTION}\n\nLecture title: ${body.lecture.title}\nSlides (in order):\n${JSON.stringify(
      body.slides.map((s) => ({
        slideNumber: s.slideNumber,
        title: s.title,
        bullets: s.bullets,
        extractedText: s.extractedText,
        hasVisual: Boolean(s.diagramId || s.imageId),
      })),
    )}`;
  }
  if (body.kind === "explain") {
    return `Return JSON for one slide tutor card: { "headline", "fromLecture": [], "explanation": "markdown teacher deep-dive", "terms": [{"term","definition"}], "connections": [], "whyItMatters", "diagramNote"? }\nCurrent slide index ${body.index}.\nKnowledge:\n${JSON.stringify(trimKnowledge(body.knowledge, body.index))}\nSlides:\n${JSON.stringify(body.slides)}`;
  }
  if (body.kind === "chat") {
    return `Return JSON { "content": "teacher reply" }. Answer the student's question using current slide + lecture knowledge. Do not claim the instructor said extra things.\nQuestion: ${body.question}\nHistory: ${JSON.stringify(body.history)}\nKnowledge:\n${JSON.stringify(trimKnowledge(body.knowledge, body.index))}`;
  }
  if (body.kind === "notes") {
    return `Compress the TEACHING (knowledge.takeaways, concepts, terms, teacher explanations) into revision-note markdown. Not a PowerPoint copy. Headings, bullets, key terms, slide refs like "Slides 4–6". Detail=${body.detail}. Return JSON { lectureId, detail, markdown, createdAt, imageSlideNumbers }.\nKnowledge:\n${JSON.stringify(trimKnowledge(body.knowledge))}`;
  }
  return `Create a conceptual quiz from the taught knowledge (mechanisms, why, terms, misconceptions), spread across the whole lecture — not "what does slide N say?". Return a QuizRecord JSON with questions[]. Types=${JSON.stringify(body.types)} count=${body.count} difficulty=${body.difficulty}.\nKnowledge:\n${JSON.stringify(trimKnowledge(body.knowledge))}`;
}

function trimKnowledge(knowledge?: LectureKnowledge | null, index?: number) {
  if (!knowledge) return null;
  const current = typeof index === "number" ? knowledge.slides[index] : null;
  return {
    topic: knowledge.topic,
    summary: knowledge.summary,
    sections: knowledge.sections,
    concepts: knowledge.concepts,
    terms: knowledge.terms.slice(0, 20),
    currentSlide: current,
    nearby: knowledge.slides
      .filter((s) => current && Math.abs(s.slideNumber - current.slideNumber) <= 2)
      .map((s) => ({
        slideNumber: s.slideNumber,
        mainConcept: s.mainConcept,
        takeaways: s.takeaways,
        teacherExplanation: s.teacherExplanation.slice(0, 1200),
      })),
    allTakeaways: knowledge.slides.map((s) => ({
      slideNumber: s.slideNumber,
      mainConcept: s.mainConcept,
      takeaways: s.takeaways,
      misconceptions: s.misconceptions,
    })),
  };
}
