"use client";

import { useEffect, useState } from "react";
import type { FileKind, SlideRecord } from "@/lib/types";
import { getMedia, getOriginalFile } from "@/lib/storage/idb";
import { renderPdfPage } from "@/lib/processing/pdfRender";
import { rasterPptxSlide } from "@/lib/processing/pptxRaster";

export function OriginalSlide({
  slide,
  lectureId,
  fileKind,
}: {
  slide: SlideRecord;
  lectureId: string;
  fileKind: FileKind;
}) {
  const [raster, setRaster] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setRaster(null);

    (async () => {
      try {
        const original = await getOriginalFile(lectureId);
        if (cancelled) return;

        if (fileKind === "pdf" && original) {
          const png = await renderPdfPage(await original.arrayBuffer(), slide.slideNumber, 2);
          if (!cancelled) setRaster(png);
          return;
        }

        if (fileKind === "pptx" && original) {
          const png = await rasterPptxSlide(await original.arrayBuffer(), slide.slideNumber);
          if (!cancelled) setRaster(png);
          return;
        }

        await showStoredRaster();
      } catch {
        if (!cancelled) await showStoredRaster();
      }

      async function showStoredRaster() {
        if (slide.imageId) {
          const url = await getMedia(slide.imageId);
          if (!cancelled && url) {
            setRaster(url);
            return;
          }
        }
        if (!cancelled) setError("The original slide could not be displayed.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileKind, lectureId, slide.id, slide.imageId, slide.slideNumber]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-white px-8 text-center text-sm text-muted">
        {error}
      </div>
    );
  }

  if (!raster) {
    return <div className="h-full w-full bg-white" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={raster} alt="" className="h-full w-full object-contain bg-white" />
  );
}

export function OriginalSlideThumb({ slide }: { slide: SlideRecord }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!slide.imageId) return;
    getMedia(slide.imageId).then(setSrc);
  }, [slide.imageId]);
  if (!src) return <div className="h-full w-full bg-white" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-full w-full object-contain bg-white" />
  );
}
