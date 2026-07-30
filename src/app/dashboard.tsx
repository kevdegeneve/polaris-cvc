import type React from "react";
import { useState } from "react";
import {
  BookOpen,
  Bot,
  FileClock,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ScanLine,
  Settings,
} from "lucide-react";
import type { AppData, AppUser } from "../domain/types";
import { createTranslator, type TranslationKey } from "../services/languageService";
import { BrandLogo } from "./brand";
import {
  getNavigationItems,
  type DashboardView,
  type NavigationItem
} from "./dashboardModel";

const iconByView: Record<DashboardView, React.ReactNode> = {
  diagnosticNew: <Bot size={20} />,
  documents: <BookOpen size={20} />,
  diagnostics: <FileClock size={20} />,
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
        <MobileNavigation items={items} activeView={activeView} onNavigate={navigate} />
      </div>
    </div>
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
    diagnosticNew: "diagnosticNew",
    documents: "documents",
    diagnostics: "diagnosticsArchive",
    company: "settings"
  };
  return t(keyByView[view]);
}
