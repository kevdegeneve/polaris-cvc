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
  Intervention,
  InterventionDraft,
  TechnicalDocument
} from "../domain/types";
import type { AppRepository } from "./repository";
import { createSeedData, LocalRepository } from "./localRepository";

function now(): string {
  return new Date().toISOString();
}

function fromFirestore<T extends { id: string }>(idValue: string, value: Record<string, unknown>): T {
  return {
    ...value,
    id: idValue,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now(),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now()
  } as T;
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
    if (!companySnap.exists()) {
      throw new Error("Entreprise introuvable dans Firestore.");
    }

    const company = fromFirestore<Company>(companySnap.id, companySnap.data());
    const users = await this.loadUsers(user.companyId);
    const interventions = await this.loadInterventions(user.companyId);
    const seed = createSeedData();

    return {
      ...seed,
      company,
      users,
      interventions,
      media: this.local.loadSync().media.filter((item) => item.companyId === user.companyId),
      documents: seed.documents.map((item) => ({ ...item, companyId: user.companyId })),
      aiAnalyses: seed.aiAnalyses.map((item) => ({ ...item, companyId: user.companyId }))
    };
  }

  async createIntervention(data: AppData, draft: InterventionDraft, authorId: string): Promise<AppData> {
    const author = data.users.find((item) => item.id === authorId);
    if (!author) throw new Error("Auteur introuvable.");
    assertCompanyAccess(author.companyId, { companyId: data.company.id });

    const timestamp = now();
    const ref = await addDoc(collection(this.db, "interventions"), {
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
    });

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
    await updateDoc(doc(this.db, "interventions", interventionId), {
      contentStatus,
      completedAt: contentStatus === "termine" ? timestamp : intervention.completedAt,
      updatedAt: timestamp,
      updatedAtServer: serverTimestamp()
    });

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

  async ensureUserProfile(user: AppUser, company: Company): Promise<void> {
    assertCompanyAccess(user.companyId, { companyId: company.id });
    await setDoc(doc(this.db, "companies", company.id), company, { merge: true });
    await setDoc(doc(this.db, "users", user.id), user, { merge: true });
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
}
