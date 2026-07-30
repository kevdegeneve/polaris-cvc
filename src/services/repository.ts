import {
  AppData,
  AppUser,
  ContentStatus,
  Diagnostic,
  DiagnosticMessage,
  DiagnosticPhoto,
  DocumentImportCandidate,
  InterventionDraft,
  TechnicalMemoryFeedback,
  TechnicalDocument
} from "../domain/types";
import { FirestoreRepository } from "./firestoreRepository";
import { createFirebaseServices } from "./firebaseClient";
import { LocalRepository } from "./localRepository";

export interface AppRepository {
  mode: "local" | "firestore";
  load(userId?: string): Promise<AppData>;
  createIntervention(data: AppData, draft: InterventionDraft, authorId: string): Promise<AppData>;
  updateInterventionStatus(data: AppData, interventionId: string, contentStatus: ContentStatus): Promise<AppData>;
  addMedia(data: AppData, interventionId: string, file: File, dataUrl: string): Promise<AppData>;
  addDocument(
    data: AppData,
    document: Omit<TechnicalDocument, "id" | "companyId" | "createdAt" | "updatedAt">
  ): Promise<AppData>;
  importDocumentCandidates(data: AppData, candidates: DocumentImportCandidate[], userId: string): Promise<AppData>;
  toggleDocumentFavorite(data: AppData, documentId: string, userId: string): Promise<AppData>;
  recordDocumentView(data: AppData, documentId: string, userId: string): Promise<AppData>;
  updateUserLanguage(data: AppData, userId: string, language: AppUser["preferredLanguage"], label: string): Promise<AppData>;
  saveDiagnostic(data: AppData, diagnostic: Diagnostic, photos: DiagnosticPhoto[], messages: DiagnosticMessage[]): Promise<AppData>;
  saveTechnicalMemoryFeedback(data: AppData, feedback: TechnicalMemoryFeedback): Promise<AppData>;
}

export function createAppRepository(userId?: string): AppRepository {
  const firebase = createFirebaseServices();
  if (firebase && userId) {
    return new FirestoreRepository(firebase.db);
  }
  return new LocalRepository();
}
