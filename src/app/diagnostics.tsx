import { useMemo, useState } from "react";
import { Archive, BrainCircuit, Camera, CheckCircle2, FileText, ImagePlus, Plus, Trash2 } from "lucide-react";
import type {
  AppData,
  AppUser,
  Diagnostic,
  DiagnosticAIResult,
  DiagnosticLaunchStage,
  DiagnosticMessage,
  DiagnosticPhoto,
  DiagnosticPhotoCategory,
  DiagnosticStatus,
  TechnicalMemoryAction,
  TechnicalMemoryFeedback,
  TechnicalMemoryRepairResult,
  UserPreferredLanguage
} from "../domain/types";
import { diagnosticAIService } from "../services/diagnosticAIService";
import {
  canStartDiagnostic,
  createDiagnosticArchiveTitle,
  createDiagnosticDraft,
  createDiagnosticLaunchError,
  createDiagnosticPhoto,
  createSystemDiagnosticMessage,
  getDiagnosticStatus
} from "../services/diagnosticService";
import { prepareDiagnosticImage, uploadDiagnosticPhoto, validateDiagnosticImage, type DiagnosticUploadProgress } from "../services/diagnosticUploadService";
import { getLanguageLabel, languageOptions, translate, type TranslationKey } from "../services/languageService";
import {
  buildTechnicalMemoryInsight,
  createTechnicalMemoryFeedback,
  technicalMemoryActionOptions,
  technicalMemoryCauseOptions,
  technicalMemoryCommentMaxLength,
  technicalMemoryFreeTextMaxLength,
  technicalMemoryResultOptions,
  validateTechnicalMemoryFeedbackInput,
  type TechnicalMemoryFeedbackInput
} from "../services/technicalMemoryService";
import { BrandLogo } from "./brand";

interface LocalDiagnosticPhoto {
  id: string;
  file: File;
  previewUrl: string;
  category: DiagnosticPhotoCategory;
}

type DiagnosticWorkflowStep =
  | "idle"
  | "preparing_photo"
  | "uploading"
  | "firestore_ready"
  | "function_called"
  | "reading_image"
  | "searching_fault"
  | "technical_memory"
  | "generating_diagnostic"
  | "result_saved"
  | "failed";

const photoCategories: Array<{ value: DiagnosticPhotoCategory; label: string }> = [
  { value: "plaque_signaletique", label: "Plaque signaletique" },
  { value: "code_erreur", label: "Code erreur ou defaut" },
  { value: "equipement", label: "Equipement" },
  { value: "carte_electronique", label: "Carte electronique" },
  { value: "mesure", label: "Mesure" },
  { value: "cablage", label: "Cablage" },
  { value: "composant", label: "Composant" },
  { value: "autre", label: "Autre" }
];

type DiagnosticTextKey =
  | "title"
  | "captureOnly"
  | "aiUnavailable"
  | "aiUnavailableShort"
  | "photoPlate"
  | "photoFault"
  | "extraPhotos"
  | "photoMinimum"
  | "singlePhotoPrecisionHint"
  | "multiplePhotoPrecisionHint"
  | "recommendedAdditionalPhotos";

function getDiagnosticText(language: UserPreferredLanguage, key: DiagnosticTextKey): string {
  const map: Record<DiagnosticTextKey, TranslationKey> = {
    title: "diagnostic",
    captureOnly: "captureOnly",
    aiUnavailable: "aiUnavailable",
    aiUnavailableShort: "aiUnavailableShort",
    photoPlate: "photoPlate",
    photoFault: "photoFault",
    extraPhotos: "extraPhotos",
    photoMinimum: "photoMinimum",
    singlePhotoPrecisionHint: "singlePhotoPrecisionHint",
    multiplePhotoPrecisionHint: "multiplePhotoPrecisionHint",
    recommendedAdditionalPhotos: "recommendedAdditionalPhotos"
  };
  return translate(language, map[key]);
}

