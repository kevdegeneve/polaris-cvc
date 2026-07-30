import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  Crop,
  FileArchive,
  FileText,
  FolderOpen,
  ImagePlus,
  Home,
  Link2,
  LogOut,
  Plus,
  RotateCw,
  ScanLine,
  Search,
  ShieldCheck,
  Star,
  Upload,
  Users,
  Wrench
} from "lucide-react";
import {
  AppData,
  AppUser,
  DocumentImportCandidate,
  EquipmentIdentification,
  ImageCropSettings,
  InterventionDraft,
  InterventionResult,
  ProductFamily,
  TechnicalDocument,
  TechnicalDocumentType,
  DocumentLanguage,
  TechnicalMemoryFeedback
} from "../domain/types";
import { makeSearchIndex, validateInterventionDraft } from "../domain/validation";
import { AppShell, UserAvatar } from "./dashboard";
import type { DashboardView } from "./dashboardModel";
import { DiagnosticArchivesView, DiagnosticStartView, LanguageSelectionScreen } from "./diagnostics";
import {
  buildDocumentSearchIndex,
  createImportCandidates,
  documentTypeOptions,
  findDocumentsForEquipment,
  languageOptions,
  productFamilyOptions,
  searchTechnicalDocuments
} from "../services/documentLibraryService";
import {
  AuthAccessDeniedError,
  ensureUserProfile,
  getFirebaseAuthState,
  signInWithGoogle,
  signOutCurrentSession,
  type AuthSession
} from "../services/authService";
import { createFirebaseServices } from "../services/firebaseClient";
import { identificationService } from "../services/identificationService";
import { createTranslator, hasConfiguredLanguage, getLanguageLabel, type TranslationKey } from "../services/languageService";
import { createEmptyData } from "../services/localRepository";
import { createAppRepository, type AppRepository } from "../services/repository";
import { openPrintableReport } from "../services/reportService";
import { BrandLogo, PolarisLoader } from "./brand";

type View =
  | DashboardView
  | "new"
  | "active"
  | "interventions"
  | "detail"
  | "customers"
  | "sites"
  | "equipment"
  | "profile"
;

const defaultView: DashboardView = "diagnosticNew";

function viewFromPath(pathname: string): DashboardView {
  if (pathname === "/documents") return "documents";
  if (pathname === "/archives") return "diagnostics";
  if (pathname === "/settings") return "company";
  return "diagnosticNew";
}

function pathForView(view: DashboardView): string {
  const paths: Record<DashboardView, string> = {
    diagnosticNew: "/diagnostics/new",
    documents: "/documents",
    diagnostics: "/archives",
    company: "/settings"
  };
  return paths[view];
}

const emptyDraft: InterventionDraft = {
  customerId: "",
  siteId: "",
  equipmentId: "",
  title: "",
  requestedBy: "",
  customerRequest: "",
  observedSymptom: "",
  checksPerformed: "",
  measures: "",
  diagnosis: "",
  workDone: "",
  finalResult: "",
  recommendations: "",
  resultStatus: "a_surveiller",
  contentStatus: "brouillon"
};

