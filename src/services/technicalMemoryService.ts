import type {
  Diagnostic,
  TechnicalMemoryAction,
  TechnicalMemoryActionStat,
  TechnicalMemoryCause,
  TechnicalMemoryCauseStat,
  TechnicalMemoryFeedback,
  TechnicalMemoryInsight,
  TechnicalMemoryRepairResult
} from "../domain/types";

export const technicalMemoryCauseOptions: Array<{ value: TechnicalMemoryCause; label: string }> = [
  { value: "sonde_defectueuse", label: "Sonde defectueuse" },
  { value: "carte_electronique_hs", label: "Carte electronique HS" },
  { value: "ventilateur_bloque", label: "Ventilateur bloque" },
  { value: "manque_de_fluide", label: "Manque de fluide" },
  { value: "fuite_detectee", label: "Fuite detectee" },
  { value: "connecteur_desserre", label: "Connecteur desserre" },
  { value: "mauvais_cablage", label: "Mauvais cablage" },
  { value: "parametrage", label: "Parametrage" },
  { value: "autre", label: "Autre" }
];

export const technicalMemoryActionOptions: Array<{ value: TechnicalMemoryAction; label: string }> = [
  { value: "remplacement_sonde", label: "Remplacement sonde" },
  { value: "remplacement_carte", label: "Remplacement carte" },
  { value: "ajout_fluide", label: "Ajout de fluide" },
  { value: "recherche_fuite", label: "Recherche de fuite" },
  { value: "remplacement_ventilateur", label: "Remplacement ventilateur" },
  { value: "nettoyage", label: "Nettoyage" },
  { value: "resserrage_connecteur", label: "Resserrage connecteur" },
  { value: "reparametrage", label: "Reparametrage" },
  { value: "autre", label: "Autre" }
];

export const technicalMemoryResultOptions: Array<{ value: TechnicalMemoryRepairResult; label: string }> = [
  { value: "repare", label: "Repare" },
  { value: "repare_partiellement", label: "Repare partiellement" },
  { value: "non_repare", label: "Non repare" }
];

export interface TechnicalMemoryFeedbackInput {
  actualCause: TechnicalMemoryCause;
  actualCauseOther?: string;
  actions: TechnicalMemoryAction[];
  actionOther?: string;
  repairResult: TechnicalMemoryRepairResult;
  timeSpentMinutes: number;
  comment?: string;
}

