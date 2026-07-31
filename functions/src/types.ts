export type UserPreferredLanguage = "fr" | "en" | "de" | "it" | "es";

export interface DiagnosticCheck {
  title: string;
  instruction: string;
  reason: string;
  expectedResult: string;
  safetyLevel: "low" | "medium" | "high";
  order: number;
}

export interface ExpectedMeasurement {
  measurement: string;
  location: string;
  expectedValue: string;
  unit?: string;
  tolerance?: string;
  conditions?: string;
}

export interface SourceReference {
  documentId?: string;
  title: string;
  manufacturer?: string;
  originalLanguage?: string;
  displayedLanguage?: string;
  sourceUrl?: string;
  documentReference?: string;
  documentVersion?: string;
  pagesUsed?: string[];
  sectionsUsed?: string[];
  excerptsUsed?: string[];
  hash?: string;
  verificationStatus?: "a_verifier" | "verifie" | "rejete";
}

export interface DiagnosticAIResult {
  detectedBrand: string | null;
  detectedModel: string | null;
  detectedSerialNumber: string | null;
  detectedEquipmentType: string | null;
  detectedErrorCode: string | null;
  plateExtractedText: string[];
  faultImageExtractedText: string[];
  faultDescription: string | null;
  probableCauses: string[];
  recommendedChecks: DiagnosticCheck[];
  expectedMeasurements: ExpectedMeasurement[];
  safetyWarnings: string[];
  suggestedSolutions: string[];
  missingInformation: string[];
  recommendedAdditionalPhotos: string[];
  needsMoreInformation: boolean;
  confidenceLevel: number;
  analysisLanguage: UserPreferredLanguage;
  sourceReferences: SourceReference[];
  analyzedAt: string;
  modelUsed: string;
  promptVersion: string;
}

export type OpenAIDiagnosticPayload = Omit<DiagnosticAIResult, "analyzedAt" | "modelUsed" | "promptVersion">;

export interface TechnicalMemoryFeedbackRecord {
  id: string;
  companyId: string;
  diagnosticId: string;
  detectedBrand?: string;
  detectedModel?: string;
  detectedEquipmentType?: string;
  detectedErrorCode?: string;
  symptomSummary?: string;
  aiProbableCauses: string[];
  actualCause: string;
  actions: string[];
  repairResult: "repare" | "repare_partiellement" | "non_repare";
  timeSpentMinutes: number;
}

export interface TechnicalMemoryInsight {
  totalKnownCases: number;
  repairedCount: number;
  partiallyRepairedCount: number;
  unrepairedCount: number;
  successRate: number;
  averageRepairTimeMinutes: number | null;
  mostFrequentCause: { cause: string; label: string; count: number } | null;
  causeStats: Array<{ cause: string; label: string; count: number }>;
  actionStats: Array<{ action: string; label: string; count: number }>;
}

export interface DiagnosticPhotoRecord {
  id: string;
  diagnosticId: string;
  storagePath: string;
  mimeType: string;
  category: string;
  size: number;
}

export interface DiagnosticRecord {
  id: string;
  companyId: string;
  status: string;
  technicianId: string;
  photoIds: string[];
  analysisAttemptCount?: number;
  analyzedPhotoSignature?: string;
}

export interface UserProfileRecord {
  uid: string;
  emailNormalized: string;
  companyId: string;
  role: string;
  isActive: boolean;
  preferredLanguage?: UserPreferredLanguage;
}
