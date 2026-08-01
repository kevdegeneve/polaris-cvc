import { describe, expect, it } from "vitest";
import { buildOpenAIDiagnosticRequest, parseOpenAIDiagnosticRawResponse, truncateForDebug } from "./index.js";

const mitsubishiPhotoBase64 = Buffer.from("synthetic-mitsubishi-electric-oc-u2-readable-photo").toString("base64");

describe("diagnostic OpenAI vision payload", () => {
  it("sends Mitsubishi Electric diagnostic photos as image input and preserves extracted U2 data", () => {
    const payload = buildOpenAIDiagnosticRequest(
      [
        {
          mimeType: "image/jpeg",
          base64: mitsubishiPhotoBase64
        }
      ],
      "fr"
    );

    const userMessage = payload.messages[1];
    expect(userMessage.role).toBe("user");
    expect(Array.isArray(userMessage.content)).toBe(true);
    const content = userMessage.content as Array<{ type: string; image_url?: { url: string; detail?: string } }>;
    expect(content.some((item) => item.type === "image_url" && item.image_url?.url.startsWith("data:image/jpeg;base64,"))).toBe(true);
    expect(content.some((item) => item.type === "image_url" && item.image_url?.detail === "high")).toBe(true);

    const rawResponse = JSON.stringify({
      detectedBrand: "Mitsubishi Electric",
      detectedModel: null,
      detectedSerialNumber: null,
      detectedEquipmentType: "OC",
      detectedErrorCode: "U2",
      plateExtractedText: ["Mitsubishi Electric", "OC"],
      faultImageExtractedText: ["U2"],
      faultDescription: "Code erreur U2 visible sur l'unite OC.",
      probableCauses: [],
      recommendedChecks: [],
      expectedMeasurements: [],
      safetyWarnings: [],
      suggestedSolutions: [],
      missingInformation: [],
      recommendedAdditionalPhotos: [],
      needsMoreInformation: false,
      confidenceLevel: 0.82,
      analysisLanguage: "fr",
      sourceReferences: []
    });
    const parsed = parseOpenAIDiagnosticRawResponse(rawResponse);

    expect(parsed.detectedBrand).toBe("Mitsubishi Electric");
    expect(parsed.detectedErrorCode).toBe("U2");
  });

  it("truncates raw debug responses before Firestore storage", () => {
    const oversizedRawResponse = "x".repeat(25_000);

    expect(truncateForDebug(oversizedRawResponse)).toHaveLength(20_000);
  });
});
