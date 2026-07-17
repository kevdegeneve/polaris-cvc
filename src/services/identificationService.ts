import type { EquipmentIdentification, ImageCropSettings } from "../domain/types";

export interface EquipmentIdentificationRequest {
  companyId: string;
  userId: string;
  imageName?: string;
  imageDataUrl?: string;
  crop: ImageCropSettings;
}

export interface IdentificationService {
  analyzeEquipmentPlate(request: EquipmentIdentificationRequest): Promise<EquipmentIdentification>;
}

function now(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export class MockIdentificationService implements IdentificationService {
  async analyzeEquipmentPlate(request: EquipmentIdentificationRequest): Promise<EquipmentIdentification> {
    const timestamp = now();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 450));

    return {
      id: id("equipment-identification"),
      companyId: request.companyId,
      imageName: request.imageName,
      imageDataUrl: request.imageDataUrl,
      crop: request.crop,
      manufacturer: "Daikin",
      model: "EWYQ080BAW",
      serialNumber: "SN-PLR-2026-0842",
      year: 2024,
      refrigerant: "R32",
      power: "80 kW",
      voltage: "400 V",
      current: "128 A",
      frequency: "50 Hz",
      remarks: "Resultat simule pour preparer l'interface. A verifier sur plaque reelle avant creation en base.",
      confidence: 0.82,
      detectedZones: [
        { id: "zone-brand", label: "Constructeur", x: 12, y: 14, width: 34, height: 14, confidence: 0.91 },
        { id: "zone-model", label: "Modele", x: 10, y: 34, width: 52, height: 12, confidence: 0.86 },
        { id: "zone-serial", label: "Numero de serie", x: 9, y: 52, width: 58, height: 11, confidence: 0.78 },
        { id: "zone-electrical", label: "Caracteristiques electriques", x: 8, y: 68, width: 72, height: 16, confidence: 0.74 }
      ],
      status: "termine",
      provider: "mock",
      createdByUserId: request.userId,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }
}

export const identificationService: IdentificationService = new MockIdentificationService();
