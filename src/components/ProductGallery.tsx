import Image from "next/image";

/**
 * The product's images, stacked one under the other on desktop so the page
 * scrolls through the shoot the way a lookbook does, and as a snap-scrolling
 * row on phones where a tall stack would bury the buy button.
 *
 * No thumbnails and no lightbox: with the images already at full column width
 * there is nothing a thumbnail strip would reveal.
 */
export function ProductGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  return (
    <div className="-mx-5 flex snap-x snap-mandatory gap-1 overflow-x-auto sm:mx-0 lg:block lg:gap-0 lg:overflow-visible">
      {images.map((src, i) => (
        <div
          key={src}
          className="relative aspect-[4/5] w-full shrink-0 snap-center bg-linen lg:mb-1 lg:w-auto"
        >
          <Image
            src={src}
            alt={i === 0 ? alt : ""}
            fill
            priority={i === 0}
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}
