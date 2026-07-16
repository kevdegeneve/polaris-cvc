import { describe, expect, it } from "vitest";
import { validateInterventionDraft } from "./validation";
import type { InterventionDraft } from "./types";

const validDraft: InterventionDraft = {
  customerId: "customer-1",
  siteId: "site-1",
  equipmentId: "",
  title: "Defaut ventilation",
  requestedBy: "Client",
  customerRequest: "Verifier l'arret du rooftop.",
  observedSymptom: "Ventilateur condenseur a l'arret.",
  checksPerformed: "",
  measures: "",
  diagnosis: "",
  workDone: "",
  finalResult: "",
  recommendations: "",
  resultStatus: "a_surveiller",
  contentStatus: "brouillon"
};

describe("validateInterventionDraft", () => {
  it("accepts the minimum useful field set", () => {
    expect(validateInterventionDraft(validDraft).ok).toBe(true);
  });

  it("rejects a draft without customer and symptom", () => {
    const result = validateInterventionDraft({
      ...validDraft,
      customerId: "",
      observedSymptom: ""
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Le champ client est obligatoire.");
    expect(result.errors).toContain("Le champ symptome constate est obligatoire.");
  });
});
