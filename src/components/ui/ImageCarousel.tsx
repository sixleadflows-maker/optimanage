"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus } from "lucide-react";

export function ImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-square rounded-xl bg-gradient-to-br from-surface to-muted flex items-center justify-center overflow-hidden">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ImagePlus className="w-10 h-10 opacity-30" />
          <span className="text-xs opacity-50">No image</span>
        </div>
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <div className="aspect-square rounded-xl bg-gradient-to-br from-surface to-muted flex items-center justify-center overflow-hidden">
        <img src={images[0]} alt={alt} className="w-full h-full object-cover" />
      </div>
    );
  }

  const go = (delta: number) => setIndex((i) => (i + delta + images.length) % images.length);

  return (
    <div className="relative aspect-square rounded-xl bg-gradient-to-br from-surface to-muted overflow-hidden group">
      <div className="carousel-track h-full" style={{ transform: `translateX(-${index * 100}%)` }}>
        {images.map((src, i) => (
          <img key={i} src={src} alt={`${alt} ${i + 1}`} className="w-full h-full flex-shrink-0 object-cover" />
        ))}
      </div>

      <button type="button" onClick={() => go(-1)} aria-label="Previous image"
        className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => go(1)} aria-label="Next image"
        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4" />
      </button>

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-white">
        {images.map((_, i) => (
          <button key={i} type="button" onClick={() => setIndex(i)} aria-label={`Show image ${i + 1}`}
            className={`carousel-dot ${i === index ? "on" : ""}`} />
        ))}
      </div>
    </div>
  );
}
