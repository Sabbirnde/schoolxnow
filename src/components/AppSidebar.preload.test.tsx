import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { preloadDashboardModule } from "@/lib/dashboardModuleLoaders";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    profile: {
      full_name: "School Admin",
      role: "school_admin",
    },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/useModuleAccess", () => ({
  useModuleAccess: () => ({
    getAccessibleModules: () => [
      {
        id: "students",
        title: "Students",
        category: "management",
      },
      {
        id: "settings",
        title: "Settings",
        category: "admin",
      },
    ],
  }),
}));

vi.mock("@/lib/dashboardModuleLoaders", () => ({
  preloadDashboardModule: vi.fn(),
}));

describe("AppSidebar module preloading", () => {
  beforeEach(() => {
    vi.mocked(preloadDashboardModule).mockClear();
  });

  const renderSidebar = () =>
    render(
      <SidebarProvider defaultOpen>
        <AppSidebar activeModule="dashboard" setActiveModule={vi.fn()} />
      </SidebarProvider>,
    );

  it("preloads a module when its navigation item is hovered", () => {
    renderSidebar();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Students" }));

    expect(preloadDashboardModule).toHaveBeenCalledWith("students", "school_admin");
  });

  it("preloads a module when its navigation item receives keyboard focus", () => {
    renderSidebar();

    fireEvent.focus(screen.getByRole("button", { name: "Settings" }));

    expect(preloadDashboardModule).toHaveBeenCalledWith("settings", "school_admin");
  });
});
