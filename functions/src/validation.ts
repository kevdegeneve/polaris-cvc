import type { DiagnosticAIResult, DiagnosticCheck, ExpectedMeasurement, SourceReference, UserPreferredLanguage } from "./types.js";

const languages: UserPreferredLanguage[] = ["fr", "en", "de", "it", "es"];

export function isPreferredLanguage(value: unknown): value is UserPreferredLanguage {
  return typeof value === "string" && languages.includes(value as UserPreferredLanguage);
}

export function validateDiagnosticAIResult(value: unknown): DiagnosticAIResult {
  if (!isRecord(value)) throw new Error("invalid_result_object");
  const result: DiagnosticAIResult = {
    detectedBrand: nullableString(value.detectedBrand, "detectedBrand"),
    detectedModel: nullableString(value.detectedModel, "detectedModel"),
    detectedSerialNumber: nullableString(value.detectedSerialNumber, "detectedSerialNumber"),
    detectedEquipmentType: nullableString(value.detectedEquipmentType, "detectedEquipmentType"),
    detectedErrorCode: nullableString(value.detectedErrorCode, "detectedErrorCode"),
    plateExtractedText: stringArray(value.plateExtractedText, "plateExtractedText"),
    faultImageExtractedText: stringArray(value.faultImageExtractedText, "faultImageExtractedText"),
    faultDescription: nullableString(value.faultDescription, "faultDescription"),
    probableCauses: stringArray(value.probableCauses, "probableCauses"),
    recommendedChecks: checkArray(value.recommendedChecks),
    expectedMeasurements: measurementArray(value.expectedMeasurements),
    safetyWarnings: stringArray(value.safetyWarnings, "safetyWarnings"),
    suggestedSolutions: stringArray(value.suggestedSolutions, "suggestedSolutions"),
    missingInformation: stringArray(value.missingInformation, "missingInformation"),
    confidenceLevel: confidence(value.confidenceLevel),
    analysisLanguage: language(value.analysisLanguage),
    sourceReferences: sourceArray(value.sourceReferences),
    analyzedAt: requiredString(value.analyzedAt, "analyzedAt"),
    modelUsed: requiredString(value.modelUsed, "modelUsed"),
    promptVersion: requiredString(value.promptVersion, "promptVersion")
  };
  return result;
}

export function removeUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) return value.map(removeUndefinedFields).filter((item) => item !== undefined) as T;
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, removeUndefinedFields(item)] as const)
      .filter(([, item]) => item !== undefined)
  ) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`invalid_${field}`);
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value;
  throw new Error(`invalid_${field}`);
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new Error(`invalid_${field}`);
  return value;
}

function language(value: unknown): UserPreferredLanguage {
  if (!isPreferredLanguage(value)) throw new Error("invalid_analysisLanguage");
  return value;
}

function confidence(value: unknown): number {
  if (typeof value !== "number" || value < 0 || value > 1) throw new Error("invalid_confidenceLevel");
  return value;
}

function checkArray(value: unknown): DiagnosticCheck[] {
  if (!Array.isArray(value)) throw new Error("invalid_recommendedChecks");
  return value.map((item) => {
    if (!isRecord(item)) throw new Error("invalid_recommendedChecks");
    const safetyLevel = item.safetyLevel;
    if (!["low", "medium", "high"].includes(String(safetyLevel))) throw new Error("invalid_safetyLevel");
    if (typeof item.order !== "number") throw new Error("invalid_check_order");
    return {
      title: requiredString(item.title, "check_title"),
      instruction: requiredString(item.instruction, "check_instruction"),
      reason: requiredString(item.reason, "check_reason"),
      expectedResult: requiredString(item.expectedResult, "check_expectedResult"),
      safetyLevel: safetyLevel as DiagnosticCheck["safetyLevel"],
      order: item.order
    };
  });
}

function measurementArray(value: unknown): ExpectedMeasurement[] {
  if (!Array.isArray(value)) throw new Error("invalid_expectedMeasurements");
  return value.map((item) => {
    if (!isRecord(item)) throw new Error("invalid_expectedMeasurements");
    return {
      measurement: requiredString(item.measurement, "measurement"),
      location: requiredString(item.location, "location"),
      expectedValue: requiredString(item.expectedValue, "expectedValue"),
      unit: typeof item.unit === "string" ? item.unit : undefined,
      tolerance: typeof item.tolerance === "string" ? item.tolerance : undefined,
      conditions: typeof item.conditions === "string" ? item.conditions : undefined
    };
  });
}

function sourceArray(value: unknown): SourceReference[] {
  if (!Array.isArray(value)) throw new Error("invalid_sourceReferences");
  return value.map((item) => {
    if (!isRecord(item)) throw new Error("invalid_sourceReferences");
    return removeUndefinedFields({
      documentId: typeof item.documentId === "string" ? item.documentId : undefined,
      title: requiredString(item.title, "source_title"),
      manufacturer: typeof item.manufacturer === "string" ? item.manufacturer : undefined,
      originalLanguage: typeof item.originalLanguage === "string" ? item.originalLanguage : undefined,
      displayedLanguage: typeof item.displayedLanguage === "string" ? item.displayedLanguage : undefined,
      sourceUrl: typeof item.sourceUrl === "string" ? item.sourceUrl : undefined,
      documentReference: typeof item.documentReference === "string" ? item.documentReference : undefined,
      documentVersion: typeof item.documentVersion === "string" ? item.documentVersion : undefined,
      pagesUsed: Array.isArray(item.pagesUsed) ? stringArray(item.pagesUsed, "pagesUsed") : undefined,
      sectionsUsed: Array.isArray(item.sectionsUsed) ? stringArray(item.sectionsUsed, "sectionsUsed") : undefined,
      excerptsUsed: Array.isArray(item.excerptsUsed) ? stringArray(item.excerptsUsed, "excerptsUsed") : undefined,
      hash: typeof item.hash === "string" ? item.hash : undefined,
      verificationStatus: ["a_verifier", "verifie", "rejete"].includes(String(item.verificationStatus))
        ? (item.verificationStatus as SourceReference["verificationStatus"])
        : undefined
    });
  });
}
