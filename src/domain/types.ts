export type UserRole = "technicien" | "referent_technique" | "administrateur";
export type ContentStatus = "brouillon" | "termine" | "valide" | "a_verifier";
export type InterventionResult = "resolu" | "provisoire" | "non_resolu" | "a_surveiller";
export type SyncState = "synchronise" | "en_attente" | "hors_ligne";

export interface CompanyScoped {
  id: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Company extends Omit<CompanyScoped, "companyId"> {
  name: string;
  siret?: string;
  reportFooter: string;
}

export interface AppUser extends CompanyScoped {
  displayName: string;
  email: string;
  role: UserRole;
  phone?: string;
}

export interface Customer extends CompanyScoped {
  name: string;
  contactName: string;
  phone: string;
  email?: string;
  notes?: string;
}

export interface Site extends CompanyScoped {
  customerId: string;
  name: string;
  address: string;
  accessNotes?: string;
}

export interface Equipment extends CompanyScoped {
  siteId: string;
  label: string;
  brand: string;
  range?: string;
  model: string;
  serialNumber?: string;
  installedAt?: string;
  notes?: string;
}

export interface Measurement extends CompanyScoped {
  interventionId: string;
  label: string;
  value: string;
  unit?: string;
}

export interface MediaItem extends CompanyScoped {
  interventionId: string;
  type: "photo" | "voice_note";
  name: string;
  dataUrl?: string;
  transcriptionStatus?: "prevu_non_active" | "en_attente" | "termine";
}

export interface Intervention extends CompanyScoped {
  number: string;
  customerId: string;
  siteId: string;
  equipmentId?: string;
  authorId: string;
  assignedTechnicianId: string;
  title: string;
  requestedBy: string;
  customerRequest: string;
  observedSymptom: string;
  checksPerformed: string;
  measures: string;
  diagnosis: string;
  workDone: string;
  finalResult: string;
  recommendations: string;
  resultStatus: InterventionResult;
  contentStatus: ContentStatus;
  startedAt: string;
  completedAt?: string;
  syncState: SyncState;
}

export interface TechnicalDocument extends CompanyScoped {
  title: string;
  brand: string;
  range?: string;
  compatibleModel?: string;
  documentType: "notice" | "schema" | "manuel" | "fiche_technique" | "procedure" | "autre";
  language: string;
  version?: string;
  documentDate?: string;
  source?: string;
  addedByUserId: string;
  officialStatus: "officiel" | "interne" | "a_verifier";
  fileName?: string;
}

export interface DocumentLink extends CompanyScoped {
  documentId: string;
  brand?: string;
  range?: string;
  model?: string;
  equipmentId?: string;
}

export interface AiAnalysis extends CompanyScoped {
  interventionId: string;
  provider: "none" | "openai" | "other";
  feature: string;
  status: "prevu_non_active" | "en_attente" | "termine" | "erreur";
  summary?: string;
}

export interface ActivityLog extends CompanyScoped {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
}

export interface AppData {
  company: Company;
  users: AppUser[];
  customers: Customer[];
  sites: Site[];
  equipment: Equipment[];
  interventions: Intervention[];
  measurements: Measurement[];
  media: MediaItem[];
  documents: TechnicalDocument[];
  documentLinks: DocumentLink[];
  aiAnalyses: AiAnalysis[];
  activityLogs: ActivityLog[];
}

export type InterventionDraft = Pick<
  Intervention,
  | "customerId"
  | "siteId"
  | "equipmentId"
  | "title"
  | "requestedBy"
  | "customerRequest"
  | "observedSymptom"
  | "checksPerformed"
  | "measures"
  | "diagnosis"
  | "workDone"
  | "finalResult"
  | "recommendations"
  | "resultStatus"
  | "contentStatus"
>;
