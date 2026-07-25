import type { AppData, AppUser } from "../domain/types";

export type DashboardView =
  | "home"
  | "diagnosticNew"
  | "diagnostics"
  | "new"
  | "interventions"
  | "identifyEquipment"
  | "documents"
  | "team"
  | "company";

export interface NavigationItem {
  id: DashboardView;
  label: string;
  description: string;
  adminOnly?: boolean;
}

export interface DashboardStat {
  label: string;
  value: number;
}

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
}

export function isAdminRole(role?: string): boolean {
  return role === "admin" || role === "administrateur";
}

export function getNavigationItems(role?: string): NavigationItem[] {
  const items: NavigationItem[] = [
    { id: "home", label: "Tableau de bord", description: "Vue generale de l'activite" },
    { id: "diagnosticNew", label: "Diagnostic", description: "Deux photos, analyse assistee" },
    { id: "diagnostics", label: "Archives diagnostics", description: "Diagnostics termines et classes" },
    { id: "new", label: "Nouvelle intervention", description: "Creer un rapport classique" },
    { id: "interventions", label: "Mes interventions", description: "Suivre les interventions" },
    { id: "identifyEquipment", label: "Identifier un equipement", description: "Photo de plaque signaletique" },
    { id: "documents", label: "Bibliotheque technique", description: "Notices et documents CVC" },
    { id: "team", label: "Utilisateurs", description: "Gerer les acces", adminOnly: true },
    { id: "company", label: "Parametres", description: "Entreprise et configuration" }
  ];
  return items.filter((item) => !item.adminOnly || isAdminRole(role));
}

export function buildDashboardStats(data: AppData, userId: string): DashboardStat[] {
  return [
    {
      label: "Interventions ouvertes",
      value: data.interventions.filter((item) => item.contentStatus !== "termine").length
    },
    {
      label: "Interventions terminees",
      value: data.interventions.filter((item) => item.contentStatus === "termine").length
    },
    {
      label: "Equipements identifies",
      value: data.equipmentIdentifications.length
    },
    {
      label: "Documents techniques",
      value: data.documents.length
    },
    {
      label: "Favoris",
      value: data.documentFavorites.filter((item) => item.userId === userId).length
    },
    {
      label: "Activite recente",
      value: buildRecentActivity(data, userId).length
    }
  ];
}

export function buildRecentActivity(data: AppData, userId: string): ActivityItem[] {
  const activity: ActivityItem[] = [];
  const latestIntervention = [...data.interventions].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const latestDocumentView = [...data.documentRecentViews]
    .filter((item) => item.userId === userId)
    .sort((left, right) => right.viewedAt.localeCompare(left.viewedAt))[0];
  const latestIdentification = [...data.equipmentIdentifications].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  if (latestIntervention) {
    activity.push({
      id: `intervention-${latestIntervention.id}`,
      title: "Derniere intervention creee",
      detail: `${latestIntervention.number} - ${latestIntervention.title}`
    });
  }

  if (latestDocumentView) {
    const document = data.documents.find((item) => item.id === latestDocumentView.documentId);
    activity.push({
      id: `document-${latestDocumentView.id}`,
      title: "Dernier document consulte",
      detail: document?.title || "Document technique"
    });
  }

  if (latestIdentification) {
    activity.push({
      id: `identification-${latestIdentification.id}`,
      title: "Dernier equipement identifie",
      detail: [latestIdentification.manufacturer, latestIdentification.model].filter(Boolean).join(" ") || "Identification enregistree"
    });
  }

  const currentUser = data.users.find((item) => item.id === userId);
  if (currentUser?.lastLoginAt) {
    activity.push({
      id: `login-${currentUser.id}`,
      title: "Derniere connexion",
      detail: new Date(currentUser.lastLoginAt).toLocaleString("fr-FR")
    });
  }

  return activity;
}

export function getProfileSummary(user: AppUser): string {
  return `${user.email} - ${user.companyId} - ${user.role}`;
}

export function ensureVisibleUsers(users: AppUser[], currentUser: AppUser): AppUser[] {
  if (!currentUser.id) return users;
  if (users.some((user) => user.id === currentUser.id)) return users;
  return [currentUser, ...users];
}
