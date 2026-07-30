import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore
} from "firebase/firestore";
import { assertCompanyAccess } from "../domain/companyAccess";
import {
  AppData,
  AppUser,
  Company,
  ContentStatus,
  Diagnostic,
  DiagnosticMessage,
  DiagnosticPhoto,
  DocumentImportCandidate,
  Intervention,
  InterventionDraft,
  TechnicalMemoryFeedback,
  TechnicalDocument
} from "../domain/types";
import type { AppRepository } from "./repository";
import { assertValidPreferredLanguage, removeUndefinedFields } from "./firestoreData";
import { createEmptyData, LocalRepository } from "./localRepository";

function now(): string {
  return new Date().toISOString();
}

function fromFirestore<T extends { id: string }>(idValue: string, value: Record<string, unknown>): T {
  return {
    ...value,
    id: idValue,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now()
  } as unknown as T;
}

export class FirestoreRepository implements AppRepository {
  mode = "firestore" as const;
  private local = new LocalRepository();

  constructor(private readonly db: Firestore) {}

  async load(userId?: string): Promise<AppData> {
    if (!userId) return this.local.load();

    const userSnap = await getDoc(doc(this.db, "users", userId));
    if (!userSnap.exists()) {
      throw new Error("Profil utilisateur introuvable dans Firestore.");
    }

    const user = fromFirestore<AppUser>(userSnap.id, userSnap.data());
    const companySnap = await getDoc(doc(this.db, "companies", user.companyId));
    const emptyData = createEmptyData(user.companyId, user.companyId);
    const company = companySnap.exists()
      ? fromFirestore<Company>(companySnap.id, companySnap.data())
      : {
          ...emptyData.company,
          id: user.companyId,
          name: user.companyId,
          updatedAt: now()
        };
    const users = await this.loadUsers(user.companyId);
    const interventions = await this.loadInterventions(user.companyId);
    const diagnostics = await this.loadDiagnostics(user.companyId);
    const diagnosticPhotos = await this.loadDiagnosticPhotos(user.companyId);
    const diagnosticMessages = await this.loadDiagnosticMessages(user.companyId);
    const technicalMemoryFeedbacks = await this.loadTechnicalMemoryFeedbacks(user.companyId);
    const localData = this.local.loadSync();

    return {
      ...emptyData,
      company,
      users,
      interventions,
      media: localData.media.filter((item) => item.companyId === user.companyId),
      equipmentIdentifications: localData.equipmentIdentifications.filter((item) => item.companyId === user.companyId),
      diagnostics,
      diagnosticPhotos,
      diagnosticMessages,
      diagnosticDocumentLinks: localData.diagnosticDocumentLinks.filter((item) => item.companyId === user.companyId),
      technicalMemoryFeedbacks,
      documents: localData.documents.filter((item) => item.companyId === user.companyId),
      documentLinks: localData.documentLinks.filter((item) => item.companyId === user.companyId),
      documentFavorites: localData.documentFavorites.filter((item) => item.companyId === user.companyId),
      documentRecentViews: localData.documentRecentViews.filter((item) => item.companyId === user.companyId),
      documentImportBatches: localData.documentImportBatches.filter((item) => item.companyId === user.companyId),
      documentImportCandidates: localData.documentImportCandidates.filter((item) => item.companyId === user.companyId),
      aiAnalyses: []
    };
  }

