import { describe, expect, it } from "vitest";
import {
  canStartDiagnostic,
  createDiagnosticArchiveTitle,
  createDiagnosticDraft,
  createDiagnosticLaunchError,
  dedupeDocumentKey,
  getDiagnosticStatus
} from "./diagnosticService";

describe("diagnosticService", () => {
  it("allows analysis as soon as one photo is available", () => {
    expect(canStartDiagnostic([])).toBe(false);
    expect(canStartDiagnostic([{ category: "plaque_signaletique" }])).toBe(true);
    expect(canStartDiagnostic([{ category: "code_erreur" }])).toBe(true);
    expect(canStartDiagnostic([{ category: "autre" }])).toBe(true);
    expect(canStartDiagnostic([{ category: "plaque_signaletique" }, { category: "code_erreur" }])).toBe(true);
  });

  it("keeps analysis blocked only while no photo is available", () => {
    expect(getDiagnosticStatus([])).toBe("draft");
    expect(getDiagnosticStatus([{ category: "plaque_signaletique" }])).toBe("ready_for_analysis");
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

  it("preserves Firebase Storage error details", () => {
    const error = createDiagnosticLaunchError("storage_upload_started", {
      code: "storage/unauthorized",
      message: "User does not have permission.",
      serverResponse: "{\"error\":{\"code\":403}}"
    });

    expect(error).toMatchObject({
      stage: "storage_upload_started",
      code: "storage/unauthorized",
      message: "User does not have permission.",
      serverResponse: "{\"error\":{\"code\":403}}"
    });
  });
});
