import { describe, expect, it } from "vitest";
import type { Equipment, TechnicalDocument } from "../domain/types";
import {
  buildDocumentSearchIndex,
  findDocumentsForEquipment,
  searchTechnicalDocuments,
  suggestDocumentClassification
} from "./documentLibraryService";

const baseDocument: TechnicalDocument = {
  id: "doc-1",
  companyId: "company-1",
  title: "Manuel service Daikin EWYQ",
  brand: "Daikin",
  productFamily: "groupe_froid",
  model: "EWYQ080",
  compatibleModel: "EWYQ080",
  documentType: "manuel",
  language: "FR",
  version: "2026",
  year: 2026,
  manufacturerReference: "REF-EWYQ-080",
  keywords: ["defaut", "compresseur", "hydraulique"],
  tags: ["maintenance"],
  sourceType: "import_dossier",
  addedByUserId: "user-1",
  officialStatus: "a_verifier",
  fileName: "daikin-ewyq080-service-fr-2026.pdf",
  searchIndex: "",
  indexStatus: "metadonnees",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

baseDocument.searchIndex = buildDocumentSearchIndex(baseDocument);

describe("documentLibraryService", () => {
  it("searches technical documents by brand, model, reference and keywords", () => {
    const documents = [baseDocument];

    expect(searchTechnicalDocuments(documents, "daikin")).toHaveLength(1);
    expect(searchTechnicalDocuments(documents, "EWYQ080")).toHaveLength(1);
    expect(searchTechnicalDocuments(documents, "REF-EWYQ-080")).toHaveLength(1);
    expect(searchTechnicalDocuments(documents, "compresseur")).toHaveLength(1);
    expect(searchTechnicalDocuments(documents, "carrier")).toHaveLength(0);
  });

  it("proposes classification from imported file names", () => {
    const proposal = suggestDocumentClassification("Daikin_EWYQ080_schema_electrique_FR_2026.pdf");

    expect(proposal.proposedBrand).toBe("Daikin");
    expect(proposal.proposedModel).toBe("EWYQ080");
    expect(proposal.proposedDocumentType).toBe("schema_electrique");
    expect(proposal.proposedLanguage).toBe("FR");
    expect(proposal.proposedYear).toBe(2026);
  });

  it("links documentation to equipment by brand and model", () => {
    const equipment: Equipment = {
      id: "equipment-1",
      companyId: "company-1",
      siteId: "site-1",
      label: "Groupe froid toiture",
      brand: "Daikin",
      model: "EWYQ080",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };

    expect(findDocumentsForEquipment([baseDocument], equipment)).toEqual([baseDocument]);
  });
});
