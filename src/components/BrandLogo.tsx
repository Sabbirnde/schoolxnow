import logo32Avif from "@/assets/logo-32.avif";
import logo64Avif from "@/assets/logo-64.avif";
import logo96Avif from "@/assets/logo-96.avif";
import logo32Webp from "@/assets/logo-32.webp";
import logo64Webp from "@/assets/logo-64.webp";
import logo96Webp from "@/assets/logo-96.webp";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  alt?: string;
  sizes?: string;
};

const avifSrcSet = `${logo32Avif} 32w, ${logo64Avif} 64w, ${logo96Avif} 96w`;
const webpSrcSet = `${logo32Webp} 32w, ${logo64Webp} 64w, ${logo96Webp} 96w`;

export function BrandLogo({
  className,
  alt = "SchoolXNow",
  sizes = "48px",
}: BrandLogoProps) {
  return (
    <picture className="contents">
      <source srcSet={avifSrcSet} sizes={sizes} type="image/avif" />
      <source srcSet={webpSrcSet} sizes={sizes} type="image/webp" />
      <img
        src={logo64Webp}
        srcSet={webpSrcSet}
        sizes={sizes}
        width="64"
        height="42"
        alt={alt}
        className={cn("object-contain", className)}
        decoding="async"
      />
    </picture>
  );
}
