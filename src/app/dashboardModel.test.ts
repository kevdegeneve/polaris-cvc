import { describe, expect, it } from "vitest";
import { createEmptyData } from "../services/localRepository";
import { canAccessBusinessScreens } from "../services/authService";
import type { AppUser, Intervention } from "../domain/types";
import { buildDashboardStats, buildRecentActivity, ensureVisibleUsers, getNavigationItems, getProfileSummary, isAdminRole } from "./dashboardModel";

describe("dashboardModel", () => {
  it("shows users navigation for admins", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(getNavigationItems("admin").some((item) => item.id === "team")).toBe(true);
  });

  it("hides users navigation for technicians", () => {
    expect(isAdminRole("technician")).toBe(false);
    expect(getNavigationItems("technician").some((item) => item.id === "team")).toBe(false);
  });

  it("contains navigation entries for every main module", () => {
    const ids = getNavigationItems("admin").map((item) => item.id);

    expect(ids).toEqual(
      expect.arrayContaining(["home", "diagnosticNew", "diagnostics", "new", "interventions", "identifyEquipment", "documents", "team", "company"])
    );
  });

  it("builds dashboard indicators from repository data", () => {
    const data = createEmptyData("company-a");
    const user = createUser();
    data.users = [user];
    data.interventions = [createIntervention({ contentStatus: "termine", authorId: user.id })];
    const stats = buildDashboardStats(data, user.id);

    expect(stats.find((item) => item.label === "Interventions terminees")?.value).toBe(1);
    expect(stats.find((item) => item.label === "Documents techniques")?.value).toBe(0);
  });

  it("shows an empty recent activity state when no activity exists", () => {
    const data = createEmptyData("company-a");

    expect(buildRecentActivity(data, "user-1")).toHaveLength(0);
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

function createIntervention(overrides: Partial<Intervention> = {}): Intervention {
  return {
    id: "intervention-1",
    companyId: "company-a",
    number: "INT-1",
    customerId: "",
    siteId: "",
    authorId: "user-1",
    assignedTechnicianId: "user-1",
    title: "Intervention reelle",
    requestedBy: "",
    customerRequest: "",
    observedSymptom: "",
    checksPerformed: "",
    measures: "",
    diagnosis: "",
    workDone: "",
    finalResult: "",
    recommendations: "",
    resultStatus: "a_surveiller",
    contentStatus: "brouillon",
    startedAt: "2026-01-01T00:00:00.000Z",
    syncState: "synchronise",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}
