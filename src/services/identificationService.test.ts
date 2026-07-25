import { describe, expect, it, vi } from "vitest";
import { NotConnectedIdentificationService } from "./identificationService";

describe("NotConnectedIdentificationService", () => {
  it("does not invent equipment data while OCR vision is not connected", async () => {
    vi.useFakeTimers();
    const service = new NotConnectedIdentificationService();
    const promise = service.analyzeEquipmentPlate({
      companyId: "company-1",
      userId: "user-1",
      imageName: "plaque.jpg",
      imageDataUrl: "data:image/jpeg;base64,test",
      crop: { x: 8, y: -4, zoom: 1.3, rotation: 90 }
    });

    await vi.advanceTimersByTimeAsync(450);
    const result = await promise;
    vi.useRealTimers();

    expect(result.companyId).toBe("company-1");
    expect(result.provider).toBe("not_connected");
    expect(result.status).toBe("erreur");
    expect(result.manufacturer).toBeUndefined();
    expect(result.model).toBeUndefined();
    expect(result.serialNumber).toBeUndefined();
    expect(result.crop.rotation).toBe(90);
    expect(result.detectedZones).toEqual([]);
    expect(result.confidence).toBe(0);
  });
});
