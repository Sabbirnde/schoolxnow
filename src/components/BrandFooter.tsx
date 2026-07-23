import { Link, useLocation } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type BrandFooterProps = {
  className?: string;
  compact?: boolean;
};

export function BrandFooter({ className, compact = false }: BrandFooterProps) {
  return (
    <footer
      aria-label="SchoolXNow branding"
      className={cn("border-t border-border/70 bg-background/95", className)}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 text-center sm:flex-row sm:text-left",
          compact ? "py-3" : "py-5",
        )}
      >
        <Link
          to="/"
          className="group flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="SchoolXNow home"
        >
          <span className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/10 to-accent/10 p-1.5 transition-transform group-hover:scale-105">
            <BrandLogo className="h-7 w-7 drop-shadow-sm" />
          </span>
          <span>
            <span className="block text-sm font-bold tracking-tight text-foreground">SchoolXNow</span>
            {!compact && (
              <span className="block text-xs text-muted-foreground">Education, connected.</span>
            )}
          </span>
        </Link>

        <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground sm:items-end">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            First-party SchoolXNow experience
          </span>
          <span>&copy; {new Date().getFullYear()} SchoolXNow. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}

export function RouteBrandFooter() {
  const { pathname } = useLocation();

  if (pathname === "/" || pathname.startsWith("/dashboard")) {
    return null;
  }

  return <BrandFooter />;
}
