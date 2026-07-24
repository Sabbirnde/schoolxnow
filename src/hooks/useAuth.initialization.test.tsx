import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { phpApi } from "@/integrations/php-api/client";

vi.mock("@/integrations/backend/provider", () => ({
  isMysqlApi: true,
}));

vi.mock("@/integrations/php-api/client", () => ({
  phpApi: {
    tokenKey: "schoolxnow_test_token",
    me: vi.fn(),
  },
}));

vi.mock("@/integrations/php-api/api-client", () => ({
  apiClient: {},
}));

const AuthStateProbe = () => {
  const { loading, user, profileState } = useAuth();

  return (
    <div>
      {loading ? "loading" : "ready"}:{user ? "signed-in" : "signed-out"}:
      {profileState.status}
    </div>
  );
};

describe("AuthProvider initialization", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("settles logged-out MySQL sessions without an update loop", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    expect(
      await screen.findByText("ready:signed-out:idle"),
    ).toBeInTheDocument();
    expect(phpApi.me).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(
        consoleError.mock.calls.some(([message]) =>
          String(message).includes("Maximum update depth exceeded"),
        ),
      ).toBe(false);
    });

    consoleError.mockRestore();
  });
});
