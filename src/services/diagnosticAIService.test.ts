import { describe, expect, it } from "vitest";
import { NotConnectedDiagnosticAIService } from "./diagnosticAIService";

describe("NotConnectedDiagnosticAIService", () => {
  it("clearly reports that AI is unavailable and does not return fake diagnostics", async () => {
    const service = new NotConnectedDiagnosticAIService();
    const result = await service.analyzeInitialPhotos({
      diagnosticId: "diagnostic-1",
      preferredLanguage: "fr",
      photoIds: ["photo-1", "photo-2"]
    });

    expect(service.isAvailable()).toBe(false);
    expect(result.status).toBe("not_connected");
    expect(result.analysis).toBeUndefined();
    expect(result.message).toContain("pas encore connectee");
  });
});
