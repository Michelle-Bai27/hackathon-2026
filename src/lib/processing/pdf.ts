import type { SlideRecord } from "../types";
import { createId } from "../ids";
import { putMedia } from "../storage/idb";
import { extractPdfLecture } from "./pdfRender";

const MAX_PAGES = 60;

export async function extractPdfSlides(
  file: File,
  lectureId: string,
  onPage?: (current: number, total: number) => void,
): Promise<SlideRecord[]> {
  const pages = await extractPdfLecture(await file.arrayBuffer(), MAX_PAGES, onPage);
  const slides: SlideRecord[] = [];
  for (const page of pages) {
    const imageId = createId("img");
    await putMedia(imageId, page.png);
    const title = page.text.split(/[.!?]/)[0]?.slice(0, 90) || `Slide ${page.pageNumber}`;
    const bullets = page.text
      .split(/(?:•|(?<=\.)\s)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8)
      .slice(0, 8);
    slides.push({
      id: createId("slide"),
      lectureId,
      slideNumber: page.pageNumber,
      title,
      extractedText: page.text || title,
      visualKind: page.pageNumber === 1 ? "title" : "bullets",
      bullets,
      imageId,
    });
  }
  return slides;
}
