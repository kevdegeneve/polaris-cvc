import type {
  DocumentImportCandidate,
  DocumentLanguage,
  Equipment,
  ProductFamily,
  TechnicalDocument,
  TechnicalDocumentType
} from "../domain/types";
import { makeSearchIndex } from "../domain/validation";

export interface DocumentSearchFilters {
  brand?: string;
  productFamily?: ProductFamily | "";
  documentType?: TechnicalDocumentType | "";
  language?: DocumentLanguage | "";
}

export const productFamilyOptions: Array<{ value: ProductFamily; label: string }> = [
  { value: "PAC", label: "PAC" },
  { value: "VRV", label: "VRV" },
  { value: "CTA", label: "CTA" },
  { value: "groupe_froid", label: "Groupe froid" },
  { value: "regulation", label: "Regulation" },
  { value: "ventilation", label: "Ventilation" },
  { value: "chaudiere", label: "Chaudiere" },
  { value: "autre", label: "Autre" }
];

export const documentTypeOptions: Array<{ value: TechnicalDocumentType; label: string }> = [
  { value: "notice", label: "Notice" },
  { value: "schema_electrique", label: "Schema electrique" },
  { value: "manuel", label: "Manuel" },
  { value: "fiche_technique", label: "Fiche technique" },
  { value: "vue_eclatee", label: "Vue eclatee" },
  { value: "procedure", label: "Procedure" },
  { value: "image", label: "Image" },
  { value: "autre", label: "Autre" }
];

export const languageOptions: DocumentLanguage[] = ["FR", "EN", "DE", "ES", "IT", "multi", "autre"];

const brandHints = [
  "atlantic",
  "carrier",
  "daikin",
  "mitsubishi",
  "panasonic",
  "samsung",
  "trane",
  "ciat",
  "lennox",
  "toshiba",
  "lg",
  "hitachi"
];

export function buildDocumentSearchIndex(document: Partial<TechnicalDocument>): string {
  return makeSearchIndex([
    document.title,
    document.brand,
    document.range,
    document.productFamily,
    document.model,
    document.compatibleModel,
    ...(document.modelAliases || []),
    document.manufacturerReference,
    document.category,
    document.documentType,
    document.language,
    document.version,
    document.year ? String(document.year) : undefined,
    ...(document.keywords || []),
    ...(document.tags || []),
    document.fileName,
    document.manufacturer,
    ...(document.modelReferences || []),
    ...(document.errorCodes || []),
    document.originalLanguage,
    document.localizedLanguage,
    document.documentReference,
    document.documentVersion,
    document.status,
    document.translationStatus,
    document.usageCount ? String(document.usageCount) : undefined
  ]);
}

export function searchTechnicalDocuments(
  documents: TechnicalDocument[],
  query: string,
  filters: DocumentSearchFilters = {}
): TechnicalDocument[] {
  const normalized = makeSearchIndex([query]);
  return documents
    .filter((document) => {
      if (filters.brand && document.brand !== filters.brand) return false;
      if (filters.productFamily && document.productFamily !== filters.productFamily) return false;
      if (filters.documentType && document.documentType !== filters.documentType) return false;
      if (filters.language && document.language !== filters.language) return false;
      return !normalized || document.searchIndex.includes(normalized) || buildDocumentSearchIndex(document).includes(normalized);
    })
    .sort((left, right) => {
      const leftViewed = left.lastViewedAt ? Date.parse(left.lastViewedAt) : 0;
      const rightViewed = right.lastViewedAt ? Date.parse(right.lastViewedAt) : 0;
      return rightViewed - leftViewed || right.updatedAt.localeCompare(left.updatedAt);
    });
}

export function suggestDocumentClassification(fileName: string): Omit<
  DocumentImportCandidate,
  "id" | "companyId" | "createdAt" | "updatedAt" | "batchId" | "fileName" | "fileType" | "fileSize" | "status"
