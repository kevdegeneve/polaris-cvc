import { describe, expect, it } from "vitest";
import type { Diagnostic, TechnicalMemoryFeedback } from "../domain/types";
import {
  buildTechnicalMemoryInsight,
  createTechnicalMemoryFeedback,
  validateTechnicalMemoryFeedbackInput
} from "./technicalMemoryService";

describe("technicalMemoryService", () => {
  it("creates a separate field feedback without changing the AI diagnostic", () => {
    const diagnostic = createDiagnostic();
    const feedback = createTechnicalMemoryFeedback({
      diagnostic,
      technicianId: "tech-1",
      technicianName: "Technicien reel",
      feedback: {
        actualCause: "sonde_defectueuse",
        actions: ["remplacement_sonde"],
        repairResult: "repare",
        timeSpentMinutes: 45,
        comment: "Sonde remplacee."
      }
    });

    expect(feedback.diagnosticId).toBe(diagnostic.id);
    expect(feedback.id).toBe(`technical-memory-${diagnostic.id}`);
    expect(feedback.actualCause).toBe("sonde_defectueuse");
    expect(feedback.comment).toBe("Sonde remplacee.");
    expect(diagnostic.analysisResult?.detectedBrand).toBe("Daikin");
  });

  it("validates required field feedback fields", () => {
    expect(
      validateTechnicalMemoryFeedbackInput({
        actualCause: "autre",
        actions: [],
        repairResult: "repare",
        timeSpentMinutes: 0
      })
    ).toEqual(["Precisez la cause reelle.", "Selectionnez au moins une action realisee.", "Temps passe obligatoire."]);
  });

  it("limits free text before storage", () => {
    const longText = "x".repeat(1300);
    const errors = validateTechnicalMemoryFeedbackInput({
      actualCause: "autre",
      actualCauseOther: "x".repeat(200),
      actions: ["autre"],
      actionOther: "x".repeat(200),
      repairResult: "repare",
      timeSpentMinutes: 30,
      comment: longText
    });

    expect(errors).toContain("Cause libre limitee a 160 caracteres.");
    expect(errors).toContain("Action libre limitee a 160 caracteres.");
    expect(errors).toContain("Commentaire limite a 1200 caracteres.");
  });

  it("aggregates only similar known cases", () => {
    const diagnostic = createDiagnostic({ id: "diagnostic-current" });
    const insight = buildTechnicalMemoryInsight({
      diagnostic,
      feedbacks: [
        createFeedback({ id: "case-1", diagnosticId: "old-1", detectedBrand: "Daikin", detectedModel: "RXM", actualCause: "sonde_defectueuse", actions: ["remplacement_sonde"], repairResult: "repare", timeSpentMinutes: 40 }),
        createFeedback({ id: "case-2", diagnosticId: "old-2", detectedBrand: "Daikin", detectedErrorCode: "U4", actualCause: "carte_electronique_hs", actions: ["remplacement_carte"], repairResult: "repare_partiellement", timeSpentMinutes: 90 }),
        createFeedback({ id: "case-3", diagnosticId: "old-3", detectedBrand: "Carrier", detectedModel: "AquaSnap", detectedErrorCode: "E99", aiProbableCauses: ["Fuite"], actualCause: "fuite_detectee", actions: ["recherche_fuite"], repairResult: "non_repare", timeSpentMinutes: 120 })
      ]
    });

    expect(insight.totalKnownCases).toBe(2);
    expect(insight.mostFrequentCause?.count).toBe(1);
    expect(insight.successRate).toBe(100);
    expect(insight.averageRepairTimeMinutes).toBe(65);
  });
});

function createDiagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    id: "diagnostic-1",
    companyId: "optima",
    title: "Daikin U4",
    detectedBrand: "Daikin",
    detectedModel: "RXM",
    detectedEquipmentType: "PAC",
    detectedErrorCode: "U4",
    shortFaultDescription: "Defaut communication",
    status: "awaiting_technician_input",
    technicianId: "tech-1",
    technicianName: "Technicien reel",
    preferredLanguage: "fr",
    photoIds: [],
    messageCount: 0,
    documentIds: [],
    sourceReferences: [],
    probableCauses: ["Sonde", "Carte"],
    performedChecks: [],
    measurements: [],
    proposedSolutions: [],
    safetyWarnings: [],
    analysisResult: {
      detectedBrand: "Daikin",
      detectedModel: "RXM",
      detectedSerialNumber: null,
      detectedEquipmentType: "PAC",
      detectedErrorCode: "U4",
      plateExtractedText: [],
      faultImageExtractedText: [],
      faultDescription: "Defaut communication",
      probableCauses: ["Sonde", "Carte"],
      recommendedChecks: [],
      expectedMeasurements: [],
      safetyWarnings: [],
      suggestedSolutions: [],
      missingInformation: [],
      recommendedAdditionalPhotos: [],
      needsMoreInformation: false,
      confidenceLevel: 0.7,
      analysisLanguage: "fr",
      sourceReferences: [],
      analyzedAt: "2026-01-01T00:00:00.000Z",
      modelUsed: "gpt-4.1-mini",
      promptVersion: "1.0.0"
    },
    createdBy: "tech-1",
    updatedBy: "tech-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function createFeedback(overrides: Partial<TechnicalMemoryFeedback>): TechnicalMemoryFeedback {
  return {
    id: "case",
    companyId: "optima",
    diagnosticId: "old",
    technicianId: "tech-1",
    technicianName: "Technicien reel",
    detectedBrand: "Daikin",
    detectedModel: "RXM",
    detectedEquipmentType: "PAC",
    detectedErrorCode: "U4",
    symptomSummary: "Defaut communication",
    aiProbableCauses: ["Sonde"],
    actualCause: "sonde_defectueuse",
    actions: ["remplacement_sonde"],
    repairResult: "repare",
    timeSpentMinutes: 45,
    sourceLinks: [],
    createdBy: "tech-1",
    updatedBy: "tech-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}
