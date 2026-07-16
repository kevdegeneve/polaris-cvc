import { AppData, ContentStatus, InterventionDraft, TechnicalDocument } from "../domain/types";
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
}

export function createAppRepository(userId?: string): AppRepository {
  const firebase = createFirebaseServices();
  if (firebase && userId) {
    return new FirestoreRepository(firebase.db);
  }
  return new LocalRepository();
}