> {
  const raw = fileName.replace(/\.[^.]+$/, "");
  const tokens = raw.split(/[\s_.\-()]+/).filter(Boolean);
  const normalizedTokens = tokens.map((token) => makeSearchIndex([token]));
  const brand = brandHints.find((hint) => normalizedTokens.includes(hint));
  const type = detectDocumentType(normalizedTokens, fileName);
  const family = detectProductFamily(normalizedTokens);
  const language = detectLanguage(normalizedTokens);
  const yearToken = tokens.find((token) => /^20\d{2}$/.test(token) || /^19\d{2}$/.test(token));
  const model = tokens.find((token) => /[a-zA-Z]/.test(token) && /\d/.test(token) && token.length >= 4);
  const keywords = Array.from(new Set(tokens.map((token) => token.toUpperCase()).filter((token) => token.length > 2))).slice(0, 8);

  return {
    proposedTitle: humanizeFileName(raw),
    proposedBrand: brand ? toTitleCase(brand) : undefined,
    proposedProductFamily: family,
    proposedModel: model,
    proposedDocumentType: type,
    proposedLanguage: language,
    proposedYear: yearToken ? Number(yearToken) : undefined,
    proposedKeywords: keywords,
    confidence: [brand, family, model, type !== "autre"].filter(Boolean).length / 4
  };
}

export function createImportCandidates(files: File[], companyId: string, userId: string): DocumentImportCandidate[] {
  const timestamp = new Date().toISOString();
  const batchId = `batch-${crypto.randomUUID()}`;
  return files.map((file) => {
    const suggestion = suggestDocumentClassification(file.name);
    return {
      ...suggestion,
      id: `candidate-${crypto.randomUUID()}`,
      companyId,
      batchId,
      fileName: file.name,
      fileType: file.type || guessFileType(file.name),
      fileSize: file.size,
      status: "propose",
      createdAt: timestamp,
      updatedAt: timestamp
    };
  });
}

export function findDocumentsForEquipment(documents: TechnicalDocument[], equipment: Equipment): TechnicalDocument[] {
  const brand = makeSearchIndex([equipment.brand]);
  const model = makeSearchIndex([equipment.model]);
  const range = makeSearchIndex([equipment.range]);
  return documents.filter((document) => {
    const index = document.searchIndex || buildDocumentSearchIndex(document);
    const brandMatches = Boolean(brand && index.includes(brand));
    const modelMatches = Boolean(model && index.includes(model));
    const rangeMatches = Boolean(range && index.includes(range));
    return brandMatches && (modelMatches || rangeMatches);
  });
}

function detectDocumentType(tokens: string[], fileName: string): TechnicalDocumentType {
  const lowerName = fileName.toLowerCase();
  if (tokens.some((token) => ["schema", "schematic", "wiring", "elec", "electrique"].includes(token))) return "schema_electrique";
  if (tokens.some((token) => ["notice", "installation", "install"].includes(token))) return "notice";
  if (tokens.some((token) => ["manuel", "manual", "service"].includes(token))) return "manuel";
  if (tokens.some((token) => ["fiche", "datasheet", "technique"].includes(token))) return "fiche_technique";
  if (tokens.some((token) => ["vue", "explodee", "spare", "parts"].includes(token))) return "vue_eclatee";
  if (lowerName.match(/\.(png|jpe?g|webp|gif)$/)) return "image";
  return "autre";
}

function detectProductFamily(tokens: string[]): ProductFamily | undefined {
  if (tokens.some((token) => ["pac", "pompe", "heatpump"].includes(token))) return "PAC";
  if (tokens.includes("vrv") || tokens.includes("vrf")) return "VRV";
  if (tokens.includes("cta") || tokens.includes("ahu")) return "CTA";
  if (tokens.some((token) => ["chiller", "groupe", "froid"].includes(token))) return "groupe_froid";
  if (tokens.some((token) => ["regulation", "regulateur", "controller"].includes(token))) return "regulation";
  if (tokens.some((token) => ["ventilation", "ventilo", "vmc"].includes(token))) return "ventilation";
  return undefined;
}

function detectLanguage(tokens: string[]): DocumentLanguage {
  if (tokens.includes("fr") || tokens.includes("francais")) return "FR";
  if (tokens.includes("en") || tokens.includes("english")) return "EN";
  if (tokens.includes("de")) return "DE";
  if (tokens.includes("es")) return "ES";
  if (tokens.includes("it")) return "IT";
  return "FR";
}

function guessFileType(fileName: string): string {
  if (fileName.toLowerCase().endsWith(".pdf")) return "application/pdf";
  if (fileName.toLowerCase().match(/\.(png|jpe?g|webp|gif)$/)) return "image/*";
  return "application/octet-stream";
}

function humanizeFileName(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
