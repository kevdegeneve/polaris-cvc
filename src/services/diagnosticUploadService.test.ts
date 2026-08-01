import { describe, expect, it } from "vitest";
import {
  diagnosticImageMaxSize,
  diagnosticUploadInactivityTimeoutMs,
  diagnosticUploadTimeoutMs,
  getResizedDimensions,
  isMeaningfulUploadProgress,
  validateDiagnosticImage
} from "./diagnosticUploadService";

describe("diagnosticUploadService", () => {
  it("accepts only real supported image types under the size limit", () => {
    expect(() => validateDiagnosticImage(new File(["x"], "plate.jpg", { type: "image/jpeg" }))).not.toThrow();
    expect(() => validateDiagnosticImage(new File(["x"], "plate.gif", { type: "image/gif" }))).toThrow("Format image non autorise");
  });

  it("rejects oversized diagnostic photos", () => {
    const oversized = new File([new Uint8Array(diagnosticImageMaxSize + 1)], "plate.jpg", { type: "image/jpeg" });

    expect(() => validateDiagnosticImage(oversized)).toThrow("Image trop volumineuse");
  });

  it("keeps image proportions when resizing for diagnostic upload", () => {
    expect(getResizedDimensions(4000, 3000, 1800)).toEqual({ width: 1800, height: 1350 });
    expect(getResizedDimensions(1200, 900, 1800)).toEqual({ width: 1200, height: 900 });
  });

  it("uses a production-safe upload watchdog instead of a short total timeout", () => {
    expect(diagnosticUploadTimeoutMs).toBeGreaterThanOrEqual(180_000);
    expect(diagnosticUploadInactivityTimeoutMs).toBeGreaterThanOrEqual(45_000);
    expect(diagnosticUploadInactivityTimeoutMs).toBeLessThan(diagnosticUploadTimeoutMs);
  });

  it("does not treat zero transferred bytes as first real progress", () => {
    expect(isMeaningfulUploadProgress(0)).toBe(false);
    expect(isMeaningfulUploadProgress(1)).toBe(true);
  });
});
