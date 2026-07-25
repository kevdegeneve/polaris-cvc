import type { DiagnosticAIResult } from "./types.js";

export function buildArchiveTitle(result: Pick<DiagnosticAIResult, "detectedBrand" | "detectedErrorCode" | "faultDescription">): string {
  const brand = result.detectedBrand || "Equipement non identifie";
  if (result.detectedErrorCode) return `${brand} - ${result.detectedErrorCode}`;
  if (result.faultDescription) return `${brand} - ${result.faultDescription.slice(0, 80)}`;
  return "Diagnostic non identifie";
}
