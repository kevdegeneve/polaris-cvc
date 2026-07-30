import { describe, expect, it } from "vitest";
import { canAccessBusinessScreens } from "../services/authService";
import type { AppUser } from "../domain/types";
import { ensureVisibleUsers, getNavigationItems, getProfileSummary, isAdminRole } from "./dashboardModel";

describe("dashboardModel", () => {
  it("keeps admin role detection without adding admin navigation", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(getNavigationItems("admin").map((item) => item.id)).toEqual(["diagnosticNew", "documents", "diagnostics", "company"]);
  });

  it("keeps technician navigation focused on the four product modules", () => {
    expect(isAdminRole("technician")).toBe(false);
    expect(getNavigationItems("technician").map((item) => item.id)).toEqual(["diagnosticNew", "documents", "diagnostics", "company"]);
  });

  it("keeps unauthenticated users blocked", () => {
    expect(canAccessBusinessScreens(null)).toBe(false);
  });

  it("exposes connected user profile details", () => {
    const user = createUser({ companyId: "optima", role: "admin" });
    const summary = getProfileSummary(user);

    expect(summary).toContain(user.email);
    expect(summary).toContain("optima");
    expect(summary).toContain("admin");
  });

  it("keeps the real connected user visible without creating extra users", () => {
    const currentUser = createUser({ id: "admin-1", email: "admin@example.com", role: "admin" });

    expect(ensureVisibleUsers([], currentUser)).toEqual([currentUser]);
    expect(ensureVisibleUsers([currentUser], currentUser)).toEqual([currentUser]);
  });
});

function createUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "user-1",
    companyId: "company-a",
    displayName: "Utilisateur Reel",
    email: "user@example.com",
    role: "technician",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}
