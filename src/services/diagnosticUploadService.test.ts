import { describe, expect, it } from "vitest";
import { diagnosticImageMaxSize, validateDiagnosticImage } from "./diagnosticUploadService";

describe("diagnosticUploadService", () => {
  it("accepts only real supported image types under the size limit", () => {
    expect(() => validateDiagnosticImage(new File(["x"], "plate.jpg", { type: "image/jpeg" }))).not.toThrow();
    expect(() => validateDiagnosticImage(new File(["x"], "plate.gif", { type: "image/gif" }))).toThrow("Format image non autorise");
  });

  it("rejects oversized diagnostic photos", () => {
    const oversized = new File([new Uint8Array(diagnosticImageMaxSize + 1)], "plate.jpg", { type: "image/jpeg" });

    expect(() => validateDiagnosticImage(oversized)).toThrow("Image trop volumineuse");
  });
});
