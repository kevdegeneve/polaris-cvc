export type UserRole = "technicien" | "technician" | "referent_technique" | "administrateur" | "admin";
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
export type UserPreferredLanguage = "fr" | "en" | "de" | "it" | "es";
export type DiagnosticStatus =
  | "draft"
  | "uploading_photos"
  | "ready_for_analysis"
  | "analyzing"
  | "awaiting_technician_input"
  | "completed"
  | "archived"
  | "analysis_failed";
export type DiagnosticPhotoCategory =
  | "plaque_signaletique"
  | "code_erreur"
  | "equipement"
  | "carte_electronique"
  | "mesure"
  | "cablage"
  | "composant"
  | "autre";
export type DiagnosticMessageRole = "system" | "assistant" | "technician" | "source" | "observation" | "measurement";
export type TechnicalDocumentStatus = "active" | "deprecated" | "superseded" | "hidden";
export type TechnicalMemoryCause =
  | "sonde_defectueuse"
  | "carte_electronique_hs"
  | "ventilateur_bloque"
  | "manque_de_fluide"
  | "fuite_detectee"
  | "connecteur_desserre"
  | "mauvais_cablage"
  | "parametrage"
  | "autre";
export type TechnicalMemoryAction =
  | "remplacement_sonde"
  | "remplacement_carte"
  | "ajout_fluide"
  | "recherche_fuite"
  | "remplacement_ventilateur"
  | "nettoyage"
  | "resserrage_connecteur"
  | "reparametrage"
  | "autre";
export type TechnicalMemoryRepairResult = "repare" | "repare_partiellement" | "non_repare";
export type DocumentTranslationStatus =
  | "original_available"
  | "translation_pending"
  | "translated"
  | "translation_failed"
  | "official_translation_available";

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
  uid?: string;
  emailNormalized?: string;
  displayName: string;
  email: string;
  role: UserRole;
  phone?: string;
  photoURL?: string;
  lastLoginAt?: string;
  isActive?: boolean;
  preferredLanguage?: UserPreferredLanguage;
  preferredLanguageLabel?: string;
  languageConfiguredAt?: string;
}

export interface AuthorizedUser {
  email: string;
  emailNormalized: string;
  companyId: string;
  role: UserRole;
  isActive: boolean;
  invitedAt?: string;
  invitedBy?: string;
  updatedAt?: string;
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
  provider: "not_connected" | "vision_ocr";
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
  manufacturer?: string;
  modelReferences?: string[];
  errorCodes?: string[];
  originalLanguage?: string;
  localizedLanguage?: string;
  originalStoragePath?: string;
  canonicalUrl?: string;
  fileHash?: string;
  documentReference?: string;
  documentVersion?: string;
  publicationDate?: string;
  isOfficialDocument?: boolean;
  isOfficialTranslation?: boolean;
  isMachineTranslated?: boolean;
  originalDocumentId?: string;
  translationStatus?: DocumentTranslationStatus;
  summary?: string;
  extractedKeywords?: string[];
  status?: TechnicalDocumentStatus;
  usageCount?: number;
  diagnosticIds?: string[];
  firstRetrievedBy?: string;
  firstRetrievedAt?: string;
  lastUsedAt?: string;
}

export interface SourceReference {
  documentId?: string;
  title: string;
  manufacturer?: string;
  originalLanguage?: string;
  displayedLanguage?: string;
  brand?: string;
  model?: string;
  errorCode?: string;
  documentType?: TechnicalDocumentType;
  sourceUrl?: string;
  retrievedAt?: string;
  lastUsedAt?: string;
  hash?: string;
  pagesUsed?: string[];
  sectionsUsed?: string[];
  excerptsUsed?: string[];
  verificationStatus?: "a_verifier" | "verifie" | "rejete";
}

export interface DiagnosticMeasurement {
  label: string;
  value: string;
  unit?: string;
}

export interface DiagnosticCheck {
  title: string;
  instruction: string;
  reason: string;
  expectedResult: string;
  safetyLevel: "low" | "medium" | "high";
  order: number;
}

export interface ExpectedMeasurement {
  measurement: string;
  location: string;
  expectedValue: string;
  unit?: string;
  tolerance?: string;
  conditions?: string;
}

export interface DiagnosticAIResult {
  detectedBrand: string | null;
  detectedModel: string | null;
  detectedSerialNumber: string | null;
  detectedEquipmentType: string | null;
  detectedErrorCode: string | null;
  plateExtractedText: string[];
  faultImageExtractedText: string[];
  faultDescription: string | null;
  probableCauses: string[];
  recommendedChecks: DiagnosticCheck[];
  expectedMeasurements: ExpectedMeasurement[];
  safetyWarnings: string[];
  suggestedSolutions: string[];
  missingInformation: string[];
  confidenceLevel: number;
  analysisLanguage: UserPreferredLanguage;
  sourceReferences: SourceReference[];
  analyzedAt: string;
  modelUsed: string;
  promptVersion: string;
}

