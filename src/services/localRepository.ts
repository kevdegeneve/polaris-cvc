import {
  AppData,
  ContentStatus,
  Intervention,
  InterventionDraft,
  MediaItem,
  TechnicalDocument
} from "../domain/types";
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
    documents: [
      {
        id: "document-carrier-30rbp",
        companyId: COMPANY_ID,
        title: "Manuel service Carrier 30RBP",
        brand: "Carrier",
        range: "AquaSnap",
        compatibleModel: "30RBP",
        documentType: "manuel",
        language: "fr",
        version: "2025.1",
        documentDate: "2025-06-01",
        source: "Portail constructeur",
        addedByUserId: "user-samir",
        officialStatus: "a_verifier",
        fileName: "carrier-30rbp-service.pdf",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ],
    documentLinks: [],
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
    return JSON.parse(raw) as AppData;
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
    const next = {
      ...data,
      documents: [
        {
          ...document,
          id: id("document"),
          companyId: data.company.id,
          createdAt: timestamp,
          updatedAt: timestamp
        },
        ...data.documents
      ]
    };
    this.save(next);
    return next;
  }
}

export const repository = new LocalRepository();
