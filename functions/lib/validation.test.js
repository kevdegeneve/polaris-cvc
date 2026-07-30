import { describe, expect, it } from "vitest";
import { buildArchiveTitle } from "./result.js";
import { removeUndefinedFields, validateDiagnosticAIResult, validateOpenAIDiagnosticPayload } from "./validation.js";
const validResult = {
    detectedBrand: null,
    detectedModel: null,
    detectedSerialNumber: null,
    detectedEquipmentType: null,
    detectedErrorCode: "E01",
    plateExtractedText: [],
    faultImageExtractedText: ["E01"],
    faultDescription: null,
    probableCauses: [],
    recommendedChecks: [],
    expectedMeasurements: [],
    safetyWarnings: [],
    suggestedSolutions: [],
    missingInformation: ["Plaque illisible"],
    confidenceLevel: 0.4,
    analysisLanguage: "fr",
    sourceReferences: [],
    analyzedAt: "2026-07-18T00:00:00.000Z",
    modelUsed: "gpt-4.1-mini",
    promptVersion: "1.0.0"
};
describe("diagnostic analysis validation", () => {
    it("validates strict OpenAI JSON without adding fake sources", () => {
        const result = validateDiagnosticAIResult(validResult);
        expect(result.detectedBrand).toBeNull();
        expect(result.sourceReferences).toEqual([]);
    });
    it("accepts OpenAI technical payload before server metadata is added", () => {
        const { analyzedAt: _analyzedAt, modelUsed: _modelUsed, promptVersion: _promptVersion, ...openAiPayload } = validResult;
        const result = validateOpenAIDiagnosticPayload(openAiPayload);
        expect(result.detectedErrorCode).toBe("E01");
        expect(result.sourceReferences).toEqual([]);
    });
    it("rejects invalid confidence values", () => {
        expect(() => validateDiagnosticAIResult({ ...validResult, confidenceLevel: 2 })).toThrow("invalid_confidenceLevel");
    });
    it("removes undefined before Firestore writes", () => {
        expect(removeUndefinedFields({ a: "ok", b: undefined, c: { d: undefined, e: "kept" } })).toEqual({ a: "ok", c: { e: "kept" } });
    });
    it("builds a clear automatic diagnostic title", () => {
        expect(buildArchiveTitle({ detectedBrand: "Daikin", detectedErrorCode: "U4", faultDescription: null })).toBe("Daikin - U4");
        expect(buildArchiveTitle({ detectedBrand: null, detectedErrorCode: null, faultDescription: null })).toBe("Diagnostic non identifie");
    });
});