export interface Diagnostic extends CompanyScoped {
  title: string;
  detectedBrand?: string;
  detectedBrandNormalized?: string;
  detectedModel?: string;
  detectedSerialNumber?: string;
  detectedEquipmentType?: string;
  detectedErrorCode?: string;
  detectedErrorCodeNormalized?: string;
  shortFaultDescription?: string;
  status: DiagnosticStatus;
  technicianId: string;
  technicianName: string;
  preferredLanguage: UserPreferredLanguage;
  mainPhotoId?: string;
  photoIds: string[];
  messageCount: number;
  documentIds: string[];
  sourceReferences: SourceReference[];
  analysisSummary?: string;
  analysisResult?: DiagnosticAIResult;
  technicalMemoryInsight?: TechnicalMemoryInsight;
  finalDiagnosis?: string;
  probableCauses: string[];
  performedChecks: string[];
  recommendedChecks?: DiagnosticCheck[];
  expectedMeasurements?: ExpectedMeasurement[];
  measurements: DiagnosticMeasurement[];
  proposedSolutions: string[];
  safetyWarnings: string[];
  confidenceLevel?: number;
  analysisStartedAt?: string;
  analysisRequestedBy?: string;
  analysisCompletedAt?: string;
  analysisAttemptCount?: number;
  analyzedPhotoSignature?: string;
  promptVersion?: string;
  modelUsed?: string;
  analysisError?: string;
  completedAt?: string;
  archivedAt?: string;
  createdBy: string;
  updatedBy: string;
}

export interface DiagnosticPhoto extends CompanyScoped {
  diagnosticId: string;
  storagePath: string;
  downloadUrl?: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  category: DiagnosticPhotoCategory;
  categoryDetectedByAI: boolean;
  uploadedBy: string;
  uploadedAt: string;
  analysisStatus: "pending" | "not_connected" | "analyzed" | "failed";
  extractedText?: string;
  extractedMetadata?: Record<string, string>;
}

export interface DiagnosticMessage extends CompanyScoped {
  diagnosticId: string;
  role: DiagnosticMessageRole;
  content: string;
  language: UserPreferredLanguage;
  photoIds: string[];
  documentIds: string[];
  sourceReferences: SourceReference[];
  createdBy: string;
}

export interface DiagnosticDocumentLink extends CompanyScoped {
  diagnosticId: string;
  documentId: string;
  languageUsed: UserPreferredLanguage;
  pagesUsed: string[];
  sectionsUsed: string[];
  excerptsUsed: string[];
  reasonUsed: string;
  usedAt: string;
  usedByAI: boolean;
  responseMessageId?: string;
}

export interface TechnicalMemorySourceLink {
  type: "documentation_constructeur" | "note_interne" | "procedure" | "pdf" | "bulletin_technique";
  id?: string;
  title?: string;
  reference?: string;
  url?: string;
  status: "prevu" | "lie" | "a_verifier";
}

export interface TechnicalMemoryFeedback extends CompanyScoped {
  diagnosticId: string;
  technicianId: string;
  technicianName: string;
  detectedBrand?: string;
  detectedModel?: string;
  detectedEquipmentType?: string;
  detectedErrorCode?: string;
  symptomSummary?: string;
  aiProbableCauses: string[];
  actualCause: TechnicalMemoryCause;
  actualCauseOther?: string;
  actions: TechnicalMemoryAction[];
  actionOther?: string;
  repairResult: TechnicalMemoryRepairResult;
  timeSpentMinutes: number;
  comment?: string;
  sourceLinks: TechnicalMemorySourceLink[];
  createdBy: string;
  updatedBy: string;
}

export interface TechnicalMemoryCauseStat {
  cause: TechnicalMemoryCause;
  label: string;
  count: number;
}

export interface TechnicalMemoryActionStat {
  action: TechnicalMemoryAction;
  label: string;
  count: number;
}

export interface TechnicalMemoryInsight {
  totalKnownCases: number;
  repairedCount: number;
  partiallyRepairedCount: number;
  unrepairedCount: number;
  successRate: number;
  averageRepairTimeMinutes: number | null;
  mostFrequentCause: TechnicalMemoryCauseStat | null;
  causeStats: TechnicalMemoryCauseStat[];
  actionStats: TechnicalMemoryActionStat[];
}

export interface DiagnosticAnalysis {
  result: DiagnosticAIResult;
  detectedBrand?: string | null;
  detectedModel?: string | null;
  detectedErrorCode?: string | null;
  shortFaultDescription?: string | null;
  sourceReferences: SourceReference[];
  confidenceLevel?: number;
  technicalMemoryInsight?: TechnicalMemoryInsight;
}

export interface AIAnalysisRequest {
  diagnosticId: string;
  preferredLanguage?: UserPreferredLanguage;
  photoIds?: string[];
  message?: string;
}

export interface AIAnalysisResponse {
  status: "not_connected" | "completed" | "failed";
  message: string;
  analysis?: DiagnosticAnalysis;
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
  diagnostics: Diagnostic[];
  diagnosticPhotos: DiagnosticPhoto[];
  diagnosticMessages: DiagnosticMessage[];
  diagnosticDocumentLinks: DiagnosticDocumentLink[];
  technicalMemoryFeedbacks: TechnicalMemoryFeedback[];
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
