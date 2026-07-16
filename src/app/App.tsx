import type React from "react";
import { useMemo, useState } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardList,
  FileText,
  Home,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Users,
  Wrench
} from "lucide-react";
import { AppData, InterventionDraft, InterventionResult, TechnicalDocument } from "../domain/types";
import { makeSearchIndex, validateInterventionDraft } from "../domain/validation";
import { createFirebaseServices } from "../services/firebaseClient";
import { repository } from "../services/localRepository";
import { openPrintableReport } from "../services/reportService";

type View =
  | "home"
  | "new"
  | "active"
  | "interventions"
  | "detail"
  | "customers"
  | "sites"
  | "equipment"
  | "documents"
  | "team"
  | "profile"
  | "company";

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [view, setView] = useState<View>("home");
  const [data, setData] = useState(() => repository.load());
  const [selectedInterventionId, setSelectedInterventionId] = useState(data.interventions[0]?.id ?? "");
  const [draft, setDraft] = useState<InterventionDraft>(emptyDraft);
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const firebaseReady = useMemo(() => Boolean(createFirebaseServices()), []);

  const currentUser = data.users[0];
  const selectedIntervention = data.interventions.find((item) => item.id === selectedInterventionId);
  const activeInterventions = data.interventions.filter((item) => item.contentStatus === "brouillon");

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

  function submitIntervention() {
    const result = validateInterventionDraft(draft);
    setErrors(result.errors);
    if (!result.ok) return;
    const next = repository.createIntervention(data, draft, currentUser.id);
    setData(next);
    const created = next.interventions[0];
    setSelectedInterventionId(created.id);
    setDraft(emptyDraft);
    setView("detail");
  }

  async function addPhoto(file: File, interventionId: string) {
    const reader = new FileReader();
    reader.onload = () => {
      const next = repository.addMedia(data, interventionId, file, String(reader.result));
      setData(next);
    };
    reader.readAsDataURL(file);
  }

  function addDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const document: Omit<TechnicalDocument, "id" | "companyId" | "createdAt" | "updatedAt"> = {
      title: String(form.get("title") || ""),
      brand: String(form.get("brand") || ""),
      range: String(form.get("range") || ""),
      compatibleModel: String(form.get("model") || ""),
      documentType: "fiche_technique",
      language: "fr",
      version: String(form.get("version") || ""),
      source: String(form.get("source") || ""),
      addedByUserId: currentUser.id,
      officialStatus: "a_verifier",
      fileName: String(form.get("fileName") || "")
    };
    setData(repository.addDocument(data, document));
    event.currentTarget.reset();
  }

  if (!isAuthenticated) {
    return (
      <main className="login-screen">
        <section className="login-panel">
          <div className="brand-mark">P</div>
          <p className="eyebrow">Polaris CVC</p>
          <h1>Depannage CVC terrain</h1>
          <p className="muted">
            Base professionnelle mobile-first. Firebase est {firebaseReady ? "configure" : "pret a configurer"}.
          </p>
          <label>
            Email
            <input defaultValue="mila@polaris.local" inputMode="email" />
          </label>
          <label>
            Mot de passe
            <input defaultValue="demo-polaris" type="password" />
          </label>
          <button className="primary large" onClick={() => setIsAuthenticated(true)}>
            <ShieldCheck size={22} /> Se connecter
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Polaris CVC</p>
          <h1>{titleForView(view)}</h1>
        </div>
        <div className={`sync sync-${navigator.onLine ? "ok" : "offline"}`}>
          {navigator.onLine ? "Sync en attente" : "Hors ligne"}
        </div>
      </header>

      <main className="content">
        {view === "home" && (
          <HomeView
            activeCount={activeInterventions.length}
            onNavigate={setView}
            onSearch={() => {
              setQuery("");
              setView("interventions");
            }}
          />
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
            emptyText="Aucune intervention en cours."
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
            onComplete={() => setData(repository.updateInterventionStatus(data, selectedIntervention.id, "termine"))}
          />
        )}

        {view === "customers" && (
          <SimpleList
            items={data.customers.map((item) => ({
              id: item.id,
              title: item.name,
              subtitle: `${item.contactName} - ${item.phone}`
            }))}
          />
        )}

        {view === "sites" && (
          <SimpleList
            items={data.sites.map((item) => ({
              id: item.id,
              title: item.name,
              subtitle: item.address
            }))}
          />
        )}

        {view === "equipment" && (
          <SimpleList
            items={data.equipment.map((item) => ({
              id: item.id,
              title: item.label,
              subtitle: `${item.brand} ${item.model} - ${item.serialNumber || "SN non renseigne"}`
            }))}
          />
        )}

        {view === "documents" && (
          <DocumentsView documents={data.documents} onSubmit={addDocument} />
        )}

        {view === "team" && (
          <SimpleList
            items={data.users.map((item) => ({
              id: item.id,
              title: item.displayName,
              subtitle: `${roleLabel(item.role)} - ${item.email}`
            }))}
          />
        )}

        {view === "profile" && (
          <section className="stack">
            <InfoCard title={currentUser.displayName} subtitle={roleLabel(currentUser.role)} icon={<Users />} />
            <button className="secondary" onClick={() => setIsAuthenticated(false)}>
              <LogOut size={20} /> Deconnexion
            </button>
          </section>
        )}

        {view === "company" && (
          <section className="stack">
            <InfoCard title={data.company.name} subtitle="Parametres entreprise et isolation des donnees par companyId." icon={<Building2 />} />
            <InfoCard title="IA" subtitle="Service abstrait cree. Fournisseur non active dans cette version." icon={<ShieldCheck />} />
          </section>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Navigation principale">
        <button className={view === "home" ? "active" : ""} onClick={() => setView("home")} aria-label="Accueil">
          <Home size={22} />
        </button>
        <button className={view === "new" ? "active" : ""} onClick={() => setView("new")} aria-label="Nouvelle intervention">
          <Plus size={24} />
        </button>
        <button className={view === "interventions" ? "active" : ""} onClick={() => setView("interventions")} aria-label="Interventions">
          <ClipboardList size={22} />
        </button>
        <button className={view === "documents" ? "active" : ""} onClick={() => setView("documents")} aria-label="Documentation">
          <BookOpen size={22} />
        </button>
        <button className={view === "profile" ? "active" : ""} onClick={() => setView("profile")} aria-label="Profil">
          <Users size={22} />
        </button>
      </nav>
    </div>
  );
}

function HomeView({
  activeCount,
  onNavigate,
  onSearch
}: {
  activeCount: number;
  onNavigate: (view: View) => void;
  onSearch: () => void;
}) {
  const actions = [
    { label: "Nouvelle intervention", icon: <Plus />, view: "new" as View, primary: true },
    { label: `En cours (${activeCount})`, icon: <ClipboardList />, view: "active" as View },
    { label: "Rechercher une panne", icon: <Search />, action: onSearch },
    { label: "Documentation", icon: <BookOpen />, view: "documents" as View },
    { label: "Equipements", icon: <Wrench />, view: "equipment" as View },
    { label: "Equipe", icon: <Users />, view: "team" as View }
  ];

  return (
    <section className="quick-grid">
      {actions.map((action) => (
        <button
          key={action.label}
          className={action.primary ? "quick-card primary-card" : "quick-card"}
          onClick={() => (action.action ? action.action() : onNavigate(action.view))}
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      ))}
    </section>
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

      <div className="voice-placeholder">
        <FileText size={20} />
        Notes vocales prevues. Transcription automatique non activee.
      </div>

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
  emptyText = "Aucune intervention trouvee."
}: {
  data: AppData;
  interventions: AppData["interventions"];
  onOpen: (id: string) => void;
  emptyText?: string;
}) {
  if (interventions.length === 0) return <p className="muted">{emptyText}</p>;
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
              {intervention.number} - {customer?.name} - par {author?.displayName}
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

function DocumentsView({
  documents,
  onSubmit
}: {
  documents: AppData["documents"];
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="stack">
      <form className="form-card compact" onSubmit={onSubmit}>
        <input name="title" placeholder="Titre du document" required />
        <input name="brand" placeholder="Marque" required />
        <input name="range" placeholder="Gamme" />
        <input name="model" placeholder="Modele compatible" />
        <input name="version" placeholder="Version" />
        <input name="source" placeholder="Source" />
        <input name="fileName" placeholder="Nom du fichier PDF/image" />
        <button className="primary">
          <Plus size={20} /> Ajouter document
        </button>
      </form>
      <SimpleList
        items={documents.map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: `${item.brand} ${item.compatibleModel || ""} - ${item.officialStatus.replace("_", " ")}`
        }))}
      />
    </section>
  );
}

function SimpleList({ items }: { items: Array<{ id: string; title: string; subtitle: string }> }) {
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

function titleForView(view: View): string {
  const titles: Record<View, string> = {
    home: "Accueil",
    new: "Nouvelle intervention",
    active: "En cours",
    interventions: "Interventions",
    detail: "Detail intervention",
    customers: "Clients",
    sites: "Sites",
    equipment: "Equipements",
    documents: "Documentation",
    team: "Equipe",
    profile: "Profil",
    company: "Entreprise"
  };
  return titles[view];
}

function roleLabel(role: string): string {
  return role.replace("_", " ");
}
