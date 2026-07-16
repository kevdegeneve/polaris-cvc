import { CompanyScoped } from "./types";

export function hasCompanyAccess(userCompanyId: string | undefined, entityCompanyId: string | undefined): boolean {
  return Boolean(userCompanyId && entityCompanyId && userCompanyId === entityCompanyId);
}

export function assertCompanyAccess(userCompanyId: string, entity: Pick<CompanyScoped, "companyId">): void {
  if (!hasCompanyAccess(userCompanyId, entity.companyId)) {
    throw new Error("Acces refuse: donnees hors entreprise.");
  }
}

export function assertCompanyIdUnchanged(beforeCompanyId: string, afterCompanyId: string): void {
  if (beforeCompanyId !== afterCompanyId) {
    throw new Error("Modification du companyId interdite.");
  }
}
