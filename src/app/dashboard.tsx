import type React from "react";
import { useState } from "react";
import {
  Activity,
  BookOpen,
  Bot,
  Building2,
  ClipboardList,
  FileClock,
  Home,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ScanLine,
  Settings,
  Sparkles,
  ThermometerSnowflake,
  Users
} from "lucide-react";
import type { AppData, AppUser } from "../domain/types";
import { createTranslator, type TranslationKey } from "../services/languageService";
import { BrandLogo } from "./brand";
import {
  buildDashboardStats,
  buildRecentActivity,
  getNavigationItems,
  isAdminRole,
  type DashboardView,
  type NavigationItem
} from "./dashboardModel";

const iconByView: Record<DashboardView, React.ReactNode> = {
  home: <Activity size={20} />,
  diagnosticNew: <Bot size={20} />,
  diagnostics: <FileClock size={20} />,
  new: <ThermometerSnowflake size={20} />,
  interventions: <ClipboardList size={20} />,
  identifyEquipment: <ScanLine size={20} />,
  documents: <BookOpen size={20} />,
  team: <Users size={20} />,
  company: <Settings size={20} />
};

export function AppShell({
  children,
  data,
  user,
  activeView,
  title,
  onNavigate,
  onSignOut
}: {
  children: React.ReactNode;
  data: AppData;
  user: AppUser;
  activeView: string;
  title: string;
  onNavigate: (view: DashboardView) => void;
  onSignOut: () => void;
}) {
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const items = getNavigationItems(user.role);
  const t = createTranslator(user.preferredLanguage);

  function navigate(view: DashboardView) {
    onNavigate(view);
    setMobileMenuOpen(false);
  }

  return (
    <div className={`app-shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        items={items}
        activeView={activeView}
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        onNavigate={navigate}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        t={t}
      />
      {isMobileMenuOpen && <button className="mobile-scrim" aria-label="Fermer le menu" onClick={() => setMobileMenuOpen(false)} />}
      <div className="app-main">
        <TopBar
          title={title}
          companyName={data.company.name || user.companyId}
          user={user}
          t={t}
          onMenu={() => setMobileMenuOpen(true)}
          onSignOut={onSignOut}
        />
        <main className="content app-content">{children}</main>
        <button className="floating-action" onClick={() => navigate("diagnosticNew")}>
          <ScanLine size={22} /> {t("diagnostic")}
        </button>
        <MobileNavigation items={items.slice(0, 5)} activeView={activeView} onNavigate={navigate} />
      </div>
    </div>
  );
}

export function Dashboard({ data, user, onNavigate }: { data: AppData; user: AppUser; onNavigate: (view: DashboardView) => void }) {
  const items = getNavigationItems(user.role).filter((item) => item.id !== "home");
  const stats = buildDashboardStats(data, user.id);
  const activity = buildRecentActivity(data, user.id);
  const t = createTranslator(user.preferredLanguage);

  return (
    <section className="dashboard-page">
      <div className="dashboard-hero">
        <div>
          <BrandLogo variant="lockup" className="dashboard-hero-logo" />
          <p className="eyebrow">{t("dashboard")}</p>
          <h2>{t("welcome")}</h2>
          <p className="muted">{t("dashboardIntro")}</p>
        </div>
        <button className="primary" onClick={() => onNavigate("diagnosticNew")}>
          <Sparkles size={20} /> {t("diagnostic")}
        </button>
      </div>

      <section className="dashboard-card-grid" aria-label="Actions principales">
        {items.map((item) => (
          <DashboardCard key={item.id} item={item} onNavigate={onNavigate} t={t} />
        ))}
      </section>

      <section className="dashboard-stat-grid" aria-label="Indicateurs">
        {stats.map((stat) => (
          <article className="dashboard-stat-card" key={stat.label}>
            <strong>{stat.value}</strong>
            <small>{translateDashboardStat(stat.label, t)}</small>
          </article>
        ))}
      </section>

      <RecentActivity activity={activity} t={t} />
      <DashboardLatest data={data} />
    </section>
  );
}

export function UserAvatar({ user, size = "normal" }: { user: AppUser; size?: "normal" | "large" }) {
  const initials =
    user.displayName
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "P";

  return (
    <div className={`user-avatar user-avatar-${size}`}>
      {user.photoURL ? <img src={user.photoURL} alt={user.displayName} /> : <span>{initials}</span>}
    </div>
  );
}

function Sidebar({
  items,
  activeView,
  isCollapsed,
  isMobileOpen,
  onNavigate,
  onToggleCollapsed,
  t
}: {
  items: NavigationItem[];
  activeView: string;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onNavigate: (view: DashboardView) => void;
  onToggleCollapsed: () => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <aside className={`sidebar ${isMobileOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-brand">
        <BrandLogo variant="mark" />
        {!isCollapsed && (
          <div>
            <strong>Polaris CVC</strong>
            <small>Terrain professionnel</small>
          </div>
        )}
      </div>
      <nav className="sidebar-nav" aria-label="Navigation principale">
        {items.map((item) => (
          <button key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => onNavigate(item.id)} title={translateNavigationItem(item.id, t)}>
            {iconByView[item.id]}
            {!isCollapsed && <span>{translateNavigationItem(item.id, t)}</span>}
          </button>
        ))}
      </nav>
      <button className="sidebar-toggle" onClick={onToggleCollapsed}>
        {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        {!isCollapsed && <span>{isCollapsed ? "" : "<<"}</span>}
      </button>
    </aside>
  );
}

function TopBar({
  title,
  companyName,
  user,
  onMenu,
  onSignOut,
  t
}: {
  title: string;
  companyName: string;
  user: AppUser;
  onMenu: () => void;
  onSignOut: () => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <header className="topbar app-topbar">
      <button className="menu-button" onClick={onMenu} aria-label="Ouvrir le menu">
        <Menu size={22} />
      </button>
      <div className="topbar-title">
        <p className="eyebrow">{companyName}</p>
        <h1>{title}</h1>
      </div>
      <div className="topbar-profile">
        <UserAvatar user={user} />
        <div>
          <strong>{user.displayName}</strong>
          <small>{user.role}</small>
        </div>
        <button className="icon-button" onClick={onSignOut} aria-label={t("signOut")}>
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}

function DashboardCard({ item, onNavigate, t }: { item: NavigationItem; onNavigate: (view: DashboardView) => void; t: (key: TranslationKey) => string }) {
  return (
    <button className="dashboard-card" onClick={() => onNavigate(item.id)}>
      <span className="dashboard-card-icon">{iconByView[item.id]}</span>
      <strong>{translateNavigationItem(item.id, t)}</strong>
      <small>{item.description}</small>
    </button>
  );
}

function RecentActivity({ activity, t }: { activity: ReturnType<typeof buildRecentActivity>; t: (key: TranslationKey) => string }) {
  return (
    <section className="recent-activity">
      <div className="section-title">
        <ClipboardList size={20} />
        <strong>{t("recentActivity")}</strong>
      </div>
      {activity.length === 0 ? (
        <article className="empty-state">
          <Building2 size={24} />
          <strong>{t("noRecentActivity")}</strong>
          <small>{t("noRecentActivityText")}</small>
        </article>
      ) : (
        <div className="recent-list">
          {activity.map((item) => (
            <article className="list-card passive" key={item.id}>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DashboardLatest({ data }: { data: AppData }) {
  const latestInterventions = [...data.interventions]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 3);
  const latestDiagnostics = [...data.diagnostics]
    .filter((diagnostic) => diagnostic.analysisResult || diagnostic.status === "awaiting_technician_input" || diagnostic.status === "analysis_failed")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 3);

  return (
    <section className="dashboard-latest-grid">
      <article className="dashboard-panel">
        <div className="section-title">
          <ClipboardList size={20} />
          <strong>Dernieres interventions</strong>
        </div>
        {latestInterventions.length === 0 ? (
          <p className="muted">Aucune intervention.</p>
        ) : (
          latestInterventions.map((intervention) => (
            <div className="dashboard-row" key={intervention.id}>
              <strong>{intervention.title || intervention.number}</strong>
              <small>{intervention.contentStatus.replace("_", " ")} - {new Date(intervention.createdAt).toLocaleDateString("fr-FR")}</small>
            </div>
          ))
        )}
      </article>
      <article className="dashboard-panel">
        <div className="section-title">
          <Bot size={20} />
          <strong>Derniers diagnostics IA</strong>
        </div>
        {latestDiagnostics.length === 0 ? (
          <p className="muted">Aucun diagnostic IA.</p>
        ) : (
          latestDiagnostics.map((diagnostic) => (
            <div className="dashboard-row" key={diagnostic.id}>
              <strong>{diagnostic.title}</strong>
              <small>{diagnostic.status.replaceAll("_", " ")} - {diagnostic.confidenceLevel ? `${Math.round(diagnostic.confidenceLevel * 100)}%` : "confiance non renseignee"}</small>
            </div>
          ))
        )}
      </article>
    </section>
  );
}

function MobileNavigation({ items, activeView, onNavigate }: { items: NavigationItem[]; activeView: string; onNavigate: (view: DashboardView) => void }) {
  return (
    <nav className="mobile-nav" aria-label="Navigation mobile">
      {items.map((item) => (
        <button key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => onNavigate(item.id)} aria-label={item.label}>
          {iconByView[item.id]}
        </button>
      ))}
    </nav>
  );
}

export function ModulePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <article className="empty-state">
      <Settings size={24} />
      <strong>{title}</strong>
      <small>{description}</small>
    </article>
  );
}

function translateNavigationItem(view: DashboardView, t: (key: TranslationKey) => string): string {
  const keyByView: Record<DashboardView, TranslationKey> = {
    home: "dashboard",
    diagnosticNew: "diagnosticNew",
    diagnostics: "diagnosticsArchive",
    new: "interventionNew",
    interventions: "interventions",
    identifyEquipment: "identifyEquipment",
    documents: "documents",
    team: "users",
    company: "settings"
  };
  return t(keyByView[view]);
}

function translateDashboardStat(label: string, t: (key: TranslationKey) => string): string {
  const keyByLabel: Record<string, TranslationKey> = {
    "Interventions ouvertes": "openInterventions",
    "Interventions terminees": "completedInterventions",
    "Equipements identifies": "identifiedEquipment",
    "Documents techniques": "technicalDocuments",
    Favoris: "favorites",
    "Activite recente": "recentActivity"
  };
  return keyByLabel[label] ? t(keyByLabel[label]) : label;
}
