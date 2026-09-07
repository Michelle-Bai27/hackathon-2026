import JSZip from "jszip";
import type { SlideRecord } from "../types";
import { createId } from "../ids";
import { putMedia } from "../storage/idb";
import { rasterPptxDeck } from "./pptxRaster";

export async function extractPptxSlides(
  file: File,
  lectureId: string,
  onSlide?: (current: number, total: number) => void,
): Promise<SlideRecord[]> {
  const buffer = await file.arrayBuffer();
  const texts = await extractPptxText(buffer);
  const images = await rasterPptxDeck(buffer, onSlide);
  const slides: SlideRecord[] = [];
  for (let i = 0; i < images.length; i++) {
    const imageId = createId("img");
    await putMedia(imageId, images[i]);
    const pageTexts = texts[i] ?? [];
    slides.push({
      id: createId("slide"),
      lectureId,
      slideNumber: i + 1,
      title: pageTexts[0]?.slice(0, 90) || `Slide ${i + 1}`,
      extractedText: pageTexts.join(" ") || `Slide ${i + 1}`,
      visualKind: i === 0 ? "title" : "bullets",
      bullets: pageTexts.slice(1, 9),
      imageId,
    });
  }
  return slides;
}

async function extractPptxText(buffer: ArrayBuffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(buffer);
  const paths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
    .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1] ?? 0) - Number(b.match(/slide(\d+)/i)?.[1] ?? 0));
  const pages: string[][] = [];
  for (const path of paths) {
    const xml = await zip.file(path)?.async("string");
    if (!xml) {
      pages.push([]);
      continue;
    }
    pages.push(
      [...xml.matchAll(/<a:t(?: [^>]*)?>([\s\S]*?)<\/a:t>/g)]
        .map((m) => m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim())
        .filter(Boolean),
    );
  }
  return pages;
}
