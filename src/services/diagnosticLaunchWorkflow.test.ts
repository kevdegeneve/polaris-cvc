import { describe, expect, it, vi } from "vitest";
import type { AIAnalysisResponse, Diagnostic, DiagnosticLaunchStage, DiagnosticPhoto } from "../domain/types";
import { runDiagnosticLaunchWorkflow, type DiagnosticLaunchWorkflowDeps } from "./diagnosticLaunchWorkflow";

function diagnostic(status: Diagnostic["status"] = "draft"): Diagnostic {
  return {
    id: "diagnostic-1",
    companyId: "optima",
    title: "Diagnostic terrain",
    status,
    technicianId: "uid-tech",
    technicianName: "Technicien",
    preferredLanguage: "fr",
    photoIds: ["photo-1"],
    messageCount: 0,
    documentIds: [],
    sourceReferences: [],
    probableCauses: [],
    performedChecks: [],
    measurements: [],
    proposedSolutions: [],
    safetyWarnings: [],
    createdBy: "uid-tech",
    updatedBy: "uid-tech",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z"
  };
}

function photo(): DiagnosticPhoto {
  return {
    id: "photo-1",
    companyId: "optima",
    diagnosticId: "diagnostic-1",
    storagePath: "diagnostics/diagnostic-1/photos/photo-1.jpg",
    originalFileName: "photo.jpg",
    mimeType: "image/jpeg",
    size: 1200,
    category: "autre",
    categoryDetectedByAI: false,
    uploadedBy: "uid-tech",
    uploadedAt: "2026-08-01T00:00:00.000Z",
    analysisStatus: "pending",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z"
  };
}

function completedResponse(): AIAnalysisResponse {
  return { status: "completed", message: "ok" };
}

function deps(overrides: Partial<DiagnosticLaunchWorkflowDeps> = {}) {
  const events: DiagnosticLaunchStage[] = [];
  const base: DiagnosticLaunchWorkflowDeps = {
    uploadPhoto: vi.fn(async (item: DiagnosticPhoto) => ({ ...item, downloadUrl: "https://download.test/photo.jpg" })),
    savePhotoMetadata: vi.fn(async () => undefined),
    saveReadyDiagnostic: vi.fn(async () => undefined),
    callAnalyzeDiagnostic: vi.fn(async () => completedResponse()),
    log: vi.fn((event: DiagnosticLaunchStage) => events.push(event))
  };
  return { deps: { ...base, ...overrides }, events };
}

describe("diagnostic launch workflow", () => {
  it("uploads then calls the callable after ready_for_analysis", async () => {
    const setup = deps();
    const result = await runDiagnosticLaunchWorkflow({ diagnostic: diagnostic(), photos: [photo()] }, setup.deps);

    expect(result.calledCallable).toBe(true);
    expect(setup.events).toEqual([
      "diagnostic_created",
      "storage_upload_started",
      "storage_upload_completed",
      "photo_metadata_saved",
      "diagnostic_ready_for_analysis",
      "callable_invocation_started",
      "callable_invocation_completed"
    ]);
  });

  it("does not call the callable when upload times out", async () => {
    const setup = deps({ uploadPhoto: vi.fn(async () => { throw Object.assign(new Error("upload timeout"), { code: "storage/retry-limit-exceeded" }); }) });
    const result = await runDiagnosticLaunchWorkflow({ diagnostic: diagnostic(), photos: [photo()] }, setup.deps);

    expect(result.calledCallable).toBe(false);
    expect(result.error).toMatchObject({ stage: "storage_upload_started", code: "storage/retry-limit-exceeded" });
  });

  it("does not call the callable when Firebase Storage rejects upload", async () => {
    const setup = deps({ uploadPhoto: vi.fn(async () => { throw Object.assign(new Error("unauthorized"), { code: "storage/unauthorized" }); }) });
    const result = await runDiagnosticLaunchWorkflow({ diagnostic: diagnostic(), photos: [photo()] }, setup.deps);

    expect(result.calledCallable).toBe(false);
    expect(result.error).toMatchObject({ stage: "storage_upload_started", code: "storage/unauthorized" });
  });

  it("does not call the callable when Firestore metadata write fails", async () => {
    const setup = deps({ savePhotoMetadata: vi.fn(async () => { throw Object.assign(new Error("permission denied"), { code: "permission-denied" }); }) });
    const result = await runDiagnosticLaunchWorkflow({ diagnostic: diagnostic(), photos: [photo()] }, setup.deps);

    expect(result.calledCallable).toBe(false);
    expect(result.error).toMatchObject({ stage: "photo_metadata_saved", code: "permission-denied" });
  });

  it("keeps the same diagnostic id when retrying after analysis_failed", async () => {
    const setup = deps();
    const result = await runDiagnosticLaunchWorkflow({ diagnostic: diagnostic("analysis_failed"), photos: [photo()] }, setup.deps);

    expect(result.diagnosticId).toBe("diagnostic-1");
    expect(setup.deps.callAnalyzeDiagnostic).toHaveBeenCalledWith("diagnostic-1");
  });

  it("preserves callable error stage and code", async () => {
    const setup = deps({ callAnalyzeDiagnostic: vi.fn(async () => { throw Object.assign(new Error("unavailable"), { code: "functions/unavailable" }); }) });
    const result = await runDiagnosticLaunchWorkflow({ diagnostic: diagnostic(), photos: [photo()] }, setup.deps);

    expect(result.calledCallable).toBe(true);
    expect(result.error).toMatchObject({ stage: "callable_invocation_started", code: "functions/unavailable" });
    expect(setup.events).toContain("callable_invocation_failed");
  });
});
