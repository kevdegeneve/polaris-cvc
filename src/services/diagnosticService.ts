import type {
  Diagnostic,
  DiagnosticMessage,
  DiagnosticPhoto,
  DiagnosticPhotoCategory,
  DiagnosticStatus,
  SourceReference,
  UserPreferredLanguage
} from "../domain/types";

export interface DiagnosticPhotoInput {
  file: File;
  category: DiagnosticPhotoCategory;
}

export function canStartDiagnostic(photos: Array<{ category: DiagnosticPhotoCategory }>): boolean {
  return photos.length > 0;
}

export function getDiagnosticStatus(photos: Array<{ category: DiagnosticPhotoCategory }>, isAnalyzing = false): DiagnosticStatus {
  if (isAnalyzing) return "analyzing";
  return canStartDiagnostic(photos) ? "ready_for_analysis" : "draft";
}

export function buildDiagnosticStoragePath(diagnosticId: string, photoId: string, fileName: string): string {
  const extension = fileName.toLowerCase().match(/\.(jpe?g|png|webp)$/)?.[1] || "jpg";
  const normalizedExtension = extension === "jpeg" ? "jpg" : extension;
  return `diagnostics/${diagnosticId}/photos/${photoId}.${normalizedExtension}`;
}

export function createDiagnosticArchiveTitle(input: {
  brand?: string;
  errorCode?: string;
  shortFaultDescription?: string;
}): string {
  const brand = input.brand?.trim() || "Equipement non identifie";
  if (input.errorCode?.trim()) return `${brand} - ${input.errorCode.trim()}`;
  return `${brand} - ${input.shortFaultDescription?.trim() || "Diagnostic terrain"}`;
}

export function createDiagnosticDraft(input: {
  companyId: string;
  technicianId: string;
  technicianName: string;
  preferredLanguage: UserPreferredLanguage;
}): Diagnostic {
  const timestamp = new Date().toISOString();
  return {
    id: `diagnostic-${crypto.randomUUID()}`,
    companyId: input.companyId,
    title: "Diagnostic terrain",
    status: "draft",
    technicianId: input.technicianId,
    technicianName: input.technicianName,
    preferredLanguage: input.preferredLanguage,
    photoIds: [],
    messageCount: 0,
    documentIds: [],
    sourceReferences: [],
    probableCauses: [],
    performedChecks: [],
    measurements: [],
    proposedSolutions: [],
    safetyWarnings: [],
    createdBy: input.technicianId,
    updatedBy: input.technicianId,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function createDiagnosticPhoto(input: {
  diagnosticId: string;
  companyId: string;
  file: File;
  category: DiagnosticPhotoCategory;
  uploadedBy: string;
}): DiagnosticPhoto {
  const timestamp = new Date().toISOString();
  const id = `diagnostic-photo-${crypto.randomUUID()}`;
  return {
    id,
    companyId: input.companyId,
    diagnosticId: input.diagnosticId,
    storagePath: buildDiagnosticStoragePath(input.diagnosticId, id, input.file.name),
    originalFileName: input.file.name,
    mimeType: input.file.type || "application/octet-stream",
    size: input.file.size,
    category: input.category,
    categoryDetectedByAI: false,
    uploadedBy: input.uploadedBy,
    uploadedAt: timestamp,
    analysisStatus: "pending",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function createSystemDiagnosticMessage(input: {
  diagnosticId: string;
  companyId: string;
  language: UserPreferredLanguage;
  createdBy: string;
  content: string;
  sourceReferences?: SourceReference[];
}): DiagnosticMessage {
  const timestamp = new Date().toISOString();
  return {
    id: `diagnostic-message-${crypto.randomUUID()}`,
    companyId: input.companyId,
    diagnosticId: input.diagnosticId,
    role: "system",
    content: input.content,
    language: input.language,
    photoIds: [],
    documentIds: [],
    sourceReferences: input.sourceReferences || [],
    createdBy: input.createdBy,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function dedupeDocumentKey(input: {
  fileHash?: string;
  canonicalUrl?: string;
  manufacturer?: string;
  documentReference?: string;
  language?: string;
  version?: string;
  publicationDate?: string;
}): string {
  return [
    input.fileHash,
    input.canonicalUrl,
    input.manufacturer,
    input.documentReference,
    input.language,
    input.version,
    input.publicationDate
  ]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
}
