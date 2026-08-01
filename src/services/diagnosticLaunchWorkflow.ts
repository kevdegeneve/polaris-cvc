import type { AIAnalysisResponse, Diagnostic, DiagnosticLaunchStage, DiagnosticPhoto } from "../domain/types";
import { createDiagnosticLaunchError, type DiagnosticLaunchError } from "./diagnosticService";

export interface DiagnosticLaunchWorkflowInput {
  diagnostic: Diagnostic;
  photos: DiagnosticPhoto[];
}

export interface DiagnosticLaunchWorkflowDeps {
  uploadPhoto: (photo: DiagnosticPhoto) => Promise<DiagnosticPhoto>;
  savePhotoMetadata: (diagnostic: Diagnostic, photos: DiagnosticPhoto[]) => Promise<void>;
  saveReadyDiagnostic: (diagnostic: Diagnostic, photos: DiagnosticPhoto[]) => Promise<void>;
  callAnalyzeDiagnostic: (diagnosticId: string) => Promise<AIAnalysisResponse>;
  log: (event: DiagnosticLaunchStage, details: Record<string, unknown>) => void;
}

export interface DiagnosticLaunchWorkflowResult {
  diagnosticId: string;
  calledCallable: boolean;
  error?: DiagnosticLaunchError;
}

export async function runDiagnosticLaunchWorkflow(
  input: DiagnosticLaunchWorkflowInput,
  deps: DiagnosticLaunchWorkflowDeps
): Promise<DiagnosticLaunchWorkflowResult> {
  let stage: DiagnosticLaunchStage = "diagnostic_created";
  let calledCallable = false;
  try {
    deps.log("diagnostic_created", { diagnosticId: input.diagnostic.id });
    const uploadedPhotos: DiagnosticPhoto[] = [];
    for (const photo of input.photos) {
      stage = "storage_upload_started";
      deps.log(stage, { diagnosticId: input.diagnostic.id, photoId: photo.id });
      const uploaded = await deps.uploadPhoto(photo);
      stage = "storage_upload_completed";
      deps.log(stage, { diagnosticId: input.diagnostic.id, photoId: uploaded.id });
      uploadedPhotos.push(uploaded);
    }
    stage = "photo_metadata_saved";
    await deps.savePhotoMetadata(input.diagnostic, uploadedPhotos);
    deps.log(stage, { diagnosticId: input.diagnostic.id, photoCount: uploadedPhotos.length });
    stage = "diagnostic_ready_for_analysis";
    await deps.saveReadyDiagnostic({ ...input.diagnostic, status: "ready_for_analysis" }, uploadedPhotos);
    deps.log(stage, { diagnosticId: input.diagnostic.id });
    stage = "callable_invocation_started";
    deps.log(stage, { diagnosticId: input.diagnostic.id, payload: { diagnosticId: input.diagnostic.id }, region: "europe-west1" });
    calledCallable = true;
    await deps.callAnalyzeDiagnostic(input.diagnostic.id);
    deps.log("callable_invocation_completed", { diagnosticId: input.diagnostic.id });
    return { diagnosticId: input.diagnostic.id, calledCallable };
  } catch (error) {
    const launchError = createDiagnosticLaunchError(stage, error);
    if (stage === "callable_invocation_started") {
      deps.log("callable_invocation_failed", { diagnosticId: input.diagnostic.id, code: launchError.code, message: launchError.message });
    }
    return { diagnosticId: input.diagnostic.id, calledCallable, error: launchError };
  }
}
