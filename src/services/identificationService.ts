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

export class NotConnectedIdentificationService implements IdentificationService {
  async analyzeEquipmentPlate(request: EquipmentIdentificationRequest): Promise<EquipmentIdentification> {
    const timestamp = now();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 450));

    return {
      id: id("equipment-identification"),
      companyId: request.companyId,
      imageName: request.imageName,
      imageDataUrl: request.imageDataUrl,
      crop: request.crop,
      remarks: "Le moteur OCR/Vision n'est pas encore connecte. Aucune donnee technique n'a ete generee.",
      confidence: 0,
      detectedZones: [],
      status: "erreur",
      provider: "not_connected",
      createdByUserId: request.userId,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }
}

export const identificationService: IdentificationService = new NotConnectedIdentificationService();
