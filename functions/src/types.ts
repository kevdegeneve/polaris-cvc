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
  confidenceLevel: number;
  analysisLanguage: UserPreferredLanguage;
  sourceReferences: SourceReference[];
  analyzedAt: string;
  modelUsed: string;
  promptVersion: string;
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
