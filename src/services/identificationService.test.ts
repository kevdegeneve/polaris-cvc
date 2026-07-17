import { describe, expect, it, vi } from "vitest";
import { MockIdentificationService } from "./identificationService";

describe("MockIdentificationService", () => {
  it("returns a complete mocked equipment identification", async () => {
    vi.useFakeTimers();
    const service = new MockIdentificationService();
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
    expect(result.provider).toBe("mock");
    expect(result.status).toBe("termine");
    expect(result.manufacturer).toBeTruthy();
    expect(result.model).toBeTruthy();
    expect(result.serialNumber).toBeTruthy();
    expect(result.crop.rotation).toBe(90);
    expect(result.detectedZones.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
  });
});
