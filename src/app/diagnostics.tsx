import { useMemo, useState } from "react";
import { Archive, Camera, CheckCircle2, FileText, ImagePlus, Plus, Trash2 } from "lucide-react";
import type { AppData, AppUser, Diagnostic, DiagnosticAIResult, DiagnosticMessage, DiagnosticPhoto, DiagnosticPhotoCategory, UserPreferredLanguage } from "../domain/types";
import { diagnosticAIService } from "../services/diagnosticAIService";
import {
  canStartDiagnostic,
  createDiagnosticArchiveTitle,
  createDiagnosticDraft,
  createDiagnosticPhoto,
  createSystemDiagnosticMessage,
  getDiagnosticStatus
} from "../services/diagnosticService";
import { uploadDiagnosticPhoto, validateDiagnosticImage, type DiagnosticUploadProgress } from "../services/diagnosticUploadService";
import { getLanguageLabel, languageOptions, translate, type TranslationKey } from "../services/languageService";

interface LocalDiagnosticPhoto {
  id: string;
  file: File;
  previewUrl: string;
  category: DiagnosticPhotoCategory;
}

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

type DiagnosticTextKey = "title" | "captureOnly" | "aiUnavailable" | "aiUnavailableShort" | "photoPlate" | "photoFault" | "extraPhotos";

function getDiagnosticText(language: UserPreferredLanguage, key: DiagnosticTextKey): string {
  const map: Record<DiagnosticTextKey, TranslationKey> = {
    title: "diagnostic",
    captureOnly: "captureOnly",
    aiUnavailable: "aiUnavailable",
    aiUnavailableShort: "aiUnavailableShort",
    photoPlate: "photoPlate",
    photoFault: "photoFault",
    extraPhotos: "extraPhotos"
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
        <div className="brand-mark">P</div>
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
  onSave
}: {
  data: AppData;
  user: AppUser;
  onSave: (diagnostic: Diagnostic, photos: DiagnosticPhoto[], messages: DiagnosticMessage[]) => Promise<void>;
}) {
  const [photos, setPhotos] = useState<LocalDiagnosticPhoto[]>([]);
  const [isAnalyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [conversation, setConversation] = useState<DiagnosticMessage[]>([]);
  const [preparedDiagnostic, setPreparedDiagnostic] = useState<Diagnostic | null>(null);
  const [preparedPhotos, setPreparedPhotos] = useState<DiagnosticPhoto[]>([]);
  const [analysisResult, setAnalysisResult] = useState<DiagnosticAIResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const status = getDiagnosticStatus(photos, isAnalyzing);
  const canAnalyze = canStartDiagnostic(photos);
  const aiAvailable = diagnosticAIService.isAvailable();

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
    setAnalyzing(true);
    setError("");
    setAnalysisResult(null);
    try {
      const diagnostic = createDiagnosticDraft({
        companyId: data.company.id,
        technicianId: user.id,
        technicianName: user.displayName,
        preferredLanguage: user.preferredLanguage || "fr"
      });
      const diagnosticPhotos = photos.map((photo) =>
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
      await onSave(uploadingDiagnostic, diagnosticPhotos, []);
      const uploadedPhotos = await Promise.all(
        diagnosticPhotos.map(async (photo, index) => {
          const uploaded = await uploadDiagnosticPhoto(photo, photos[index].file, (progress: DiagnosticUploadProgress) => {
            setUploadProgress((current) => ({ ...current, [progress.photoId]: progress.progress }));
          });
          return {
            ...photo,
            ...uploaded,
            analysisStatus: "pending" as const,
            updatedAt: new Date().toISOString()
          };
        })
      );
      const analyzingDiagnostic: Diagnostic = {
        ...uploadingDiagnostic,
        status: "analyzing",
        updatedAt: new Date().toISOString()
      };
      await onSave(analyzingDiagnostic, uploadedPhotos, []);
      const aiResponse = await diagnosticAIService.analyzeInitialPhotos({
        diagnosticId: diagnostic.id
      });
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
      await onSave(waitingDiagnostic, uploadedPhotos, [message]);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Le diagnostic n'a pas pu etre prepare.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function finishDiagnostic() {
    if (!preparedDiagnostic) return;
    const timestamp = new Date().toISOString();
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
  }

  return (
    <section className="diagnostic-page">
      <div className="diagnostic-hero">
        <p className="eyebrow">Diagnostic chantier</p>
        <h2>{getLanguageLabel(user.preferredLanguage || "fr")} - {getDiagnosticText(user.preferredLanguage || "fr", "title")}</h2>
        <p className="muted">{getDiagnosticText(user.preferredLanguage || "fr", "captureOnly")}</p>
        <p className="auth-error">{getDiagnosticText(user.preferredLanguage || "fr", "aiUnavailable")}</p>
      </div>

      <div className="diagnostic-required-grid">
        <RequiredPhotoStep
          title={getDiagnosticText(user.preferredLanguage || "fr", "photoPlate")}
          category="plaque_signaletique"
          photos={photos}
          onAdd={addPhoto}
          onRemove={removePhoto}
          onCategoryChange={updateCategory}
        />
        <RequiredPhotoStep
          title={getDiagnosticText(user.preferredLanguage || "fr", "photoFault")}
          category="code_erreur"
          photos={photos}
          onAdd={addPhoto}
          onRemove={removePhoto}
          onCategoryChange={updateCategory}
        />
      </div>

      <AdditionalPhotosPanel
        photos={photos}
        language={user.preferredLanguage || "fr"}
        onAdd={addPhoto}
        onRemove={removePhoto}
        onCategoryChange={updateCategory}
      />
      <DiagnosticProgress status={status} photoCount={photos.length} preferredLanguage={user.preferredLanguage || "fr"} />
      {error && <p className="auth-error">{error}</p>}
      <button className="primary large sticky-action" disabled={!canAnalyze || isAnalyzing || !aiAvailable} onClick={startAnalysis}>
        <CheckCircle2 size={22} /> {isAnalyzing ? "Analyse en cours..." : canAnalyze ? "Pret pour l'analyse" : "Ajouter les deux photos"}
      </button>
      {!aiAvailable && <p className="auth-error">{getDiagnosticText(user.preferredLanguage || "fr", "aiUnavailable")}</p>}
      {Object.keys(uploadProgress).length > 0 && <DiagnosticUploadProgress progress={uploadProgress} />}
      {analysisResult && <DiagnosticResultView result={analysisResult} />}
      {conversation.length > 0 && (
        <>
          <DiagnosticConversation messages={conversation} />
          <button className="primary large" onClick={finishDiagnostic}>
            <Archive size={22} /> Terminer le diagnostic
          </button>
        </>
      )}
    </section>
  );
}

function DiagnosticUploadProgress({ progress }: { progress: Record<string, number> }) {
  const values = Object.values(progress);
  const average = values.length ? Math.round(values.reduce((sum, item) => sum + item, 0) / values.length) : 0;
  return (
    <section className="diagnostic-progress">
      <strong>Televersement en cours</strong>
      <small>{average}%</small>
    </section>
  );
}

function DiagnosticResultView({ result }: { result: DiagnosticAIResult }) {
  return (
    <section className="diagnostic-conversation">
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
      <h3>Sources</h3>
      <p className="muted">{result.sourceReferences.length === 0 ? "Aucune documentation technique associee a cette premiere analyse." : `${result.sourceReferences.length} source(s)`}</p>
    </section>
  );
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
      <small>L'IA multimodale n'est pas encore connectee. Polaris prepare le parcours, les sources et l'archive.</small>
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
