import { InterventionDraft } from "./types";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const requiredFields: Array<[keyof InterventionDraft, string]> = [
  ["customerId", "client"],
  ["siteId", "site"],
  ["title", "titre"],
  ["customerRequest", "demande du client"],
  ["observedSymptom", "symptome constate"]
];

export function validateInterventionDraft(draft: InterventionDraft): ValidationResult {
  const errors = requiredFields
    .filter(([key]) => {
      const value = draft[key];
      return typeof value !== "string" || value.trim().length === 0;
    })
    .map(([, label]) => `Le champ ${label} est obligatoire.`);

  return { ok: errors.length === 0, errors };
}

export function makeSearchIndex(values: Array<string | undefined>): string {
  return values
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
