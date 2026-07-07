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
  ArrowRightLeft
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
    <Sidebar className="border-r">
      <SidebarContent className="gap-0">
        <SidebarGroup className="border-b px-0">
          <SidebarGroupLabel className="px-4 py-2 text-base md:text-lg font-bold text-primary bg-primary/5">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 md:h-8 md:w-8 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-xs md:text-sm font-bold">S</span>
              </div>
              <span className="hidden md:inline">SchoolXNow</span>
            </div>
          </SidebarGroupLabel>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {mainModules.map((module) => {
                const Icon = iconByModule[module.id] || Home;

                return (
                <SidebarMenuItem key={module.id}>
                  <SidebarMenuButton
                    onClick={() => setActiveModule(module.id)}
                    isActive={activeModule === module.id}
                    className="w-full justify-start h-10 px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
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
          <SidebarGroup className="border-t pt-4">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <div className="px-3 py-2 border rounded-lg bg-muted/50">
                    <div className="font-medium text-sm truncate">{profile.full_name}</div>
                    <div className="text-xs text-muted-foreground capitalize truncate">
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
