import type { AppUser } from "../domain/types";

export type DashboardView =
  | "diagnosticNew"
  | "documents"
  | "diagnostics"
  | "company";

export interface NavigationItem {
  id: DashboardView;
  label: string;
  description: string;
  adminOnly?: boolean;
}

export function isAdminRole(role?: string): boolean {
  return role === "admin" || role === "administrateur";
}

export function getNavigationItems(_role?: string): NavigationItem[] {
  return [
    { id: "diagnosticNew", label: "Diagnostic", description: "Deux photos, analyse assistee" },
    { id: "documents", label: "Bibliotheque technique", description: "Notices et documents CVC" },
    { id: "diagnostics", label: "Archives", description: "Diagnostics termines et classes" },
    { id: "company", label: "Parametres", description: "Entreprise et configuration" }
  ];
}

export function getProfileSummary(user: AppUser): string {
  return `${user.email} - ${user.companyId} - ${user.role}`;
}

export function ensureVisibleUsers(users: AppUser[], currentUser: AppUser): AppUser[] {
  if (!currentUser.id) return users;
  if (users.some((user) => user.id === currentUser.id)) return users;
  return [currentUser, ...users];
}
