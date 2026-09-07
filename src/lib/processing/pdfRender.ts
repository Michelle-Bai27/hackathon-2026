import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

let workerReady = false;

function ensureWorker() {
  if (workerReady) return;
  GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs";
  workerReady = true;
}

export async function renderPdfPage(source: ArrayBuffer | Uint8Array, pageNumber: number, scale = 2): Promise<string> {
  ensureWorker();
  const data = source instanceof Uint8Array ? source : new Uint8Array(source);
  const pdf = await getDocument({ data: data.slice() }).promise;
  return rasterPage(pdf, pageNumber, scale);
}

export async function extractPdfLecture(
  source: ArrayBuffer | Uint8Array,
  maxPages: number,
  onPage?: (current: number, total: number) => void,
): Promise<{ png: string; text: string; pageNumber: number }[]> {
  ensureWorker();
  const data = source instanceof Uint8Array ? source : new Uint8Array(source);
  const pdf = await getDocument({ data: data.slice() }).promise;
  const total = Math.min(pdf.numPages, maxPages);
  const pages: { png: string; text: string; pageNumber: number }[] = [];
  for (let i = 1; i <= total; i++) {
    onPage?.(i, total);
    const page = await pdf.getPage(i);
    const png = await rasterLoadedPage(page, 2);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push({ png, text, pageNumber: i });
  }
  return pages;
}

export async function extractPdfText(source: ArrayBuffer | Uint8Array, pageNumber: number): Promise<string> {
  ensureWorker();
  const data = source instanceof Uint8Array ? source : new Uint8Array(source);
  const pdf = await getDocument({ data: data.slice() }).promise;
  const page = await pdf.getPage(pageNumber);
  const textContent = await page.getTextContent();
  return textContent.items
    .map((item) => ("str" in item ? item.str : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function countPdfPages(source: ArrayBuffer | Uint8Array): Promise<number> {
  ensureWorker();
  const data = source instanceof Uint8Array ? source : new Uint8Array(source);
  const pdf = await getDocument({ data: data.slice() }).promise;
  return pdf.numPages;
}

async function rasterPage(pdf: Awaited<ReturnType<typeof getDocument>["promise"]>, pageNumber: number, scale: number) {
  return rasterLoadedPage(await pdf.getPage(pageNumber), scale);
}

async function rasterLoadedPage(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof getDocument>["promise"]>["getPage"]>>,
  scale: number,
) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL("image/png");
}
