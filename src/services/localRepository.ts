import {
  AppData,
  ContentStatus,
  DocumentFavorite,
  DocumentImportBatch,
  DocumentImportCandidate,
  DocumentRecentView,
  Intervention,
  InterventionDraft,
  MediaItem,
  TechnicalDocument
} from "../domain/types";
import { buildDocumentSearchIndex } from "./documentLibraryService";
import type { AppRepository } from "./repository";

const STORAGE_KEY = "polaris-cvc-demo-data";
const COMPANY_ID = "company-polaris-demo";
const TECH_ID = "user-mila";

function now(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createSeedData(): AppData {
  const timestamp = now();
  return {
    company: {
      id: COMPANY_ID,
      name: "Entreprise demo Polaris",
      reportFooter: "Rapport genere par Polaris CVC",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    users: [
      {
        id: TECH_ID,
        companyId: COMPANY_ID,
        displayName: "Mila Laurent",
        email: "mila@polaris.local",
        role: "technicien",
        phone: "06 00 00 00 00",
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: "user-samir",
        companyId: COMPANY_ID,
        displayName: "Samir Cohen",
        email: "samir@polaris.local",
        role: "referent_technique",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    customers: [
      {
        id: "customer-clinique-nord",
        companyId: COMPANY_ID,
        name: "Clinique du Nord",
        contactName: "A. Morel",
        phone: "01 42 00 00 00",
        email: "maintenance@clinique-nord.local",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    sites: [
      {
        id: "site-bloc-a",
        companyId: COMPANY_ID,
        customerId: "customer-clinique-nord",
        name: "Bloc A - toiture technique",
        address: "18 avenue des Ateliers, 75018 Paris",
        accessNotes: "Badge accueil puis local technique niveau R+4.",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    equipment: [
      {
        id: "equipment-rooftop-1",
        companyId: COMPANY_ID,
        siteId: "site-bloc-a",
        label: "Rooftop consultation 1",
        brand: "Carrier",
        range: "AquaSnap",
        model: "30RBP",
        serialNumber: "CVC-30RBP-2024-001",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    equipmentIdentifications: [],
    interventions: [
      {
        id: "intervention-demo-1",
        companyId: COMPANY_ID,
        number: "INT-2026-0001",
        customerId: "customer-clinique-nord",
        siteId: "site-bloc-a",
        equipmentId: "equipment-rooftop-1",
        authorId: "user-samir",
        assignedTechnicianId: "user-samir",
        title: "Defaut haute pression intermittent",
        requestedBy: "A. Morel",
        customerRequest: "Remise en service apres plusieurs alarmes HP.",
        observedSymptom: "Arret compresseur apres montee rapide de pression.",
        checksPerformed: "Controle condenseur, ventilateurs, pressostats et filtre.",
        measures: "HP 28 bar, BP 5.2 bar, air exterieur 31 C.",
        diagnosis: "Echange condenseur degrade par encrassement.",
        workDone: "Nettoyage condenseur, controle rotation ventilateurs, essai charge.",
        finalResult: "Fonctionnement stabilise apres essai 35 minutes.",
        recommendations: "Planifier nettoyage preventif trimestriel.",
        resultStatus: "resolu",
        contentStatus: "termine",
        startedAt: timestamp,
        completedAt: timestamp,
        syncState: "synchronise",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    measurements: [],
    media: [],
    documents: [],
    documentLinks: [],
    documentFavorites: [],
    documentRecentViews: [],
    documentImportBatches: [],
    documentImportCandidates: [],
    aiAnalyses: [
      {
        id: "ai-placeholder-1",
        companyId: COMPANY_ID,
        interventionId: "intervention-demo-1",
        provider: "none",
        feature: "comparaison_anciennes_interventions",
        status: "prevu_non_active",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    activityLogs: []
  };
}

export class LocalRepository implements AppRepository {
  mode = "local" as const;

  async load(): Promise<AppData> {
    return this.loadSync();
  }

  loadSync(): AppData {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createSeedData();
      this.save(seed);
      return seed;
    }
    return migrateAppData(JSON.parse(raw) as AppData);
  }

  save(data: AppData): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async createIntervention(data: AppData, draft: InterventionDraft, authorId = TECH_ID): Promise<AppData> {
    const timestamp = now();
    const intervention: Intervention = {
      ...draft,
      id: id("intervention"),
      companyId: data.company.id,
      number: `INT-${new Date().getFullYear()}-${String(data.interventions.length + 1).padStart(4, "0")}`,
      authorId,
      assignedTechnicianId: authorId,
      startedAt: timestamp,
      syncState: navigator.onLine ? "en_attente" : "hors_ligne",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const next = {
      ...data,
      interventions: [intervention, ...data.interventions],
      activityLogs: [
        {
          id: id("log"),
          companyId: data.company.id,
          actorId: authorId,
          action: "creation_intervention",
          entityType: "interventions",
          entityId: intervention.id,
          createdAt: timestamp,
          updatedAt: timestamp
        },
        ...data.activityLogs
      ]
    };
    this.save(next);
    return next;
  }

  async updateInterventionStatus(data: AppData, interventionId: string, contentStatus: ContentStatus): Promise<AppData> {
    const next = {
      ...data,
      interventions: data.interventions.map((item) =>
        item.id === interventionId
          ? {
              ...item,
              contentStatus,
              completedAt: contentStatus === "termine" ? now() : item.completedAt,
              updatedAt: now()
            }
          : item
      )
    };
    this.save(next);
    return next;
  }

  async addMedia(data: AppData, interventionId: string, file: File, dataUrl: string): Promise<AppData> {
    const timestamp = now();
    const item: MediaItem = {
      id: id("media"),
      companyId: data.company.id,
      interventionId,
      type: "photo",
      name: file.name,
      dataUrl,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const next = { ...data, media: [item, ...data.media] };
    this.save(next);
    return next;
  }

  async addDocument(
    data: AppData,
    document: Omit<TechnicalDocument, "id" | "companyId" | "createdAt" | "updatedAt">
  ): Promise<AppData> {
    const timestamp = now();
    const item: TechnicalDocument = {
      ...document,
      id: id("document"),
      companyId: data.company.id,
      searchIndex: document.searchIndex || buildDocumentSearchIndex(document),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const next = {
      ...data,
      documents: [item, ...data.documents]
    };
    this.save(next);
    return next;
  }

  async importDocumentCandidates(data: AppData, candidates: DocumentImportCandidate[], userId: string): Promise<AppData> {
    const timestamp = now();
    const batchIds = Array.from(new Set(candidates.map((candidate) => candidate.batchId)));
    const batches: DocumentImportBatch[] = batchIds.map((batchId) => ({
      id: batchId,
      companyId: data.company.id,
      folderName: "Import dossier",
      sourceType: "import_dossier",
      importedByUserId: userId,
      totalFiles: candidates.filter((candidate) => candidate.batchId === batchId).length,
      status: "pret_validation",
      createdAt: timestamp,
      updatedAt: timestamp
    }));

    const next = {
      ...data,
      documentImportBatches: [...batches, ...data.documentImportBatches],
      documentImportCandidates: [...candidates, ...data.documentImportCandidates]
    };
    this.save(next);
    return next;
  }

  async toggleDocumentFavorite(data: AppData, documentId: string, userId: string): Promise<AppData> {
    const existing = data.documentFavorites.find((item) => item.documentId === documentId && item.userId === userId);
    const nextFavorites = existing
      ? data.documentFavorites.filter((item) => item.id !== existing.id)
      : [
          {
            id: id("favorite"),
            companyId: data.company.id,
            documentId,
            userId,
            createdAt: now(),
            updatedAt: now()
          },
          ...data.documentFavorites
        ];
    const next = { ...data, documentFavorites: nextFavorites };
    this.save(next);
    return next;
  }

  async recordDocumentView(data: AppData, documentId: string, userId: string): Promise<AppData> {
    const timestamp = now();
    const recentView: DocumentRecentView = {
      id: id("recent-document"),
      companyId: data.company.id,
      documentId,
      userId,
      viewedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const next = {
      ...data,
      documents: data.documents.map((document) =>
        document.id === documentId ? { ...document, lastViewedAt: timestamp, updatedAt: timestamp } : document
      ),
      documentRecentViews: [
        recentView,
        ...data.documentRecentViews.filter((item) => !(item.documentId === documentId && item.userId === userId))
      ].slice(0, 50)
    };
    this.save(next);
    return next;
  }
}

export const repository = new LocalRepository();

function migrateAppData(data: AppData): AppData {
  return {
    ...data,
    documents: (data.documents || []).map((document) => ({
      ...document,
      productFamily: document.productFamily,
      model: document.model || document.compatibleModel,
      keywords: document.keywords || [],
      tags: document.tags || [],
      language: document.language || "FR",
      sourceType: document.sourceType || "manuel",
      searchIndex: document.searchIndex || buildDocumentSearchIndex(document),
      indexStatus: document.indexStatus || "metadonnees"
    })),
    documentLinks: (data.documentLinks || []).map((link) => ({
      ...link,
      confidence: link.confidence ?? 1,
      reason: link.reason || "manuel"
    })),
    documentFavorites: (data.documentFavorites || []) as DocumentFavorite[],
    documentRecentViews: (data.documentRecentViews || []) as DocumentRecentView[],
    documentImportBatches: (data.documentImportBatches || []) as DocumentImportBatch[],
    documentImportCandidates: (data.documentImportCandidates || []) as DocumentImportCandidate[],
    equipmentIdentifications: data.equipmentIdentifications || []
  };
}