  async createIntervention(data: AppData, draft: InterventionDraft, authorId: string): Promise<AppData> {
    const author = data.users.find((item) => item.id === authorId);
    if (!author) throw new Error("Auteur introuvable.");
    assertCompanyAccess(author.companyId, { companyId: data.company.id });

    const timestamp = now();
    const ref = await addDoc(collection(this.db, "interventions"), removeUndefinedFields({
      ...draft,
      companyId: data.company.id,
      number: `INT-${new Date().getFullYear()}-${String(data.interventions.length + 1).padStart(4, "0")}`,
      authorId,
      assignedTechnicianId: authorId,
      startedAt: timestamp,
      syncState: navigator.onLine ? "synchronise" : "hors_ligne",
      createdAt: timestamp,
      updatedAt: timestamp,
      createdAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp()
    }));

    const intervention: Intervention = {
      ...draft,
      id: ref.id,
      companyId: data.company.id,
      number: `INT-${new Date().getFullYear()}-${String(data.interventions.length + 1).padStart(4, "0")}`,
      authorId,
      assignedTechnicianId: authorId,
      startedAt: timestamp,
      syncState: navigator.onLine ? "synchronise" : "hors_ligne",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    return {
      ...data,
      interventions: [intervention, ...data.interventions]
    };
  }

  async updateInterventionStatus(data: AppData, interventionId: string, contentStatus: ContentStatus): Promise<AppData> {
    const intervention = data.interventions.find((item) => item.id === interventionId);
    if (!intervention) return data;
    assertCompanyAccess(data.company.id, intervention);

    const timestamp = now();
    await updateDoc(doc(this.db, "interventions", interventionId), removeUndefinedFields({
      contentStatus,
      completedAt: contentStatus === "termine" ? timestamp : intervention.completedAt,
      updatedAt: timestamp,
      updatedAtServer: serverTimestamp()
    }));

    return {
      ...data,
      interventions: data.interventions.map((item) =>
        item.id === interventionId
          ? {
              ...item,
              contentStatus,
              completedAt: contentStatus === "termine" ? timestamp : item.completedAt,
              updatedAt: timestamp
            }
          : item
      )
    };
  }

  async addMedia(data: AppData, interventionId: string, file: File, dataUrl: string): Promise<AppData> {
    return this.local.addMedia(data, interventionId, file, dataUrl);
  }

  async addDocument(
    data: AppData,
    document: Omit<TechnicalDocument, "id" | "companyId" | "createdAt" | "updatedAt">
  ): Promise<AppData> {
    return this.local.addDocument(data, document);
  }

  async importDocumentCandidates(data: AppData, candidates: DocumentImportCandidate[], userId: string): Promise<AppData> {
    return this.local.importDocumentCandidates(data, candidates, userId);
  }

  async toggleDocumentFavorite(data: AppData, documentId: string, userId: string): Promise<AppData> {
    return this.local.toggleDocumentFavorite(data, documentId, userId);
  }

  async recordDocumentView(data: AppData, documentId: string, userId: string): Promise<AppData> {
    return this.local.recordDocumentView(data, documentId, userId);
  }

  async updateUserLanguage(data: AppData, userId: string, language: AppUser["preferredLanguage"], label: string): Promise<AppData> {
    assertValidPreferredLanguage(language);
    const timestamp = now();
    await updateDoc(doc(this.db, "users", userId), removeUndefinedFields({
      preferredLanguage: language,
      preferredLanguageLabel: label,
      languageConfiguredAt: timestamp,
      updatedAt: timestamp
    }));
    return this.local.updateUserLanguage(data, userId, language, label);
  }

  async saveDiagnostic(data: AppData, diagnostic: Diagnostic, photos: DiagnosticPhoto[], messages: DiagnosticMessage[]): Promise<AppData> {
    await setDoc(doc(this.db, "diagnostics", diagnostic.id), removeUndefinedFields(diagnostic), { merge: true });
    await Promise.all([
      ...photos.map((photo) => setDoc(doc(this.db, "diagnosticPhotos", photo.id), removeUndefinedFields(photo), { merge: true })),
      ...messages.map((message) => setDoc(doc(this.db, "diagnosticMessages", message.id), removeUndefinedFields(message), { merge: true }))
    ]);

    return {
      ...data,
      diagnostics: [diagnostic, ...data.diagnostics.filter((item) => item.id !== diagnostic.id)],
      diagnosticPhotos: [...photos, ...data.diagnosticPhotos.filter((item) => item.diagnosticId !== diagnostic.id)],
      diagnosticMessages: [...messages, ...data.diagnosticMessages.filter((item) => item.diagnosticId !== diagnostic.id)]
    };
  }

  async saveTechnicalMemoryFeedback(data: AppData, feedback: TechnicalMemoryFeedback): Promise<AppData> {
    await setDoc(doc(this.db, "technicalMemoryFeedbacks", feedback.id), removeUndefinedFields(feedback), { merge: true });

    return {
      ...data,
      technicalMemoryFeedbacks: [
        feedback,
        ...data.technicalMemoryFeedbacks.filter((item) => item.diagnosticId !== feedback.diagnosticId)
      ]
    };
  }

  async ensureUserProfile(user: AppUser, company: Company): Promise<void> {
    assertCompanyAccess(user.companyId, { companyId: company.id });
    await setDoc(doc(this.db, "companies", company.id), removeUndefinedFields(company), { merge: true });
    await setDoc(doc(this.db, "users", user.id), removeUndefinedFields(user), { merge: true });
  }

  private async loadUsers(companyId: string): Promise<AppUser[]> {
    const snapshot = await getDocs(query(collection(this.db, "users"), where("companyId", "==", companyId), limit(100)));
    return snapshot.docs.map((item) => fromFirestore<AppUser>(item.id, item.data()));
  }

  private async loadInterventions(companyId: string): Promise<Intervention[]> {
    const snapshot = await getDocs(
      query(collection(this.db, "interventions"), where("companyId", "==", companyId), orderBy("createdAt", "desc"), limit(100))
    );
    return snapshot.docs.map((item) => fromFirestore<Intervention>(item.id, item.data()));
  }

  private async loadDiagnostics(companyId: string): Promise<Diagnostic[]> {
    const snapshot = await getDocs(
      query(collection(this.db, "diagnostics"), where("companyId", "==", companyId), orderBy("createdAt", "desc"), limit(100))
    );
    return snapshot.docs.map((item) => fromFirestore<Diagnostic>(item.id, item.data()));
  }

  private async loadDiagnosticPhotos(companyId: string): Promise<DiagnosticPhoto[]> {
    const snapshot = await getDocs(query(collection(this.db, "diagnosticPhotos"), where("companyId", "==", companyId), limit(300)));
    return snapshot.docs.map((item) => fromFirestore<DiagnosticPhoto>(item.id, item.data()));
  }

  private async loadDiagnosticMessages(companyId: string): Promise<DiagnosticMessage[]> {
    const snapshot = await getDocs(query(collection(this.db, "diagnosticMessages"), where("companyId", "==", companyId), limit(300)));
    return snapshot.docs.map((item) => fromFirestore<DiagnosticMessage>(item.id, item.data()));
  }

  private async loadTechnicalMemoryFeedbacks(companyId: string): Promise<TechnicalMemoryFeedback[]> {
    const snapshot = await getDocs(
      query(collection(this.db, "technicalMemoryFeedbacks"), where("companyId", "==", companyId), orderBy("createdAt", "desc"), limit(500))
    );
    return snapshot.docs.map((item) => fromFirestore<TechnicalMemoryFeedback>(item.id, item.data()));
  }
}
