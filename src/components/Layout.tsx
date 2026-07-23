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
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full min-w-0">
        <AppSidebar activeModule={activeModule} setActiveModule={setActiveModule} />
        <SidebarInset className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 flex h-14 md:h-16 shrink-0 items-center gap-2 border-b px-3 md:px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="touch-target -ml-1">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <div className="flex items-center gap-2 md:gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg blur-sm group-hover:blur-md transition-all duration-300" />
                <div className="relative bg-gradient-to-br from-primary/10 to-accent/10 p-1.5 md:p-2 rounded-lg border border-primary/20 group-hover:border-primary/40 transition-all duration-300 group-hover:scale-105">
                  <BrandLogo className="h-6 w-6 md:h-7 md:w-7 drop-shadow-md" />
                </div>
              </div>
              <h1 className="text-base sm:text-lg md:text-xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent truncate">
                SchoolXNow
              </h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-x-hidden bg-background p-3 md:min-h-[calc(100vh-4rem)] md:gap-4 md:p-4 lg:p-6 min-h-[calc(100vh-3.5rem)]">
            {children}
          </main>
          <BrandFooter compact />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
