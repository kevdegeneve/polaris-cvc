import {
  AppData,
  AppUser,
  ContentStatus,
  Diagnostic,
  DiagnosticMessage,
  DiagnosticPhoto,
  DocumentFavorite,
  DocumentImportBatch,
  DocumentImportCandidate,
  DocumentRecentView,
  Intervention,
  InterventionDraft,
  MediaItem,
  TechnicalMemoryFeedback,
  TechnicalDocument
} from "../domain/types";
import { buildDocumentSearchIndex } from "./documentLibraryService";
import type { AppRepository } from "./repository";

const STORAGE_KEY = "polaris-cvc-data";
const LEGACY_STORAGE_KEY = "polaris-cvc-demo-data";
const LOCAL_COMPANY_ID = "local";

function now(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createEmptyData(companyId = LOCAL_COMPANY_ID, companyName = "Polaris CVC"): AppData {
  const timestamp = now();
  return {
    company: {
      id: companyId,
      name: companyName,
      reportFooter: "Rapport genere par Polaris CVC",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    users: [],
    customers: [],
    sites: [],
    equipment: [],
    equipmentIdentifications: [],
    diagnostics: [],
    diagnosticPhotos: [],
    diagnosticMessages: [],
    diagnosticDocumentLinks: [],
    technicalMemoryFeedbacks: [],
    interventions: [],
    measurements: [],
    media: [],
    documents: [],
    documentLinks: [],
    documentFavorites: [],
    documentRecentViews: [],
    documentImportBatches: [],
    documentImportCandidates: [],
    aiAnalyses: [],
    activityLogs: []
  };
}

export class LocalRepository implements AppRepository {
  mode = "local" as const;

  async load(): Promise<AppData> {
    return this.loadSync();
  }

  loadSync(): AppData {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      return createEmptyData();
    }
    return migrateAppData(JSON.parse(raw) as AppData);
  }

  save(data: AppData): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async createIntervention(data: AppData, draft: InterventionDraft, authorId: string): Promise<AppData> {
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

  async updateUserLanguage(data: AppData, userId: string, language: AppUser["preferredLanguage"], label: string): Promise<AppData> {
    const timestamp = now();
    const next = {
      ...data,
      users: data.users.map((user) =>
        user.id === userId
          ? {
              ...user,
              preferredLanguage: language,
              preferredLanguageLabel: label,
              languageConfiguredAt: user.languageConfiguredAt || timestamp,
              updatedAt: timestamp
            }
          : user
      )
    };
    this.save(next);
    return next;
  }

  async saveDiagnostic(data: AppData, diagnostic: Diagnostic, photos: DiagnosticPhoto[], messages: DiagnosticMessage[]): Promise<AppData> {
    const existingDiagnosticIds = new Set(data.diagnostics.map((item) => item.id));
    const next = {
      ...data,
      diagnostics: existingDiagnosticIds.has(diagnostic.id)
        ? data.diagnostics.map((item) => (item.id === diagnostic.id ? diagnostic : item))
        : [diagnostic, ...data.diagnostics],
      diagnosticPhotos: [...photos, ...data.diagnosticPhotos.filter((item) => item.diagnosticId !== diagnostic.id)],
      diagnosticMessages: [...messages, ...data.diagnosticMessages.filter((item) => item.diagnosticId !== diagnostic.id)]
    };
    this.save(next);
    return next;
  }

  async saveTechnicalMemoryFeedback(data: AppData, feedback: TechnicalMemoryFeedback): Promise<AppData> {
    const next = {
      ...data,
      technicalMemoryFeedbacks: [
        feedback,
        ...data.technicalMemoryFeedbacks.filter((item) => item.diagnosticId !== feedback.diagnosticId)
      ]
    };
    this.save(next);
    return next;
  }
}

export const repository = new LocalRepository();

function migrateAppData(data: AppData): AppData {
  const withoutLegacyDemo = removeLegacyDemoData(data);
  return {
    ...withoutLegacyDemo,
    documents: (withoutLegacyDemo.documents || []).map((document) => ({
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
    documentLinks: (withoutLegacyDemo.documentLinks || []).map((link) => ({
      ...link,
      confidence: link.confidence ?? 1,
      reason: link.reason || "manuel"
    })),
    documentFavorites: (withoutLegacyDemo.documentFavorites || []) as DocumentFavorite[],
    documentRecentViews: (withoutLegacyDemo.documentRecentViews || []) as DocumentRecentView[],
    documentImportBatches: (withoutLegacyDemo.documentImportBatches || []) as DocumentImportBatch[],
    documentImportCandidates: (withoutLegacyDemo.documentImportCandidates || []) as DocumentImportCandidate[],
    equipmentIdentifications: withoutLegacyDemo.equipmentIdentifications || [],
    diagnostics: withoutLegacyDemo.diagnostics || [],
    diagnosticPhotos: withoutLegacyDemo.diagnosticPhotos || [],
    diagnosticMessages: withoutLegacyDemo.diagnosticMessages || [],
    diagnosticDocumentLinks: withoutLegacyDemo.diagnosticDocumentLinks || [],
    technicalMemoryFeedbacks: withoutLegacyDemo.technicalMemoryFeedbacks || []
  };
}

function removeLegacyDemoData(data: AppData): AppData {
  const demoIds = new Set([
    "user-mila",
    "user-samir",
    "customer-clinique-nord",
    "site-bloc-a",
    "equipment-rooftop-1",
    "intervention-demo-1",
    "ai-placeholder-1"
  ]);
  const isDemo = (item: { id: string }) => demoIds.has(item.id);

  return {
    ...data,
    company: data.company.id === "company-polaris-demo" ? createEmptyData().company : data.company,
    users: (data.users || []).filter((item) => !isDemo(item)),
    customers: (data.customers || []).filter((item) => !isDemo(item)),
    sites: (data.sites || []).filter((item) => !isDemo(item)),
    equipment: (data.equipment || []).filter((item) => !isDemo(item)),
    interventions: (data.interventions || []).filter((item) => !isDemo(item)),
    aiAnalyses: (data.aiAnalyses || []).filter((item) => !isDemo(item)),
    activityLogs: (data.activityLogs || []).filter((item) => !demoIds.has(item.actorId) && !demoIds.has(item.entityId))
  };
}