export function createTechnicalMemoryFeedback(input: {
  diagnostic: Diagnostic;
  technicianId: string;
  technicianName: string;
  feedback: TechnicalMemoryFeedbackInput;
}): TechnicalMemoryFeedback {
  const timestamp = new Date().toISOString();
  return {
    id: `technical-memory-${crypto.randomUUID()}`,
    companyId: input.diagnostic.companyId,
    diagnosticId: input.diagnostic.id,
    technicianId: input.technicianId,
    technicianName: input.technicianName,
    detectedBrand: input.diagnostic.detectedBrand,
    detectedModel: input.diagnostic.detectedModel,
    detectedEquipmentType: input.diagnostic.detectedEquipmentType,
    detectedErrorCode: input.diagnostic.detectedErrorCode,
    symptomSummary: input.diagnostic.shortFaultDescription || input.diagnostic.analysisSummary,
    aiProbableCauses: input.diagnostic.probableCauses,
    actualCause: input.feedback.actualCause,
    actualCauseOther: cleanOptional(input.feedback.actualCauseOther),
    actions: input.feedback.actions,
    actionOther: cleanOptional(input.feedback.actionOther),
    repairResult: input.feedback.repairResult,
    timeSpentMinutes: input.feedback.timeSpentMinutes,
    comment: cleanOptional(input.feedback.comment),
    sourceLinks: [],
    createdBy: input.technicianId,
    updatedBy: input.technicianId,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function validateTechnicalMemoryFeedbackInput(input: TechnicalMemoryFeedbackInput): string[] {
  const errors: string[] = [];
  if (!technicalMemoryCauseOptions.some((option) => option.value === input.actualCause)) errors.push("Cause reelle obligatoire.");
  if (input.actualCause === "autre" && !input.actualCauseOther?.trim()) errors.push("Precisez la cause reelle.");
  if (input.actions.length === 0) errors.push("Selectionnez au moins une action realisee.");
  if (input.actions.includes("autre") && !input.actionOther?.trim()) errors.push("Precisez l'action realisee.");
  if (!technicalMemoryResultOptions.some((option) => option.value === input.repairResult)) errors.push("Resultat obligatoire.");
  if (!Number.isFinite(input.timeSpentMinutes) || input.timeSpentMinutes <= 0) errors.push("Temps passe obligatoire.");
  return errors;
}

export function buildTechnicalMemoryInsight(input: {
  diagnostic: Diagnostic;
  feedbacks: TechnicalMemoryFeedback[];
}): TechnicalMemoryInsight {
  const similar = input.feedbacks.filter((feedback) => isSimilarMemoryCase(input.diagnostic, feedback));
  const repairedCount = similar.filter((feedback) => feedback.repairResult === "repare").length;
  const partiallyRepairedCount = similar.filter((feedback) => feedback.repairResult === "repare_partiellement").length;
  const unrepairedCount = similar.filter((feedback) => feedback.repairResult === "non_repare").length;
  const durations = similar.map((feedback) => feedback.timeSpentMinutes).filter((value) => Number.isFinite(value) && value > 0);

  return {
    totalKnownCases: similar.length,
    repairedCount,
    partiallyRepairedCount,
    unrepairedCount,
    successRate: similar.length ? Math.round(((repairedCount + partiallyRepairedCount) / similar.length) * 100) : 0,
    averageRepairTimeMinutes: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
    mostFrequentCause: countCauses(similar)[0] || null,
    causeStats: countCauses(similar),
    actionStats: countActions(similar)
  };
}

export function causeLabel(cause: TechnicalMemoryCause): string {
  return technicalMemoryCauseOptions.find((option) => option.value === cause)?.label || cause;
}

export function actionLabel(action: TechnicalMemoryAction): string {
  return technicalMemoryActionOptions.find((option) => option.value === action)?.label || action;
}

function isSimilarMemoryCase(diagnostic: Diagnostic, feedback: TechnicalMemoryFeedback): boolean {
  if (feedback.diagnosticId === diagnostic.id) return false;
  if (feedback.companyId !== diagnostic.companyId) return false;
  const score = [
    sameNormalized(feedback.detectedBrand, diagnostic.detectedBrand),
    sameNormalized(feedback.detectedModel, diagnostic.detectedModel),
    sameNormalized(feedback.detectedEquipmentType, diagnostic.detectedEquipmentType),
    sameNormalized(feedback.detectedErrorCode, diagnostic.detectedErrorCode),
    intersects(feedback.aiProbableCauses, diagnostic.probableCauses)
  ].filter(Boolean).length;
  return score >= 2 || Boolean(diagnostic.detectedErrorCode && sameNormalized(feedback.detectedErrorCode, diagnostic.detectedErrorCode));
}

function sameNormalized(left?: string, right?: string): boolean {
  return Boolean(left && right && normalize(left) === normalize(right));
}

function intersects(left: string[], right: string[]): boolean {
  const normalizedRight = new Set(right.map(normalize).filter(Boolean));
  return left.map(normalize).some((item) => normalizedRight.has(item));
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function cleanOptional(value?: string): string | undefined {
  const cleaned = value?.trim();
  return cleaned || undefined;
}

function countCauses(feedbacks: TechnicalMemoryFeedback[]): TechnicalMemoryCauseStat[] {
  const counts = new Map<TechnicalMemoryCause, number>();
  for (const feedback of feedbacks) counts.set(feedback.actualCause, (counts.get(feedback.actualCause) || 0) + 1);
  return Array.from(counts.entries())
    .map(([cause, count]) => ({ cause, label: causeLabel(cause), count }))
    .sort(sortByCountAndLabel);
}

function countActions(feedbacks: TechnicalMemoryFeedback[]): TechnicalMemoryActionStat[] {
  const counts = new Map<TechnicalMemoryAction, number>();
  for (const feedback of feedbacks) {
    for (const action of feedback.actions) counts.set(action, (counts.get(action) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([action, count]) => ({ action, label: actionLabel(action), count }))
    .sort(sortByCountAndLabel);
}

function sortByCountAndLabel<T extends { count: number; label: string }>(left: T, right: T): number {
  return right.count - left.count || left.label.localeCompare(right.label);
}
