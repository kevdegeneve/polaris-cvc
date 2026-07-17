export type UserRole = "technicien" | "referent_technique" | "administrateur";
export type ContentStatus = "brouillon" | "termine" | "valide" | "a_verifier";
export type InterventionResult = "resolu" | "provisoire" | "non_resolu" | "a_surveiller";
export type SyncState = "synchronise" | "en_attente" | "hors_ligne";
export type ProductFamily = "PAC" | "VRV" | "CTA" | "groupe_froid" | "regulation" | "ventilation" | "chaudiere" | "autre";
export type TechnicalDocumentType =
  | "notice"
  | "schema_electrique"
  | "manuel"
  | "fiche_technique"
  | "vue_eclatee"
  | "procedure"
  | "image"
  | "autre";
export type DocumentLanguage = "FR" | "EN" | "DE" | "ES" | "IT" | "multi" | "autre";
export type DocumentImportStatus = "propose" | "valide" | "ignore" | "erreur";
export type DocumentIndexStatus = "non_indexe" | "metadonnees" | "texte_extrait" | "pret_rag";
export type DocumentSourceType = "manuel" | "import_dossier" | "constructeur_officiel" | "robot_constructeur";
export type EquipmentIdentificationStatus = "pret" | "analyse" | "termine" | "erreur";

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

export interface ImageCropSettings {
  x: number;
  y: number;
  zoom: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface DetectedImageZone {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface EquipmentIdentification extends CompanyScoped {
  imageName?: string;
  imageDataUrl?: string;
  crop: ImageCropSettings;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  year?: number;
  refrigerant?: string;
  power?: string;
  voltage?: string;
  current?: string;
  frequency?: string;
  remarks?: string;
  confidence: number;
  detectedZones: DetectedImageZone[];
  status: EquipmentIdentificationStatus;
  provider: "mock" | "vision_ocr";
  createdByUserId: string;
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
  productFamily?: ProductFamily;
  model?: string;
  modelAliases?: string[];
  compatibleModel?: string;
  documentType: TechnicalDocumentType;
  language: DocumentLanguage;
  version?: string;
  year?: number;
  documentDate?: string;
  manufacturerReference?: string;
  keywords: string[];
  tags: string[];
  category?: string;
  source?: string;
  sourceType: DocumentSourceType;
  sourceUrl?: string;
  addedByUserId: string;
  officialStatus: "officiel" | "interne" | "a_verifier";
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  storagePath?: string;
  checksum?: string;
  searchIndex: string;
  indexStatus: DocumentIndexStatus;
  ragChunkCount?: number;
  lastViewedAt?: string;
}

export interface DocumentLink extends CompanyScoped {
  documentId: string;
  brand?: string;
  range?: string;
  model?: string;
  equipmentId?: string;
  confidence: number;
  reason: "manuel" | "marque_modele" | "reference_constructeur" | "import_propose";
}

export interface DocumentFavorite extends CompanyScoped {
  documentId: string;
  userId: string;
}

export interface DocumentRecentView extends CompanyScoped {
  documentId: string;
  userId: string;
  viewedAt: string;
}

export interface DocumentImportBatch extends CompanyScoped {
  folderName: string;
  sourceType: "import_dossier" | "robot_constructeur";
  importedByUserId: string;
  totalFiles: number;
  status: "analyse" | "pret_validation" | "termine" | "erreur";
}

export interface DocumentImportCandidate extends CompanyScoped {
  batchId: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  proposedTitle: string;
  proposedBrand?: string;
  proposedProductFamily?: ProductFamily;
  proposedModel?: string;
  proposedDocumentType: TechnicalDocumentType;
  proposedLanguage: DocumentLanguage;
  proposedYear?: number;
  proposedKeywords: string[];
  confidence: number;
  status: DocumentImportStatus;
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
  equipmentIdentifications: EquipmentIdentification[];
  interventions: Intervention[];
  measurements: Measurement[];
  media: MediaItem[];
  documents: TechnicalDocument[];
  documentLinks: DocumentLink[];
  documentFavorites: DocumentFavorite[];
  documentRecentViews: DocumentRecentView[];
  documentImportBatches: DocumentImportBatch[];
  documentImportCandidates: DocumentImportCandidate[];
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