export function LanguageSelectionScreen({
  user,
  onSelect,
  isSaving,
  error,
  t
}: {
  user: AppUser;
  onSelect: (language: AppUser["preferredLanguage"], label: string) => Promise<void>;
  isSaving: boolean;
  error?: string;
  t: (key: TranslationKey) => string;
}) {
  async function handleLanguageClick(language: AppUser["preferredLanguage"], label: string) {
    try {
      await onSelect(language, label);
    } catch (selectionError) {
      console.error("La langue n'a pas pu etre selectionnee.", selectionError);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <BrandLogo variant="hero" />
        <p className="eyebrow">{t("appName")}</p>
        <h1>{t("languageTitle")}</h1>
        <p className="muted">{user.displayName} - {t("languageIntro")}</p>
        {error && <p className="auth-error">{error}</p>}
        <div className="language-grid">
          {languageOptions.map((language) => (
            <button className="secondary" key={language.value} disabled={isSaving} onClick={() => void handleLanguageClick(language.value, language.label)}>
              {isSaving ? t("saving") : language.label}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

export function DiagnosticStartView({
  data,
  user,
  onSave,
  onSaveTechnicalMemory
}: {
  data: AppData;
  user: AppUser;
  onSave: (diagnostic: Diagnostic, photos: DiagnosticPhoto[], messages: DiagnosticMessage[]) => Promise<void>;
  onSaveTechnicalMemory: (feedback: TechnicalMemoryFeedback) => Promise<void>;
}) {
  const [photos, setPhotos] = useState<LocalDiagnosticPhoto[]>([]);
  const [isAnalyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [lastLaunchError, setLastLaunchError] = useState<Diagnostic["lastError"] | null>(null);
  const [conversation, setConversation] = useState<DiagnosticMessage[]>([]);
  const [preparedDiagnostic, setPreparedDiagnostic] = useState<Diagnostic | null>(null);
  const [preparedPhotos, setPreparedPhotos] = useState<DiagnosticPhoto[]>([]);
  const [analysisResult, setAnalysisResult] = useState<DiagnosticAIResult | null>(null);
  const [isSavingMemory, setSavingMemory] = useState(false);
  const [memoryInput, setMemoryInput] = useState<TechnicalMemoryFeedbackInput>({
    actualCause: "sonde_defectueuse",
    actions: [],
    repairResult: "repare",
    timeSpentMinutes: 0
  });
  const [memoryErrors, setMemoryErrors] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [workflowStatus, setWorkflowStatus] = useState<DiagnosticStatus | null>(null);
  const [workflowStep, setWorkflowStep] = useState<DiagnosticWorkflowStep>("idle");
  const [slowAnalysisWarning, setSlowAnalysisWarning] = useState("");
  const status = workflowStatus || getDiagnosticStatus(photos, isAnalyzing);
  const canAnalyze = canStartDiagnostic(photos);
  const aiAvailable = diagnosticAIService.isAvailable();
  const preferredLanguage = user.preferredLanguage || "fr";
  const photoGuidance = photos.length === 0
    ? getDiagnosticText(preferredLanguage, "photoMinimum")
    : photos.length === 1
      ? getDiagnosticText(preferredLanguage, "singlePhotoPrecisionHint")
      : getDiagnosticText(preferredLanguage, "multiplePhotoPrecisionHint");

  function addPhoto(file: File | undefined, category: DiagnosticPhotoCategory) {
    if (!file) return;
    try {
      validateDiagnosticImage(file);
      setError("");
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Image invalide.");
      return;
    }
    setPhotos((current) => [
      ...current,
      {
        id: `local-photo-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        category
      }
    ]);
  }

  function removePhoto(photoId: string) {
    setPhotos((current) => current.filter((photo) => photo.id !== photoId));
  }

  function updateCategory(photoId: string, category: DiagnosticPhotoCategory) {
    setPhotos((current) => current.map((photo) => (photo.id === photoId ? { ...photo, category } : photo)));
  }

  async function startAnalysis() {
    if (!canAnalyze || isAnalyzing || !aiAvailable) return;
    logDiagnosticEvent("diagnostic_click_received", { photoCount: photos.length, retryDiagnosticId: preparedDiagnostic?.status === "analysis_failed" ? preparedDiagnostic.id : undefined });
    setAnalyzing(true);
    setError("");
    setLastLaunchError(null);
    setSlowAnalysisWarning("");
    setAnalysisResult(null);
    setUploadProgress({});
    setWorkflowStatus("uploading_photos");
    setWorkflowStep("preparing_photo");
    let latestDiagnostic: Diagnostic | null = null;
    let latestPhotos: DiagnosticPhoto[] = [];
    let latestMessages: DiagnosticMessage[] = [];
    let slowTimer: number | undefined;
    const stageTimers: number[] = [];
    let currentStep: DiagnosticWorkflowStep = "preparing_photo";
    let currentStage: DiagnosticLaunchStage | string = "diagnostic_click_received";
    const moveToStep = (step: DiagnosticWorkflowStep) => {
      currentStep = step;
      setWorkflowStep(step);
    };
    const moveToStage = (stage: DiagnosticLaunchStage, details: Record<string, unknown> = {}) => {
      currentStage = stage;
      logDiagnosticEvent(stage, {
        diagnosticId: latestDiagnostic?.id,
        ...details
      });
    };
    try {
      const preparedLocalPhotos: LocalDiagnosticPhoto[] = [];
      for (const photo of photos) {
        moveToStage("image_preparation_started", { localPhotoId: photo.id, size: photo.file.size, type: photo.file.type });
        const preparedFile = await prepareDiagnosticImage(photo.file);
        moveToStage("image_preparation_completed", { localPhotoId: photo.id, originalSize: photo.file.size, preparedSize: preparedFile.size, type: preparedFile.type });
        preparedLocalPhotos.push({ ...photo, file: preparedFile });
      }
      moveToStep("firestore_ready");
      const diagnostic = preparedDiagnostic?.status === "analysis_failed"
        ? {
            ...preparedDiagnostic,
            status: "draft" as const,
            analysisError: undefined,
            lastError: undefined,
            updatedAt: new Date().toISOString()
          }
        : createDiagnosticDraft({
            companyId: data.company.id,
            technicianId: user.id,
            technicianName: user.displayName,
            preferredLanguage: user.preferredLanguage || "fr"
          });
      const diagnosticPhotos = preparedLocalPhotos.map((photo) =>
        createDiagnosticPhoto({
          diagnosticId: diagnostic.id,
          companyId: data.company.id,
          file: photo.file,
          category: photo.category,
          uploadedBy: user.id
        })
      );
      const uploadingDiagnostic: Diagnostic = {
        ...diagnostic,
        status: "uploading_photos",
        mainPhotoId: diagnosticPhotos[0]?.id,
        photoIds: diagnosticPhotos.map((photo) => photo.id),
        updatedAt: new Date().toISOString()
      };
      latestDiagnostic = uploadingDiagnostic;
      latestPhotos = [];
      moveToStage("diagnostic_created", { diagnosticId: diagnostic.id, photoCount: diagnosticPhotos.length });
      await onSave({ ...uploadingDiagnostic, mainPhotoId: undefined, photoIds: [] }, [], []);
      moveToStep("uploading");
      const uploadedPhotos = await Promise.all(
        diagnosticPhotos.map(async (photo, index) => {
          moveToStage("storage_upload_started", { diagnosticId: diagnostic.id, photoId: photo.id, storagePath: photo.storagePath });
          const uploaded = await uploadDiagnosticPhoto(photo, preparedLocalPhotos[index].file, (progress: DiagnosticUploadProgress) => {
            logDiagnosticEvent("diagnostic_upload_progress", { diagnosticId: diagnostic.id, photoId: progress.photoId, progress: progress.progress });
            setUploadProgress((current) => ({ ...current, [progress.photoId]: progress.progress }));
          }, {
            onEvent: (event, details) => {
              if (event === "storage_upload_first_progress") moveToStage("storage_upload_first_progress", details);
              else if (event === "storage_upload_completed") moveToStage("storage_upload_completed", details);
              else logDiagnosticEvent(event, details);
            }
          });
          return {
            ...photo,
            ...uploaded,
            analysisStatus: "pending" as const,
            updatedAt: new Date().toISOString()
          };
        })
      );
      latestPhotos = uploadedPhotos;
      await onSave(uploadingDiagnostic, uploadedPhotos, []);
      moveToStage("photo_metadata_saved", { diagnosticId: diagnostic.id, photoCount: uploadedPhotos.length });
      const readyDiagnostic: Diagnostic = {
        ...uploadingDiagnostic,
        status: "ready_for_analysis",
        updatedAt: new Date().toISOString()
      };
      setPreparedDiagnostic(readyDiagnostic);
      setPreparedPhotos(uploadedPhotos);
      latestDiagnostic = readyDiagnostic;
      latestPhotos = uploadedPhotos;
      setWorkflowStatus("ready_for_analysis");
      await onSave(readyDiagnostic, uploadedPhotos, []);
      moveToStage("diagnostic_ready_for_analysis", { diagnosticId: diagnostic.id });
      setWorkflowStatus("analyzing");
      moveToStep("function_called");
      slowTimer = window.setTimeout(() => {
        setSlowAnalysisWarning("L'analyse prend plus de temps que prevu. Polaris continue, mais vous pourrez reessayer si elle depasse le delai maximum.");
        logDiagnosticEvent("diagnostic_slow_warning", { diagnosticId: diagnostic.id, timeoutMs: 45_000 });
      }, 45_000);
      moveToStage("callable_invocation_started", { diagnosticId: diagnostic.id, payload: { diagnosticId: diagnostic.id }, region: "europe-west1" });
      moveToStep("reading_image");
      stageTimers.push(window.setTimeout(() => moveToStep("searching_fault"), 5_000));
      stageTimers.push(window.setTimeout(() => moveToStep("technical_memory"), 18_000));
      stageTimers.push(window.setTimeout(() => moveToStep("generating_diagnostic"), 30_000));
      const aiResponse = await diagnosticAIService.analyzeInitialPhotos({
        diagnosticId: diagnostic.id
      });
      if (slowTimer) window.clearTimeout(slowTimer);
      stageTimers.forEach((timer) => window.clearTimeout(timer));
      moveToStage("callable_invocation_completed", { diagnosticId: diagnostic.id, status: aiResponse.status });
      moveToStep("generating_diagnostic");
      if (aiResponse.status !== "completed" || !aiResponse.analysis?.result) {
        throw new Error(aiResponse.message || "Analyse impossible.");
      }
      const result = aiResponse.analysis.result;
      const message = createSystemDiagnosticMessage({
        diagnosticId: diagnostic.id,
        companyId: data.company.id,
        language: diagnostic.preferredLanguage,
        createdBy: user.id,
        content: aiResponse.message,
        sourceReferences: result.sourceReferences
      });
      const waitingDiagnostic: Diagnostic = {
        ...diagnostic,
        title: createDiagnosticArchiveTitle({
          brand: result.detectedBrand || undefined,
          errorCode: result.detectedErrorCode || undefined,
          shortFaultDescription: result.faultDescription || undefined
        }),
        detectedBrand: result.detectedBrand || undefined,
        detectedModel: result.detectedModel || undefined,
        detectedSerialNumber: result.detectedSerialNumber || undefined,
        detectedEquipmentType: result.detectedEquipmentType || undefined,
        detectedErrorCode: result.detectedErrorCode || undefined,
        shortFaultDescription: result.faultDescription || undefined,
        status: "awaiting_technician_input",
        mainPhotoId: uploadedPhotos[0]?.id,
        photoIds: uploadedPhotos.map((photo) => photo.id),
        messageCount: 1,
        documentIds: result.sourceReferences.map((source) => source.documentId).filter((id): id is string => Boolean(id)),
        sourceReferences: result.sourceReferences,
        analysisResult: result,
        technicalMemoryInsight: aiResponse.analysis.technicalMemoryInsight,
        analysisSummary: result.faultDescription || undefined,
        probableCauses: result.probableCauses,
        recommendedChecks: result.recommendedChecks,
        expectedMeasurements: result.expectedMeasurements,
        proposedSolutions: result.suggestedSolutions,
        safetyWarnings: result.safetyWarnings,
        confidenceLevel: result.confidenceLevel,
        promptVersion: result.promptVersion,
        modelUsed: result.modelUsed,
        analysisCompletedAt: result.analyzedAt,
        updatedAt: new Date().toISOString()
      };
      setConversation([message]);
      setPreparedDiagnostic(waitingDiagnostic);
      setPreparedPhotos(uploadedPhotos);
      setAnalysisResult(result);
      latestDiagnostic = waitingDiagnostic;
      latestPhotos = uploadedPhotos;
      latestMessages = [message];
      await onSave(waitingDiagnostic, uploadedPhotos, [message]);
      logDiagnosticEvent("diagnostic_result_saved", { diagnosticId: diagnostic.id, needsMoreInformation: result.needsMoreInformation });
      moveToStep("result_saved");
      setWorkflowStatus("awaiting_technician_input");
    } catch (analysisError) {
      if (slowTimer) window.clearTimeout(slowTimer);
      stageTimers.forEach((timer) => window.clearTimeout(timer));
      const launchError = createDiagnosticLaunchError(currentStage, analysisError);
      const message = getDiagnosticErrorMessage(analysisError, currentStage);
      if (currentStage === "callable_invocation_started") {
        moveToStage("callable_invocation_failed", { diagnosticId: latestDiagnostic?.id, code: launchError.code, message: launchError.message });
      }
      logDiagnosticEvent("diagnostic_failed", { diagnosticId: latestDiagnostic?.id, step: currentStep, stage: currentStage, code: launchError.code, message: launchError.message });
      setError(message);
      setLastLaunchError(launchError);
      setSlowAnalysisWarning("");
      moveToStep("failed");
      setWorkflowStatus("analysis_failed");
      if (latestDiagnostic) {
        const timestamp = new Date().toISOString();
        const failedDiagnostic: Diagnostic = {
          ...latestDiagnostic,
          status: "analysis_failed",
          analysisError: message,
          lastError: launchError,
          updatedAt: timestamp
        };
        setPreparedDiagnostic(failedDiagnostic);
        setPreparedPhotos(latestPhotos);
        await onSave(
          failedDiagnostic,
          latestPhotos,
          latestMessages
        );
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function finishDiagnostic() {
    if (!preparedDiagnostic || isSavingMemory) return;
    const validationErrors = validateTechnicalMemoryFeedbackInput(memoryInput);
    setMemoryErrors(validationErrors);
    if (validationErrors.length > 0) return;
    const timestamp = new Date().toISOString();
    setSavingMemory(true);
    try {
      const technicalMemoryFeedback = createTechnicalMemoryFeedback({
        diagnostic: preparedDiagnostic,
        technicianId: user.id,
        technicianName: user.displayName,
        feedback: memoryInput
      });
      await onSaveTechnicalMemory(technicalMemoryFeedback);
      const archivedDiagnostic: Diagnostic = {
        ...preparedDiagnostic,
        title: createDiagnosticArchiveTitle({
          brand: preparedDiagnostic.detectedBrand,
          errorCode: preparedDiagnostic.detectedErrorCode,
          shortFaultDescription: preparedDiagnostic.shortFaultDescription
        }),
        status: "archived",
        messageCount: conversation.length,
        analysisSummary: "Archive creee sans analyse IA connectee. Les photos et la conversation sont conservees pour une analyse future.",
        completedAt: timestamp,
        archivedAt: timestamp,
        updatedAt: timestamp
      };
      await onSave(archivedDiagnostic, preparedPhotos, conversation);
    } finally {
      setSavingMemory(false);
    }
  }

  const memoryInsight = preparedDiagnostic?.technicalMemoryInsight
    || (preparedDiagnostic
    ? buildTechnicalMemoryInsight({ diagnostic: preparedDiagnostic, feedbacks: data.technicalMemoryFeedbacks })
    : null);

  return (
    <section className="diagnostic-page">
      <div className="diagnostic-hero">
        <p className="eyebrow">Diagnostic chantier</p>
        <h2>{getLanguageLabel(preferredLanguage)} - {getDiagnosticText(preferredLanguage, "title")}</h2>
        <p className="muted">{getDiagnosticText(preferredLanguage, "captureOnly")}</p>
        {!aiAvailable && <p className="auth-error">{getDiagnosticText(preferredLanguage, "aiUnavailable")}</p>}
      </div>

      <div className="diagnostic-required-grid">
        <RequiredPhotoStep
          title={getDiagnosticText(preferredLanguage, "photoPlate")}
          category="plaque_signaletique"
          photos={photos}
          onAdd={addPhoto}
          onRemove={removePhoto}
          onCategoryChange={updateCategory}
        />
        <RequiredPhotoStep
          title={getDiagnosticText(preferredLanguage, "photoFault")}
          category="code_erreur"
          photos={photos}
          onAdd={addPhoto}
          onRemove={removePhoto}
          onCategoryChange={updateCategory}
        />
      </div>

      <AdditionalPhotosPanel
        photos={photos}
        language={preferredLanguage}
        onAdd={addPhoto}
        onRemove={removePhoto}
        onCategoryChange={updateCategory}
      />
      <p className={photos.length === 0 ? "auth-error" : "diagnostic-helper"}>{photoGuidance}</p>
      <DiagnosticProgress status={status} photoCount={photos.length} preferredLanguage={preferredLanguage} />
      <DiagnosticStepProgress step={workflowStep} uploadProgress={uploadProgress} />
      {error && <p className="auth-error">{error}</p>}
      {lastLaunchError && <DiagnosticErrorPanel error={lastLaunchError} diagnosticId={preparedDiagnostic?.id} />}
      {slowAnalysisWarning && <p className="notice">{slowAnalysisWarning}</p>}
      <button className="primary large sticky-action" disabled={!canAnalyze || isAnalyzing || !aiAvailable} onClick={startAnalysis}>
        <CheckCircle2 size={22} /> Diagnostic
      </button>
      {!aiAvailable && <p className="auth-error">{getDiagnosticText(preferredLanguage, "aiUnavailable")}</p>}
      {isAnalyzing && <DiagnosticAIAnimation state="analyzing" />}
      {!isAnalyzing && analysisResult && <DiagnosticAIAnimation state="completed" />}
      {analysisResult && <DiagnosticResultView result={analysisResult} language={preferredLanguage} onAddPhotos={() => window.scrollTo({ top: 0, behavior: "smooth" })} />}
      {memoryInsight && <TechnicalMemoryInsightView insight={memoryInsight} />}
      {analysisResult && (
        <TechnicalMemoryFeedbackForm
          value={memoryInput}
          errors={memoryErrors}
          onChange={setMemoryInput}
        />
      )}
      {conversation.length > 0 && (
        <>
          <DiagnosticConversation messages={conversation} />
          <button className="primary large" disabled={isSavingMemory} onClick={finishDiagnostic}>
            <Archive size={22} /> {isSavingMemory ? "Enregistrement..." : "Terminer le diagnostic"}
          </button>
        </>
      )}
    </section>
  );
}

function TechnicalMemoryInsightView({ insight }: { insight: NonNullable<ReturnType<typeof buildTechnicalMemoryInsight>> }) {
  return (
    <section className="technical-memory-card">
      <div className="section-title">
        <BrainCircuit size={20} />
        <strong>Retour d'experience Polaris</strong>
      </div>
      {insight.totalKnownCases === 0 ? (
        <p className="muted">Aucun cas similaire connu pour le moment.</p>
      ) : (
        <>
          <p>Sur {insight.totalKnownCases} diagnostic(s) similaire(s), Polaris a retrouve ces retours terrain.</p>
          <div className="detail-grid">
            <DetailLine label="Cause la plus frequente" value={insight.mostFrequentCause?.label || "Non renseignee"} />
            <DetailLine label="Temps moyen" value={insight.averageRepairTimeMinutes ? `${insight.averageRepairTimeMinutes} min` : "Non renseigne"} />
            <DetailLine label="Taux de reussite" value={`${insight.successRate}%`} />
            <DetailLine label="Cas connus" value={String(insight.totalKnownCases)} />
          </div>
          {insight.causeStats.length > 0 && (
            <div className="memory-stat-list">
              {insight.causeStats.slice(0, 4).map((item) => (
                <span key={item.cause}>{item.count} - {item.label}</span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TechnicalMemoryFeedbackForm({
  value,
  errors,
  onChange
}: {
  value: TechnicalMemoryFeedbackInput;
  errors: string[];
  onChange: (value: TechnicalMemoryFeedbackInput) => void;
}) {
  function toggleAction(action: TechnicalMemoryAction) {
    const actions = value.actions.includes(action)
      ? value.actions.filter((item) => item !== action)
      : [...value.actions, action];
    onChange({ ...value, actions });
  }

  return (
    <section className="technical-memory-card">
      <div className="section-title">
        <BrainCircuit size={20} />
        <strong>Memoire Technique Polaris</strong>
      </div>
      <label>
        Cause reellement trouvee
        <select value={value.actualCause} onChange={(event) => onChange({ ...value, actualCause: event.target.value as TechnicalMemoryFeedbackInput["actualCause"] })}>
          {technicalMemoryCauseOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      {value.actualCause === "autre" && (
        <label>
          Cause libre
          <input maxLength={technicalMemoryFreeTextMaxLength} value={value.actualCauseOther || ""} onChange={(event) => onChange({ ...value, actualCauseOther: event.target.value })} />
        </label>
      )}
      <div className="memory-checkbox-grid">
        {technicalMemoryActionOptions.map((option) => (
          <label className="memory-checkbox" key={option.value}>
            <input type="checkbox" checked={value.actions.includes(option.value)} onChange={() => toggleAction(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
      {value.actions.includes("autre") && (
        <label>
          Action libre
          <input maxLength={technicalMemoryFreeTextMaxLength} value={value.actionOther || ""} onChange={(event) => onChange({ ...value, actionOther: event.target.value })} />
        </label>
      )}
      <div className="memory-radio-row">
        {technicalMemoryResultOptions.map((option) => (
          <label className="memory-radio" key={option.value}>
            <input
              type="radio"
              name="repair-result"
              checked={value.repairResult === option.value}
              onChange={() => onChange({ ...value, repairResult: option.value as TechnicalMemoryRepairResult })}
            />
            {option.label}
          </label>
        ))}
      </div>
      <label>
        Temps passe (minutes)
        <input
          type="number"
          min="1"
          step="1"
          value={value.timeSpentMinutes || ""}
          onChange={(event) => onChange({ ...value, timeSpentMinutes: Number(event.target.value) })}
        />
      </label>
      <label>
        Commentaire libre
        <textarea maxLength={technicalMemoryCommentMaxLength} value={value.comment || ""} onChange={(event) => onChange({ ...value, comment: event.target.value })} rows={3} />
      </label>
      {errors.length > 0 && (
        <div className="error-box">
          {errors.map((item) => <p key={item}>{item}</p>)}
        </div>
      )}
    </section>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DiagnosticAIAnimation({ state }: { state: "analyzing" | "completed" }) {
  const isCompleted = state === "completed";
  return (
    <section className={`diagnostic-ai-state ${isCompleted ? "is-complete" : "is-analyzing"}`}>
      <div className="ai-orbit">
        <BrandLogo variant="mark" />
        <span />
      </div>
      <div>
        <strong>{isCompleted ? "Analyse IA Polaris terminee" : "Analyse IA Polaris en cours..."}</strong>
        <small>{isCompleted ? "Resultat structure valide et pret a consulter." : "Lecture des images, controle du contexte et validation du diagnostic."}</small>
      </div>
    </section>
  );
}

function DiagnosticStepProgress({ step, uploadProgress }: { step: DiagnosticWorkflowStep; uploadProgress: Record<string, number> }) {
  if (step === "idle") return null;
  const values = Object.values(uploadProgress);
  const average = values.length ? Math.round(values.reduce((sum, item) => sum + item, 0) / values.length) : null;
  return (
    <section className="diagnostic-progress">
      <strong>{getWorkflowStepLabel(step)}</strong>
      {step === "uploading" && average !== null ? <small>Televersement : {average}%</small> : <small>Progression par etapes, sans estimation artificielle.</small>}
    </section>
  );
}

function DiagnosticErrorPanel({ error, diagnosticId }: { error: NonNullable<Diagnostic["lastError"]>; diagnosticId?: string }) {
  return (
    <section className="error-box">
      <strong>{getStageUserTitle(error.stage)}</strong>
      <p>{error.message}</p>
      <small>Etape : {error.stage} - Code : {error.code}{diagnosticId ? ` - Diagnostic : ${diagnosticId}` : ""}</small>
      {error.serverResponse && <small>Storage : {error.serverResponse}</small>}
    </section>
  );
}

function DiagnosticResultView({
  result,
  language,
  onAddPhotos
}: {
  result: DiagnosticAIResult;
  language: UserPreferredLanguage;
  onAddPhotos: () => void;
}) {
  const recommendedAdditionalPhotos = result.recommendedAdditionalPhotos || [];
  return (
    <section className="diagnostic-conversation">
      {result.needsMoreInformation && (
        <article className="diagnostic-message-card needs-more-information">
          <strong>Informations complementaires necessaires</strong>
          <p className="muted">Polaris a produit un premier diagnostic, mais des photos complementaires peuvent ameliorer la fiabilite.</p>
          {recommendedAdditionalPhotos.length > 0 && (
            <ul>
              {recommendedAdditionalPhotos.map((photo) => (
                <li key={photo}>{photo}</li>
              ))}
            </ul>
          )}
          <button className="secondary" onClick={onAddPhotos}>
            <ImagePlus size={18} /> Ajouter des photos
          </button>
        </article>
      )}
      <h3>Equipement detecte</h3>
      <p>{[result.detectedBrand, result.detectedModel, result.detectedEquipmentType, result.detectedSerialNumber].filter(Boolean).join(" - ") || "Non identifie"}</p>
      <h3>Defaut detecte</h3>
      <p>{[result.detectedErrorCode, result.faultDescription].filter(Boolean).join(" - ") || "Non identifie"}</p>
      <h3>Controles recommandes</h3>
      {result.recommendedChecks.length === 0 ? <p className="muted">Aucun controle recommande avec certitude.</p> : result.recommendedChecks.map((check) => (
        <article className="diagnostic-message-card" key={`${check.order}-${check.title}`}>
          <strong>{check.order}. {check.title}</strong>
          <p>{check.instruction}</p>
          <small>{check.reason}</small>
        </article>
      ))}
      <h3>Niveau de confiance</h3>
      <p>{Math.round(result.confidenceLevel * 100)}%</p>
      {recommendedAdditionalPhotos.length > 0 && (
        <>
          <h3>{getDiagnosticText(language, "recommendedAdditionalPhotos")}</h3>
          <ul>
            {recommendedAdditionalPhotos.map((photo) => (
              <li key={photo}>{photo}</li>
            ))}
          </ul>
        </>
      )}
      <h3>Sources</h3>
      <p className="muted">{result.sourceReferences.length === 0 ? "Aucune documentation technique associee a cette premiere analyse." : `${result.sourceReferences.length} source(s)`}</p>
    </section>
  );
}

function getWorkflowStepLabel(step: DiagnosticWorkflowStep): string {
  const labels: Record<DiagnosticWorkflowStep, string> = {
    idle: "Diagnostic pret",
    preparing_photo: "Preparation de la photo",
    uploading: "Televersement",
    firestore_ready: "Preparation du dossier",
    function_called: "Lecture de l'image",
    reading_image: "Recherche du defaut",
    searching_fault: "Recherche du defaut",
    technical_memory: "Consultation de la memoire Polaris",
    generating_diagnostic: "Generation du diagnostic",
    result_saved: "Diagnostic enregistre",
    failed: "Diagnostic interrompu"
  };
  return labels[step];
}

function logDiagnosticEvent(event: string, details: Record<string, unknown> = {}): void {
  console.info(event, {
    ...details,
    at: new Date().toISOString()
  });
}

function getDiagnosticErrorMessage(error: unknown, stage?: string): string {
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  const message = rawMessage.toLowerCase();
  if (stage === "image_preparation_started" || stage === "image_preparation_completed") return `Echec de preparation de la photo : ${rawMessage}`;
  if (stage === "storage_upload_started" || stage === "storage_upload_first_progress") return `Echec du televersement : ${rawMessage}`;
  if (stage === "photo_metadata_saved" || stage === "diagnostic_created" || stage === "diagnostic_ready_for_analysis") return `Impossible d'enregistrer la photo : ${rawMessage}`;
  if (stage === "callable_invocation_started") return `Impossible de contacter l'IA Polaris : ${rawMessage}`;
  if (!navigator.onLine) return "Connexion Internet absente. Verifiez le reseau puis relancez le diagnostic.";
  if (message.includes("storage") || message.includes("televersement") || message.includes("upload")) return rawMessage;
  if (message.includes("permission") || message.includes("droits") || message.includes("unauthorized")) return "Droits insuffisants pour analyser ce diagnostic.";
  if (message.includes("90 secondes") || message.includes("timeout") || message.includes("deadline")) return "OpenAI ou la Function repond trop lentement. Le diagnostic a ete interrompu, vous pouvez reessayer.";
  if (message.includes("invalid") || message.includes("json")) return "La reponse IA est invalide. Relancez le diagnostic ou ajoutez une photo plus lisible.";
  if (message.includes("functions") || message.includes("function")) return "La Function de diagnostic est indisponible pour le moment.";
  if (message.includes("type mime") || message.includes("format image")) return "Type d'image non pris en charge. Utilisez JPEG, PNG ou WebP.";
  if (message.includes("volumineuse") || message.includes("too large")) return "Fichier trop lourd. Ajoutez une image plus legere ou reprenez la photo.";
  return rawMessage || "Le diagnostic a echoue. Vous pouvez reessayer.";
}

function getStageUserTitle(stage: string): string {
  if (stage.startsWith("image_preparation")) return "Echec de preparation de la photo";
  if (stage.startsWith("storage_upload")) return "Echec du televersement";
  if (["diagnostic_created", "photo_metadata_saved", "diagnostic_ready_for_analysis", "firestore_write_failed"].includes(stage)) return "Impossible d'enregistrer la photo";
  if (stage.startsWith("callable_invocation")) return "Impossible de contacter l'IA Polaris";
  return "Diagnostic interrompu";
}

function RequiredPhotoStep({
  title,
  category,
  photos,
  onAdd,
  onRemove,
  onCategoryChange
}: {
  title: string;
  category: DiagnosticPhotoCategory;
  photos: LocalDiagnosticPhoto[];
  onAdd: (file: File | undefined, category: DiagnosticPhotoCategory) => void;
  onRemove: (photoId: string) => void;
  onCategoryChange: (photoId: string, category: DiagnosticPhotoCategory) => void;
}) {
  const matchingPhotos = photos.filter((photo) => photo.category === category);
  return (
    <section className="diagnostic-step">
      <h3>{title}</h3>
      <PhotoCaptureButton category={category} onAdd={onAdd} />
      <PhotoPreviewGrid photos={matchingPhotos} onRemove={onRemove} onCategoryChange={onCategoryChange} />
    </section>
  );
}

function AdditionalPhotosPanel({
  photos,
  language,
  onAdd,
  onRemove,
  onCategoryChange
}: {
  photos: LocalDiagnosticPhoto[];
  language: UserPreferredLanguage;
  onAdd: (file: File | undefined, category: DiagnosticPhotoCategory) => void;
  onRemove: (photoId: string) => void;
  onCategoryChange: (photoId: string, category: DiagnosticPhotoCategory) => void;
}) {
  const additionalPhotos = photos.filter((photo) => !["plaque_signaletique", "code_erreur"].includes(photo.category));
  return (
    <section className="diagnostic-step">
      <h3>{getDiagnosticText(language, "extraPhotos")}</h3>
      <PhotoCaptureButton category="autre" onAdd={onAdd} />
      <PhotoPreviewGrid photos={additionalPhotos} onRemove={onRemove} onCategoryChange={onCategoryChange} />
    </section>
  );
}

function PhotoCaptureButton({ category, onAdd }: { category: DiagnosticPhotoCategory; onAdd: (file: File | undefined, category: DiagnosticPhotoCategory) => void }) {
  return (
    <div className="capture-actions">
      <label className="photo-button">
        <Camera size={22} /> Photo
        <input hidden type="file" accept="image/*" capture="environment" onChange={(event) => onAdd(event.target.files?.[0], category)} />
      </label>
      <label className="secondary">
        <ImagePlus size={22} /> Galerie
        <input hidden type="file" accept="image/*" onChange={(event) => onAdd(event.target.files?.[0], category)} />
      </label>
    </div>
  );
}

function PhotoPreviewGrid({
  photos,
  onRemove,
  onCategoryChange
}: {
  photos: LocalDiagnosticPhoto[];
  onRemove: (photoId: string) => void;
  onCategoryChange: (photoId: string, category: DiagnosticPhotoCategory) => void;
}) {
  if (photos.length === 0) return <p className="muted">Aucune photo ajoutee.</p>;
  return (
    <div className="diagnostic-photo-grid">
      {photos.map((photo) => (
        <article className="diagnostic-photo-card" key={photo.id}>
          <img src={photo.previewUrl} alt={photo.file.name} />
          <select value={photo.category} onChange={(event) => onCategoryChange(photo.id, event.target.value as DiagnosticPhotoCategory)}>
            {photoCategories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
          <button className="secondary" onClick={() => onRemove(photo.id)}>
            <Trash2 size={18} /> Supprimer
          </button>
        </article>
      ))}
    </div>
  );
}

function DiagnosticProgress({ status, photoCount, preferredLanguage }: { status: string; photoCount: number; preferredLanguage: UserPreferredLanguage }) {
  return (
    <section className="diagnostic-progress">
      <strong>Etat : {status.replaceAll("_", " ")}</strong>
      <small>
        {photoCount} photo(s) ajoutee(s) - langue de travail : {getLanguageLabel(preferredLanguage)}
      </small>
    </section>
  );
}

function DiagnosticConversation({ messages }: { messages: DiagnosticMessage[] }) {
  return (
    <section className="diagnostic-conversation">
      <h3>Conversation de diagnostic</h3>
      {messages.map((message) => (
        <article className="diagnostic-message-card" key={message.id}>
          <strong>{message.role}</strong>
          <p>{message.content}</p>
        </article>
      ))}
    </section>
  );
}

export function DiagnosticArchivesView({ data, query, onQueryChange }: { data: AppData; query: string; onQueryChange: (query: string) => void }) {
  const archives = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.diagnostics
      .filter((diagnostic) => diagnostic.status === "archived")
      .filter((diagnostic) =>
        [diagnostic.title, diagnostic.detectedBrand, diagnostic.detectedModel, diagnostic.detectedErrorCode, diagnostic.analysisSummary]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalized)
      );
  }, [data.diagnostics, query]);

  return (
    <section className="stack">
      <div className="search-box">
        <FileText size={20} />
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Marque, modele, code erreur, resume..." />
      </div>
      {archives.length === 0 ? (
        <article className="empty-state">
          <FileText size={24} />
          <strong>Aucun diagnostic archive</strong>
          <small>Les diagnostics termines apparaitront ici automatiquement.</small>
        </article>
      ) : (
        archives.map((diagnostic) => <DiagnosticArchiveCard key={diagnostic.id} diagnostic={diagnostic} photoCount={diagnostic.photoIds.length} />)
      )}
    </section>
  );
}

function DiagnosticArchiveCard({ diagnostic, photoCount }: { diagnostic: Diagnostic; photoCount: number }) {
  return (
    <article className="diagnostic-archive-card">
      <strong>{diagnostic.title}</strong>
      <small>
        {[diagnostic.detectedBrand, diagnostic.detectedModel, diagnostic.detectedErrorCode].filter(Boolean).join(" - ") || "Equipement non identifie"}
      </small>
      <span className="tag-row">
        <span>{new Date(diagnostic.createdAt).toLocaleDateString("fr-FR")}</span>
        <span>{diagnostic.technicianName}</span>
        <span>{photoCount} photo(s)</span>
        <span>{diagnostic.documentIds.length} document(s)</span>
      </span>
      <p className="muted">{diagnostic.analysisSummary || "Resume en attente d'une analyse IA connectee."}</p>
    </article>
  );
}
