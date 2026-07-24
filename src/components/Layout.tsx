import { ReactNode } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandFooter } from "@/components/BrandFooter";
import { BrandLogo } from "@/components/BrandLogo";
import { Menu } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  activeModule: string;
  setActiveModule: (module: string) => void;
}

export function Layout({ children, activeModule, setActiveModule }: LayoutProps) {
  const moduleTitle = activeModule
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-[100dvh] w-full min-w-0">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <AppSidebar activeModule={activeModule} setActiveModule={setActiveModule} />
        <SidebarInset className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur-xl md:h-[4.5rem] md:px-6">
            <SidebarTrigger className="touch-target -ml-1">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <div className="flex min-w-0 items-center gap-3">
              <div className="hidden rounded-lg border border-primary/15 bg-primary/5 p-1.5 sm:block">
                <BrandLogo className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">SchoolXNow workspace</p>
                <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">{moduleTitle}</h1>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>
          <main id="main-content" className="surface-grid flex min-h-[calc(100dvh-4rem)] min-w-0 flex-1 flex-col gap-4 overflow-x-hidden bg-background/55 p-3 sm:p-5 lg:p-7">
            {children}
          </main>
          <BrandFooter compact />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
