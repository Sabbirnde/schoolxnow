import { 
  Home,
  Users,
  BookOpen,
  Calendar,
  FileText,
  Settings,
  BarChart3,
  School,
  UserCheck,
  ClipboardList,
  LogOut,
  Award,
  ArrowRightLeft,
  Layers3,
  WalletCards
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { BrandLogo } from "@/components/BrandLogo";
import { preloadDashboardModule } from "@/lib/dashboardModuleLoaders";

interface AppSidebarProps {
  activeModule: string;
  setActiveModule: (module: string) => void;
}

export function AppSidebar({ activeModule, setActiveModule }: AppSidebarProps) {
  const { profile, loading, signOut } = useAuth();
  const { getAccessibleModules } = useModuleAccess();

  // Show loading state while auth is initializing
  if (loading) {
    return (
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-lg font-semibold text-primary">
              EduManage
            </SidebarGroupLabel>
            <div className="p-4">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-4 bg-muted rounded w-2/3"></div>
              </div>
            </div>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    );
  }

  const iconByModule: Record<string, unknown> = {
    dashboard: Home,
    schools: School,
    users: Users,
    students: Users,
    classes: BookOpen,
    subjects: ClipboardList,
    "class-assignment": ArrowRightLeft,
    "academic-operations": Layers3,
    billing: WalletCards,
    attendance: UserCheck,
    exams: FileText,
    "exam-marks": Award,
    timetable: Calendar,
    reports: BarChart3,
    settings: Settings,
  };

  const categoryOrder = ["admin", "management", "operations", "reporting"] as const;
  const accessibleModules = getAccessibleModules();

  const orderedModules = [...accessibleModules].sort((a, b) => {
    const categoryDiff =
      categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    if (categoryDiff !== 0) return categoryDiff;
    return a.title.localeCompare(b.title);
  });

  const settingsModule = orderedModules.find((module) => module.id === "settings");
  const mainModules = orderedModules.filter((module) => module.id !== "settings");

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent className="gap-0">
        <SidebarGroup className="border-b border-sidebar-border px-0 py-2">
          <SidebarGroupLabel className="h-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-sidebar-primary p-1.5 shadow-soft">
                <BrandLogo className="h-7 w-7" />
              </div>
              <div className="hidden min-w-0 md:block">
                <div className="truncate text-base font-semibold tracking-tight text-sidebar-foreground">SchoolXNow</div>
                <div className="text-[0.65rem] font-medium uppercase tracking-[0.16em] text-sidebar-foreground/55">Essential suite</div>
              </div>
            </div>
          </SidebarGroupLabel>
        </SidebarGroup>
        
        <SidebarGroup className="py-4">
          <SidebarGroupLabel className="px-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {mainModules.map((module) => {
                const Icon = iconByModule[module.id] || Home;

                return (
                <SidebarMenuItem key={module.id}>
                  <SidebarMenuButton
                    onClick={() => setActiveModule(module.id)}
                    onMouseEnter={() => preloadDashboardModule(module.id, profile?.role)}
                    onFocus={() => preloadDashboardModule(module.id, profile?.role)}
                    isActive={activeModule === module.id}
                    className="h-10 w-full justify-start rounded-md px-3 text-sm font-medium text-sidebar-foreground/72 transition-all duration-200 hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{module.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )})}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {settingsModule && (
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActiveModule(settingsModule.id)}
                  onMouseEnter={() => preloadDashboardModule(settingsModule.id, profile?.role)}
                  onFocus={() => preloadDashboardModule(settingsModule.id, profile?.role)}
                  isActive={activeModule === "settings"}
                  className="h-10 px-3 text-sm"
                >
                  <Settings className="h-4 w-4" />
                  <span>{settingsModule.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        )}

        {/* User Profile Section */}
        {profile && (
          <SidebarGroup className="border-t border-sidebar-border pt-4">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/65 px-3 py-2.5">
                    <div className="truncate text-sm font-semibold text-sidebar-foreground">{profile.full_name}</div>
                    <div className="truncate text-xs capitalize text-sidebar-foreground/55">
                      {profile.role.replace('_', ' ')}
                    </div>
                  </div>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={async () => {
                      await signOut();
                    }}
                    className="h-10 px-3 text-sm text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
