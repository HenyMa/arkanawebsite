"use client";

import Image from "next/image";
import { useState } from "react";

export function ProductGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden bg-linen">
        <Image
          key={images[active]}
          src={images[active]}
          alt={alt}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 55vw"
          className="animate-rise object-cover"
        />
      </div>

      {images.length > 1 && (
        <div className="mt-4 flex gap-4">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={i === active}
              className={`relative aspect-[4/5] w-20 overflow-hidden bg-linen transition-opacity ${
                i === active
                  ? "ring-1 ring-gold"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              <Image src={src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