export function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [appRepository, setAppRepository] = useState<AppRepository>(() => createAppRepository());
  const [authError, setAuthError] = useState("");
  const [accessDenied, setAccessDenied] = useState<{ email: string; reason: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [languageError, setLanguageError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState<View>(() => viewFromPath(window.location.pathname));
  const [data, setData] = useState(() => createEmptyData());
  const [selectedInterventionId, setSelectedInterventionId] = useState(data.interventions[0]?.id ?? "");
  const [draft, setDraft] = useState<InterventionDraft>(emptyDraft);
  const [query, setQuery] = useState("");
  const [documentQuery, setDocumentQuery] = useState("");
  const [documentFamily, setDocumentFamily] = useState<ProductFamily | "">("");
  const [documentType, setDocumentType] = useState<TechnicalDocumentType | "">("");
  const [documentLanguage, setDocumentLanguage] = useState<DocumentLanguage | "">("");
  const [diagnosticQuery, setDiagnosticQuery] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const firebaseReady = useMemo(() => Boolean(createFirebaseServices()), []);

  const isAuthenticated = Boolean(session);
  const currentUser = useMemo<AppUser>(() => {
    const existing = data.users.find((item) => item.id === session?.userId);
    if (existing) return existing;
    return {
      id: session?.userId || "",
      uid: session?.userId,
      companyId: session?.companyId || data.company.id,
      displayName: session?.displayName || "Utilisateur Polaris",
      email: session?.email || "",
      role: (session?.role as AppUser["role"]) || "admin",
      photoURL: session?.photoURL,
      preferredLanguage: session?.preferredLanguage as AppUser["preferredLanguage"],
      preferredLanguageLabel: session?.preferredLanguageLabel,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }, [data.company.id, data.users, session]);
  const selectedIntervention = data.interventions.find((item) => item.id === selectedInterventionId);
  const activeInterventions = data.interventions.filter((item) => item.contentStatus === "brouillon");
  const t = useMemo(() => createTranslator(currentUser.preferredLanguage), [currentUser.preferredLanguage]);

  const filteredInterventions = useMemo(() => {
    const normalized = makeSearchIndex([query]);
    if (!normalized) return data.interventions;
    return data.interventions.filter((intervention) => {
      const customer = data.customers.find((item) => item.id === intervention.customerId);
      const site = data.sites.find((item) => item.id === intervention.siteId);
      const equipment = data.equipment.find((item) => item.id === intervention.equipmentId);
      return makeSearchIndex([
        intervention.number,
        intervention.title,
        intervention.customerRequest,
        intervention.observedSymptom,
        intervention.diagnosis,
        customer?.name,
        site?.name,
        equipment?.brand,
        equipment?.model
      ]).includes(normalized);
    });
  }, [data, query]);

  function openIntervention(interventionId: string) {
    setSelectedInterventionId(interventionId);
    setView("detail");
  }

  function navigateTo(nextView: DashboardView, mode: "push" | "replace" = "push") {
    setView(nextView);
    const nextPath = pathForView(nextView);
    if (window.location.pathname !== nextPath) {
      window.history[mode === "replace" ? "replaceState" : "pushState"]({}, "", nextPath);
    }
  }

  useEffect(() => {
    if (window.location.pathname === "/") {
      navigateTo(defaultView, "replace");
    }
    function handlePopState() {
      setView(viewFromPath(window.location.pathname));
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const unsubscribe = getFirebaseAuthState((user) => {
      if (!user) {
        setSession(null);
        setIsAuthReady(true);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      void ensureUserProfile(user)
        .then(async (nextSession) => {
          setAccessDenied(null);
          setSession(nextSession);
          await loadData(nextSession.userId, nextSession);
        })
        .catch((error) => {
          setSession(null);
          const reason = error instanceof Error ? error.message : "Connexion impossible.";
          if (error instanceof AuthAccessDeniedError) {
            setAccessDenied({ email: error.email, reason });
            void signOutCurrentSession();
          } else {
            setAuthError(reason);
          }
        })
        .finally(() => {
          setIsAuthReady(true);
          setIsLoading(false);
        });
    });
    if (!unsubscribe) {
      setIsAuthReady(true);
      setAuthError("Firebase n'est pas configure. Renseignez les variables d'environnement pour vous connecter.");
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  async function loadData(userId?: string, activeSession = session) {
    setIsLoading(true);
    setAuthError("");
    try {
      const nextRepository = createAppRepository(userId);
      const nextData = await nextRepository.load(userId);
      setAppRepository(nextRepository);
      setData(nextData);
      setSelectedInterventionId(nextData.interventions[0]?.id ?? "");
      setStatusMessage(nextRepository.mode === "firestore" ? "Mode cloud Firestore actif." : "Mode local actif.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Chargement impossible.");
      const fallbackRepository = createAppRepository();
      const fallbackData = await fallbackRepository.load();
      setAppRepository(fallbackRepository);
      setData(fallbackData);
      if (activeSession) setSession(activeSession);
      setStatusMessage("Donnees cloud indisponibles. Mode local de secours actif pour cette session.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsLoading(true);
    setAuthError("");
    setAccessDenied(null);
    try {
      const nextSession = await signInWithGoogle();
      setSession(nextSession);
      await loadData(nextSession.userId, nextSession);
      setStatusMessage("Connexion Google active.");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Connexion impossible.";
      if (error instanceof AuthAccessDeniedError) {
        setAccessDenied({ email: error.email, reason });
      } else {
        setAuthError(reason);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function submitIntervention() {
    const result = validateInterventionDraft(draft);
    setErrors(result.errors);
    if (!result.ok) return;
    const next = await appRepository.createIntervention(data, draft, currentUser.id);
    setData(next);
    const created = next.interventions[0];
    setSelectedInterventionId(created.id);
    setDraft(emptyDraft);
    setView("detail");
  }

  async function addPhoto(file: File, interventionId: string) {
    const reader = new FileReader();
    reader.onload = async () => {
      const next = await appRepository.addMedia(data, interventionId, file, String(reader.result));
      setData(next);
    };
    reader.readAsDataURL(file);
  }

  async function importDocumentFolder(files: File[]) {
    const supportedFiles = files.filter((file) => file.type === "application/pdf" || file.type.startsWith("image/") || file.name.match(/\.(pdf|png|jpe?g|webp)$/i));
    if (supportedFiles.length === 0) return;
    const candidates = createImportCandidates(supportedFiles, data.company.id, currentUser.id);
    setData(await appRepository.importDocumentCandidates(data, candidates, currentUser.id));
  }

  async function addDocumentFromCandidate(candidate: DocumentImportCandidate) {
    const document: Omit<TechnicalDocument, "id" | "companyId" | "createdAt" | "updatedAt"> = {
      title: candidate.proposedTitle,
      brand: candidate.proposedBrand || "A classer",
      productFamily: candidate.proposedProductFamily,
      model: candidate.proposedModel,
      compatibleModel: candidate.proposedModel,
      documentType: candidate.proposedDocumentType,
      language: candidate.proposedLanguage,
      year: candidate.proposedYear,
      keywords: candidate.proposedKeywords,
      tags: candidate.proposedProductFamily ? [candidate.proposedProductFamily] : [],
      category: candidate.proposedDocumentType,
      source: "Import dossier local",
      sourceType: "import_dossier",
      addedByUserId: currentUser.id,
      officialStatus: "a_verifier",
      fileName: candidate.fileName,
      fileType: candidate.fileType,
      fileSize: candidate.fileSize,
      storagePath: `pending-local-import/${candidate.batchId}/${candidate.fileName}`,
      searchIndex: "",
      indexStatus: "metadonnees"
    };
    document.searchIndex = buildDocumentSearchIndex(document);
    setData(await appRepository.addDocument(data, document));
  }

  async function toggleDocumentFavorite(documentId: string) {
    setData(await appRepository.toggleDocumentFavorite(data, documentId, currentUser.id));
  }

  async function recordDocumentView(documentId: string) {
    setData(await appRepository.recordDocumentView(data, documentId, currentUser.id));
  }

  async function updatePreferredLanguage(language: AppUser["preferredLanguage"], label: string) {
    setLanguageError("");
    if (!language) {
      const message = "Selection de langue invalide.";
      console.error(message);
      setLanguageError(message);
      return;
    }
    setIsLoading(true);
    try {
      const nextData = await appRepository.updateUserLanguage(data, currentUser.id, language, label);
      setData(nextData);
      setSession((current) =>
        current
          ? {
              ...current,
              preferredLanguage: language,
              preferredLanguageLabel: label
            }
          : current
      );
      navigateTo(defaultView, "replace");
    } catch (error) {
      const message = error instanceof Error ? error.message : "La langue n'a pas pu etre enregistree.";
      console.error(message, error);
      setLanguageError(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveDiagnostic(diagnostic: AppData["diagnostics"][number], photos: AppData["diagnosticPhotos"], messages: AppData["diagnosticMessages"]) {
    setData(await appRepository.saveDiagnostic(data, diagnostic, photos, messages));
  }

  async function saveTechnicalMemoryFeedback(feedback: TechnicalMemoryFeedback) {
    setData(await appRepository.saveTechnicalMemoryFeedback(data, feedback));
  }

  async function handleSignOut() {
    await signOutCurrentSession();
    setSession(null);
    setAccessDenied(null);
    navigateTo(defaultView, "replace");
    setStatusMessage("");
  }

  async function useAnotherAccount() {
    await signOutCurrentSession();
    setSession(null);
    setAccessDenied(null);
    setAuthError("");
    await handleGoogleSignIn();
  }

  if (!isAuthReady) {
    return (
      <main className="login-screen">
        <section className="login-panel">
          <BrandLogo variant="hero" />
          <PolarisLoader label="Initialisation de Polaris..." />
          <p className="eyebrow">Polaris CVC</p>
          <h1>{t("loadingTitle")}</h1>
          <p className="muted">{t("loadingText")}</p>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    if (accessDenied) {
      return (
        <AccessDeniedView
          email={accessDenied.email}
          reason={accessDenied.reason}
          isLoading={isLoading}
          onUseAnotherAccount={useAnotherAccount}
          onSignOut={handleSignOut}
        />
      );
    }

    return (
      <main className="login-screen">
        <section className="login-panel">
          <BrandLogo variant="hero" />
          <p className="eyebrow">Polaris CVC</p>
          <h1>{t("loginTitle")}</h1>
          <p className="muted">{t("loginText")}</p>
          <p className={firebaseReady ? "notice" : "auth-error"}>
            {firebaseReady ? t("firebaseReady") : t("firebaseMissing")}
          </p>
          {statusMessage && <p className="notice">{statusMessage}</p>}
          {authError && <p className="auth-error">{authError}</p>}
          <button className="primary large" disabled={isLoading || !firebaseReady} onClick={handleGoogleSignIn}>
            <ShieldCheck size={22} /> {isLoading ? t("signingIn") : t("continueGoogle")}
          </button>
        </section>
      </main>
    );
  }

  if (!hasConfiguredLanguage(currentUser.preferredLanguage)) {
    return (
      <LanguageSelectionScreen
        user={currentUser}
        isSaving={isLoading}
        error={languageError}
        t={t}
        onSelect={(language, label) => updatePreferredLanguage(language, label || getLanguageLabel(language || "fr"))}
      />
    );
  }

  return (
    <AppShell
      data={data}
      user={currentUser}
      activeView={view}
      title={titleForView(view, t)}
      onNavigate={(nextView) => navigateTo(nextView)}
      onSignOut={handleSignOut}
    >
        {view === "diagnosticNew" && (
          <DiagnosticStartView data={data} user={currentUser} onSave={saveDiagnostic} onSaveTechnicalMemory={saveTechnicalMemoryFeedback} />
        )}

        {view === "diagnostics" && (
          <DiagnosticArchivesView data={data} query={diagnosticQuery} onQueryChange={setDiagnosticQuery} />
        )}

        {view === "new" && (
          <InterventionForm
            data={data}
            draft={draft}
            errors={errors}
            setDraft={setDraft}
            onSubmit={submitIntervention}
          />
        )}

        {view === "active" && (
          <InterventionList
            data={data}
            interventions={activeInterventions}
            onOpen={openIntervention}
            emptyText={t("noCurrentIntervention")}
          />
        )}

        {view === "interventions" && (
          <section className="stack">
            <div className="search-box">
              <Search size={20} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher client, panne, modele..."
              />
            </div>
            <InterventionList data={data} interventions={filteredInterventions} onOpen={openIntervention} />
          </section>
        )}

        {view === "detail" && selectedIntervention && (
          <InterventionDetail
            data={data}
            intervention={selectedIntervention}
            onPhoto={addPhoto}
            onReport={() => openPrintableReport(data, selectedIntervention)}
            onComplete={async () => setData(await appRepository.updateInterventionStatus(data, selectedIntervention.id, "termine"))}
          />
        )}

        {view === "customers" && (
          <SimpleList
            emptyTitle="Aucun client"
            emptyDescription="Les clients reels apparaitront ici apres creation ou synchronisation."
            items={data.customers.map((item) => ({
              id: item.id,
              title: item.name,
              subtitle: `${item.contactName} - ${item.phone}`
            }))}
          />
        )}

        {view === "sites" && (
          <SimpleList
            emptyTitle="Aucun site"
            emptyDescription="Les sites reels apparaitront ici apres creation ou synchronisation."
            items={data.sites.map((item) => ({
              id: item.id,
              title: item.name,
              subtitle: item.address
            }))}
          />
        )}

        {view === "equipment" && (
          <SimpleList
            emptyTitle="Aucun equipement"
            emptyDescription="Les equipements reels apparaitront ici apres creation ou synchronisation."
            items={data.equipment.map((item) => ({
              id: item.id,
              title: item.label,
              subtitle: `${item.brand} ${item.model} - ${item.serialNumber || "SN non renseigne"}`
            }))}
          />
        )}

        {view === "documents" && (
          <TechnicalLibraryView
            data={data}
            userId={currentUser.id}
            query={documentQuery}
            productFamily={documentFamily}
            documentType={documentType}
            language={documentLanguage}
            onQueryChange={setDocumentQuery}
            onProductFamilyChange={setDocumentFamily}
            onDocumentTypeChange={setDocumentType}
            onLanguageChange={setDocumentLanguage}
            onImportFolder={importDocumentFolder}
            onCreateDocument={addDocumentFromCandidate}
            onToggleFavorite={toggleDocumentFavorite}
            onOpenDocument={recordDocumentView}
          />
        )}

        {view === "profile" && (
          <section className="stack">
            <article className="profile-card">
              <UserAvatar user={currentUser} size="large" />
              <div>
                <strong>{currentUser.displayName}</strong>
                <small>{currentUser.email}</small>
                <span className="status-pill">{roleLabel(currentUser.role)}</span>
              </div>
            </article>
            <InfoCard title={t("storage")} subtitle={appRepository.mode === "firestore" ? t("firestoreActive") : t("localMode")} icon={<ShieldCheck />} />
            <button className="secondary" onClick={handleSignOut}>
              <LogOut size={20} /> {t("signOut")}
            </button>
          </section>
        )}

        {view === "company" && (
          <section className="stack">
            <InfoCard title={data.company.name} subtitle={t("settings")} icon={<Building2 />} />
            <InfoCard title={t("ai")} subtitle={t("aiSettingsText")} icon={<ShieldCheck />} />
            <article className="about-card">
              <BrandLogo variant="lockup" />
              <div>
                <p className="eyebrow">{t("about")}</p>
                <h2>Polaris CVC</h2>
                <p className="muted">{t("aboutText")}</p>
              </div>
            </article>
          </section>
        )}
    </AppShell>
  );
}

function AccessDeniedView({
  email,
  reason,
  isLoading,
  onUseAnotherAccount,
  onSignOut
}: {
  email: string;
  reason: string;
  isLoading: boolean;
  onUseAnotherAccount: () => void;
  onSignOut: () => void;
}) {
  return (
    <main className="login-screen">
      <section className="login-panel">
        <BrandLogo variant="hero" />
        <p className="eyebrow">Polaris CVC</p>
        <h1>Acces refuse</h1>
        <article className="access-denied-card">
          <strong>{email || "Compte Google"}</strong>
          <small>{reason}</small>
        </article>
        <button className="primary large" disabled={isLoading} onClick={onUseAnotherAccount}>
          <Users size={20} /> {isLoading ? "Connexion..." : "Utiliser un autre compte"}
        </button>
        <button className="secondary" disabled={isLoading} onClick={onSignOut}>
          <LogOut size={20} /> Se deconnecter
        </button>
      </section>
    </main>
  );
}

function InterventionForm({
  data,
  draft,
  errors,
  setDraft,
  onSubmit
}: {
  data: AppData;
  draft: InterventionDraft;
  errors: string[];
  setDraft: (draft: InterventionDraft) => void;
  onSubmit: () => void;
}) {
  const update = <K extends keyof InterventionDraft>(key: K, value: InterventionDraft[K]) => {
    setDraft({ ...draft, [key]: value });
  };
  const customerSites = data.sites.filter((site) => site.customerId === draft.customerId || !draft.customerId);
  const siteEquipment = data.equipment.filter((item) => item.siteId === draft.siteId || !draft.siteId);

  return (
    <section className="form-card">
      {errors.length > 0 && (
        <div className="error-box">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      <div className="field-grid">
        <label>
          Client
          <select value={draft.customerId} onChange={(event) => update("customerId", event.target.value)}>
            <option value="">Choisir</option>
            {data.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Site
          <select value={draft.siteId} onChange={(event) => update("siteId", event.target.value)}>
            <option value="">Choisir</option>
            {customerSites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Equipement
          <select value={draft.equipmentId} onChange={(event) => update("equipmentId", event.target.value)}>
            <option value="">Non precise</option>
            {siteEquipment.map((equipment) => (
              <option key={equipment.id} value={equipment.id}>
                {equipment.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Titre
          <input value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="Ex. defaut groupe froid" />
        </label>
        <label>
          Demandeur
          <input value={draft.requestedBy} onChange={(event) => update("requestedBy", event.target.value)} />
        </label>
      </div>

      <TextArea label="Demande du client" value={draft.customerRequest} onChange={(value) => update("customerRequest", value)} />
      <TextArea label="Symptome constate" value={draft.observedSymptom} onChange={(value) => update("observedSymptom", value)} />
      <TextArea label="Controles effectues" value={draft.checksPerformed} onChange={(value) => update("checksPerformed", value)} />
      <TextArea label="Mesures" value={draft.measures} onChange={(value) => update("measures", value)} />
      <TextArea label="Diagnostic" value={draft.diagnosis} onChange={(value) => update("diagnosis", value)} />
      <TextArea label="Travaux realises" value={draft.workDone} onChange={(value) => update("workDone", value)} />
      <TextArea label="Resultat final" value={draft.finalResult} onChange={(value) => update("finalResult", value)} />
      <TextArea label="Preconisations" value={draft.recommendations} onChange={(value) => update("recommendations", value)} />

      <label>
        Statut terrain
        <select value={draft.resultStatus} onChange={(event) => update("resultStatus", event.target.value as InterventionResult)}>
          <option value="resolu">Resolu</option>
          <option value="provisoire">Provisoire</option>
          <option value="non_resolu">Non resolu</option>
          <option value="a_surveiller">A surveiller</option>
        </select>
      </label>

      <button className="primary large sticky-action" onClick={onSubmit}>
        <CheckCircle2 size={22} /> Creer l'intervention
      </button>
    </section>
  );
}

function InterventionList({
  data,
  interventions,
  onOpen,
  emptyText = "Aucune intervention"
}: {
  data: AppData;
  interventions: AppData["interventions"];
  onOpen: (id: string) => void;
  emptyText?: string;
}) {
  if (interventions.length === 0) {
    return (
      <article className="empty-state">
        <ClipboardList size={24} />
        <strong>{emptyText}</strong>
        <small>Les interventions reelles apparaitront ici apres creation ou synchronisation.</small>
      </article>
    );
  }
  return (
    <section className="stack">
      {interventions.map((intervention) => {
        const customer = data.customers.find((item) => item.id === intervention.customerId);
        const author = data.users.find((item) => item.id === intervention.authorId);
        return (
          <button className="list-card" key={intervention.id} onClick={() => onOpen(intervention.id)}>
            <span className="status-pill">{intervention.contentStatus.replace("_", " ")}</span>
            <strong>{intervention.title}</strong>
            <small>
              {[intervention.number, customer?.name, author?.displayName ? `par ${author.displayName}` : undefined].filter(Boolean).join(" - ")}
            </small>
          </button>
        );
      })}
    </section>
  );
}

function InterventionDetail({
  data,
  intervention,
  onPhoto,
  onReport,
  onComplete
}: {
  data: AppData;
  intervention: AppData["interventions"][number];
  onPhoto: (file: File, interventionId: string) => void;
  onReport: () => void;
  onComplete: () => void;
}) {
  const customer = data.customers.find((item) => item.id === intervention.customerId);
  const site = data.sites.find((item) => item.id === intervention.siteId);
  const equipment = data.equipment.find((item) => item.id === intervention.equipmentId);
  const author = data.users.find((item) => item.id === intervention.authorId);
  const photos = data.media.filter((item) => item.interventionId === intervention.id);

  return (
    <section className="stack">
      <InfoCard title={intervention.title} subtitle={`${intervention.number} - ${customer?.name}`} icon={<BriefcaseBusiness />} />
      <div className="detail-grid">
        <Detail label="Auteur" value={author?.displayName} />
        <Detail label="Site" value={site?.name} />
        <Detail label="Equipement" value={equipment ? `${equipment.brand} ${equipment.model}` : "Non precise"} />
        <Detail label="Statut" value={intervention.resultStatus.replace("_", " ")} />
      </div>
      <ReportSections intervention={intervention} />
      <label className="photo-button">
        <Camera size={22} /> Ajouter photo
        <input
          hidden
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onPhoto(file, intervention.id);
          }}
        />
      </label>
      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((photo) => (
            <img key={photo.id} src={photo.dataUrl} alt={photo.name} />
          ))}
        </div>
      )}
      <button className="secondary" onClick={onReport}>
        <FileText size={20} /> Rapport PDF
      </button>
      <button className="primary" onClick={onComplete}>
        <CheckCircle2 size={20} /> Marquer termine
      </button>
    </section>
  );
}

const defaultCrop: ImageCropSettings = { x: 0, y: 0, zoom: 1, rotation: 0 };

function EquipmentIdentificationView({ companyId, userId }: { companyId: string; userId: string }) {
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [crop, setCrop] = useState<ImageCropSettings>(defaultCrop);
  const [identification, setIdentification] = useState<EquipmentIdentification | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");

  function loadImage(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(String(reader.result));
      setImageName(file.name);
      setCrop(defaultCrop);
      setIdentification(null);
      setError("");
    };
    reader.readAsDataURL(file);
  }

  async function analyzeImage() {
    if (!imageDataUrl) {
      setError("Ajoutez une photo de plaque avant l'analyse.");
      return;
    }
    setIsAnalyzing(true);
    setError("");
    try {
      const result = await identificationService.analyzeEquipmentPlate({
        companyId,
        userId,
        imageName,
        imageDataUrl,
        crop
      });
      setIdentification(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Analyse impossible.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function rotateImage() {
    setCrop((current) => ({ ...current, rotation: ((current.rotation + 90) % 360) as ImageCropSettings["rotation"] }));
  }

  return (
    <section className="identify-page">
      <div className="capture-actions">
        <label className="photo-button">
          <Camera size={22} /> Prendre photo
          <input hidden type="file" accept="image/*" capture="environment" onChange={(event) => loadImage(event.target.files?.[0])} />
        </label>
        <label className="secondary">
          <ImagePlus size={22} /> Galerie
          <input hidden type="file" accept="image/*" onChange={(event) => loadImage(event.target.files?.[0])} />
        </label>
      </div>

      <section className="plate-preview-card">
        <div className="section-title">
          <ScanLine size={20} />
          <strong>Plaque signaletique</strong>
        </div>
        <div className="plate-preview">
          {imageDataUrl ? (
            <>
              <img
                src={imageDataUrl}
                alt="Apercu plaque signaletique"
                style={{
                  transform: `translate(${crop.x}px, ${crop.y}px) rotate(${crop.rotation}deg) scale(${crop.zoom})`
                }}
              />
              {identification?.detectedZones.map((zone) => (
                <span
                  className="detected-zone"
                  key={zone.id}
                  style={{
                    left: `${zone.x}%`,
                    top: `${zone.y}%`,
                    width: `${zone.width}%`,
                    height: `${zone.height}%`
                  }}
                  title={zone.label}
                />
              ))}
            </>
          ) : (
            <div className="preview-empty">
              <Camera size={28} />
              <strong>Photo de plaque</strong>
              <small>Cadrez la plaque au plus proche pour preparer l'analyse.</small>
            </div>
          )}
        </div>
        {imageName && <small className="muted">{imageName}</small>}
      </section>

      <section className="form-card compact">
        <div className="section-title">
          <Crop size={20} />
          <strong>Recadrage</strong>
        </div>
        <label>
          Zoom
          <input type="range" min="1" max="2.4" step="0.1" value={crop.zoom} onChange={(event) => setCrop({ ...crop, zoom: Number(event.target.value) })} />
        </label>
        <label>
          Horizontal
          <input type="range" min="-120" max="120" value={crop.x} onChange={(event) => setCrop({ ...crop, x: Number(event.target.value) })} />
        </label>
        <label>
          Vertical
          <input type="range" min="-120" max="120" value={crop.y} onChange={(event) => setCrop({ ...crop, y: Number(event.target.value) })} />
        </label>
        <div className="capture-actions">
          <button className="secondary" onClick={rotateImage} type="button">
            <RotateCw size={20} /> Pivoter
          </button>
          <button className="primary" onClick={analyzeImage} disabled={isAnalyzing || !imageDataUrl} type="button">
            <ScanLine size={20} /> {isAnalyzing ? "Analyse..." : "Analyser"}
          </button>
        </div>
        {error && <p className="auth-error">{error}</p>}
      </section>

      {identification && <EquipmentIdentificationResult identification={identification} />}
    </section>
  );
}

function EquipmentIdentificationResult({ identification }: { identification: EquipmentIdentification }) {
  return (
    <section className="stack">
      <article className="identification-card">
        <div className="result-head">
          <div>
            <p className="eyebrow">Identification non connectee</p>
            <h2>{[identification.manufacturer, identification.model].filter(Boolean).join(" ") || "Aucun equipement identifie"}</h2>
          </div>
          <span className="confidence-badge">{Math.round(identification.confidence * 100)}%</span>
        </div>
        <div className="detail-grid">
          <Detail label="Constructeur" value={identification.manufacturer} />
          <Detail label="Modele" value={identification.model} />
          <Detail label="N serie" value={identification.serialNumber} />
          <Detail label="Annee" value={identification.year ? String(identification.year) : undefined} />
          <Detail label="Fluide" value={identification.refrigerant} />
          <Detail label="Puissance" value={identification.power} />
          <Detail label="Tension" value={identification.voltage} />
          <Detail label="Intensite" value={identification.current} />
          <Detail label="Frequence" value={identification.frequency} />
        </div>
        <p className="muted">{identification.remarks}</p>
      </article>

    </section>
  );
}

function TechnicalLibraryView({
  data,
  userId,
  query,
  productFamily,
  documentType,
  language,
  onQueryChange,
  onProductFamilyChange,
  onDocumentTypeChange,
  onLanguageChange,
  onImportFolder,
  onCreateDocument,
  onToggleFavorite,
  onOpenDocument
}: {
  data: AppData;
  userId: string;
  query: string;
  productFamily: ProductFamily | "";
  documentType: TechnicalDocumentType | "";
  language: DocumentLanguage | "";
  onQueryChange: (query: string) => void;
  onProductFamilyChange: (family: ProductFamily | "") => void;
  onDocumentTypeChange: (type: TechnicalDocumentType | "") => void;
  onLanguageChange: (language: DocumentLanguage | "") => void;
  onImportFolder: (files: File[]) => void;
  onCreateDocument: (candidate: DocumentImportCandidate) => void;
  onToggleFavorite: (documentId: string) => void;
  onOpenDocument: (documentId: string) => void;
}) {
  const documents = searchTechnicalDocuments(data.documents, query, { productFamily, documentType, language });
  const favorites = new Set(data.documentFavorites.filter((item) => item.userId === userId).map((item) => item.documentId));
  const recentIds = data.documentRecentViews.filter((item) => item.userId === userId).map((item) => item.documentId);
  const recentDocuments = recentIds
    .map((id) => data.documents.find((document) => document.id === id))
    .filter((document): document is TechnicalDocument => Boolean(document))
    .slice(0, 4);
  const pendingCandidates = data.documentImportCandidates.filter((candidate) => candidate.status === "propose").slice(0, 20);
  const importedFileNames = new Set(data.documents.map((document) => document.fileName).filter(Boolean));
  const equipmentMatches = data.equipment
    .map((equipment) => ({
      equipment,
      documents: findDocumentsForEquipment(data.documents, equipment)
    }))
    .filter((item) => item.documents.length > 0)
    .slice(0, 4);

  return (
    <section className="library-page">
      <div className="search-box">
        <Search size={20} />
        <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Marque, modele, reference, mot-cle..." />
      </div>

      <div className="filter-row">
        <select value={productFamily} onChange={(event) => onProductFamilyChange(event.target.value as ProductFamily | "")}>
          <option value="">Famille</option>
          {productFamilyOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select value={documentType} onChange={(event) => onDocumentTypeChange(event.target.value as TechnicalDocumentType | "")}>
          <option value="">Categorie</option>
          {documentTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select value={language} onChange={(event) => onLanguageChange(event.target.value as DocumentLanguage | "")}>
          <option value="">Langue</option>
          {languageOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="stat-grid">
        <MiniStat icon={<FileArchive />} label="Documents" value={String(data.documents.length)} />
        <MiniStat icon={<Star />} label="Favoris" value={String(favorites.size)} />
        <MiniStat icon={<Clock />} label="Recents" value={String(recentDocuments.length)} />
        <MiniStat icon={<Upload />} label="A classer" value={String(pendingCandidates.length)} />
      </div>

      <section className="form-card compact">
        <div className="section-title">
          <FolderOpen size={20} />
          <strong>Import de dossier</strong>
        </div>
        <label className="import-zone">
          <Upload size={22} />
          Selectionner un dossier de PDF et images
          <input
            hidden
            type="file"
            multiple
            accept=".pdf,image/*"
            ref={(input) => {
              input?.setAttribute("webkitdirectory", "");
              input?.setAttribute("directory", "");
            }}
            onChange={(event) => onImportFolder(Array.from(event.target.files || []))}
          />
        </label>
        {pendingCandidates.length > 0 && (
          <div className="candidate-list">
            {pendingCandidates.map((candidate) => {
              const alreadyImported = importedFileNames.has(candidate.fileName);
              return (
                <article className="candidate-card" key={candidate.id}>
                  <div>
                    <strong>{candidate.proposedTitle}</strong>
                    <small>
                      {[candidate.proposedBrand, candidate.proposedModel, candidate.proposedYear].filter(Boolean).join(" - ") || candidate.fileName}
                    </small>
                  </div>
                  <span className="status-pill">{Math.round(candidate.confidence * 100)}%</span>
                  <button className="secondary" disabled={alreadyImported} onClick={() => onCreateDocument(candidate)}>
                    <CheckCircle2 size={18} /> {alreadyImported ? "Ajoute" : "Valider"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="stack">
        <div className="section-title">
          <BookOpen size={20} />
          <strong>Bibliotheque</strong>
        </div>
        {documents.length === 0 ? (
          <article className="empty-state">
            <FileText size={24} />
            <strong>Aucun document disponible</strong>
            <small>La structure est prete pour les imports, les favoris, les recherches rapides et l'indexation future.</small>
          </article>
        ) : (
          documents.map((document) => (
            <article className="document-card" key={document.id}>
              <button className="icon-action" onClick={() => onToggleFavorite(document.id)} aria-label="Favori">
                <Star size={20} fill={favorites.has(document.id) ? "currentColor" : "none"} />
              </button>
              <button className="document-main" onClick={() => onOpenDocument(document.id)}>
                <strong>{document.title}</strong>
                <small>
                  {[document.brand, document.model || document.compatibleModel, document.manufacturerReference].filter(Boolean).join(" - ")}
                </small>
                <span className="tag-row">
                  <span>{documentTypeLabel(document.documentType)}</span>
                  {document.productFamily && <span>{productFamilyLabel(document.productFamily)}</span>}
                  <span>{document.language}</span>
                  <span>{document.indexStatus === "pret_rag" ? "RAG pret" : "RAG prepare"}</span>
                </span>
              </button>
            </article>
          ))
        )}
      </section>

      {recentDocuments.length > 0 && (
        <section className="stack">
          <div className="section-title">
            <Clock size={20} />
            <strong>Recemment consultes</strong>
          </div>
          {recentDocuments.map((document) => (
            <article className="list-card passive" key={document.id}>
              <strong>{document.title}</strong>
              <small>{[document.brand, document.model || document.compatibleModel].filter(Boolean).join(" - ")}</small>
            </article>
          ))}
        </section>
      )}

      <section className="form-card compact">
        <div className="section-title">
          <Link2 size={20} />
          <strong>Liaisons equipements</strong>
        </div>
        {equipmentMatches.length === 0 ? (
          <small className="muted">Les liaisons automatiques apparaitront des qu'un document correspond a une marque et un modele enregistres.</small>
        ) : (
          equipmentMatches.map(({ equipment, documents }) => (
            <article className="link-row" key={equipment.id}>
              <strong>{equipment.label}</strong>
              <small>
                {equipment.brand} {equipment.model} - {documents.length} document(s)
              </small>
            </article>
          ))
        )}
      </section>

    </section>
  );
}

function SimpleList({
  items,
  emptyTitle = "Aucun element",
  emptyDescription = "Les donnees reelles apparaitront ici des qu'elles seront disponibles."
}: {
  items: Array<{ id: string; title: string; subtitle: string }>;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (items.length === 0) {
    return (
      <article className="empty-state">
        <FileText size={24} />
        <strong>{emptyTitle}</strong>
        <small>{emptyDescription}</small>
      </article>
    );
  }

  return (
    <section className="stack">
      {items.map((item) => (
        <article className="list-card passive" key={item.id}>
          <strong>{item.title}</strong>
          <small>{item.subtitle}</small>
        </article>
      ))}
    </section>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="mini-stat">
      {icon}
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

function documentTypeLabel(value: TechnicalDocumentType): string {
  return documentTypeOptions.find((option) => option.value === value)?.label || value;
}

function productFamilyLabel(value: ProductFamily): string {
  return productFamilyOptions.find((option) => option.value === value)?.label || value;
}

function InfoCard({ title, subtitle, icon }: { title: string; subtitle: string; icon: React.ReactNode }) {
  return (
    <article className="info-card">
      <div className="icon-box">{icon}</div>
      <div>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </div>
    </article>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
    </label>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <strong>{value || "Non renseigne"}</strong>
    </div>
  );
}

function ReportSections({ intervention }: { intervention: AppData["interventions"][number] }) {
  const sections = [
    ["Demande client", intervention.customerRequest],
    ["Symptome", intervention.observedSymptom],
    ["Controles", intervention.checksPerformed],
    ["Mesures", intervention.measures],
    ["Diagnostic", intervention.diagnosis],
    ["Travaux", intervention.workDone],
    ["Resultat", intervention.finalResult],
    ["Preconisations", intervention.recommendations]
  ];
  return (
    <div className="report-sections">
      {sections.map(([title, body]) => (
        <article key={title}>
          <h2>{title}</h2>
          <p>{body || "Non renseigne"}</p>
        </article>
      ))}
    </div>
  );
}

function titleForView(view: View, t: (key: TranslationKey) => string): string {
  const titles: Record<View, string> = {
    diagnosticNew: t("diagnostic"),
    documents: t("documents"),
    diagnostics: t("diagnosticsArchive"),
    new: t("interventionNew"),
    active: t("interventionCurrent"),
    interventions: t("interventions"),
    detail: t("interventions"),
    customers: "Clients",
    sites: "Sites",
    equipment: t("identifiedEquipment"),
    profile: t("profile"),
    company: t("settings")
  };
  return titles[view];
}

function roleLabel(role: string): string {
  return role.replace("_", " ");
}
