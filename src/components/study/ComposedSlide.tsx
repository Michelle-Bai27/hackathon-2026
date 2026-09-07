"use client";

import { useEffect, useState } from "react";
import type { SlideRecord } from "@/lib/types";
import { getMedia } from "@/lib/storage/idb";

/** @deprecated Use OriginalSlide. Kept only as a raster fallback, never HTML reconstruction. */
export function ComposedSlide({ slide }: { slide: SlideRecord }) {
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!slide.imageId) return;
    getMedia(slide.imageId).then((url) => {
      if (!cancelled) setImage(url);
    });
    return () => {
      cancelled = true;
    };
  }, [slide.imageId]);

  if (!image) {
    return <div className="h-full w-full bg-white" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className="h-full w-full object-contain bg-white" />
  );
}
