import { describe, expect, it } from "vitest";
import {
  canStartDiagnostic,
  createDiagnosticArchiveTitle,
  createDiagnosticDraft,
  dedupeDocumentKey,
  getDiagnosticStatus
} from "./diagnosticService";

describe("diagnosticService", () => {
  it("requires plate and fault photos before analysis", () => {
    expect(canStartDiagnostic([{ category: "plaque_signaletique" }])).toBe(false);
    expect(canStartDiagnostic([{ category: "code_erreur" }])).toBe(false);
    expect(canStartDiagnostic([{ category: "plaque_signaletique" }, { category: "code_erreur" }])).toBe(true);
  });

  it("keeps analysis blocked while one required photo is missing", () => {
    expect(getDiagnosticStatus([{ category: "plaque_signaletique" }])).toBe("draft");
    expect(getDiagnosticStatus([{ category: "plaque_signaletique" }, { category: "code_erreur" }])).toBe("ready_for_analysis");
    expect(getDiagnosticStatus([{ category: "plaque_signaletique" }, { category: "code_erreur" }], true)).toBe("analyzing");
  });

  it("does not require customer fields to create a diagnostic draft", () => {
    const draft = createDiagnosticDraft({
      companyId: "optima",
      technicianId: "uid-tech",
      technicianName: "Technicien",
      preferredLanguage: "fr"
    });

    expect(draft.technicianId).toBe("uid-tech");
    expect(draft.status).toBe("draft");
    expect("customerId" in draft).toBe(false);
  });

  it("generates automatic archive titles", () => {
    expect(createDiagnosticArchiveTitle({ brand: "Daikin", errorCode: "U4" })).toBe("Daikin - U4");
    expect(createDiagnosticArchiveTitle({ errorCode: "E6" })).toBe("Equipement non identifie - E6");
    expect(createDiagnosticArchiveTitle({ brand: "Carrier", shortFaultDescription: "Alarme pression basse" })).toBe(
      "Carrier - Alarme pression basse"
    );
  });

  it("builds a stable document deduplication key", () => {
    expect(
      dedupeDocumentKey({
        fileHash: "ABC",
        canonicalUrl: "https://example.test/doc.pdf",
        manufacturer: "Daikin",
        documentReference: "REF-1",
        language: "FR",
        version: "2026"
      })
    ).toBe("abc|https://example.test/doc.pdf|daikin|ref-1|fr|2026");
  });
});
