import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  alt?: string;
};

export function BrandLogo({ className, alt = "SchoolXNow" }: BrandLogoProps) {
  return (
    <img
      src={logo}
      alt={alt}
      className={cn("object-contain", className)}
      decoding="async"
    />
  );
}
