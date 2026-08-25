"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarDays,
  Command,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  SquareKanban,
  X,
} from "lucide-react";
const nav = [
  ["/dashboard", "Dashboard", LayoutDashboard],
  ["/inbox", "Inbox", Inbox],
  ["/tasks", "Tasks", SquareKanban],
  ["/calendar", "Calendar", CalendarDays],
  ["/approvals", "Approvals", ShieldCheck],
  ["/activity", "Activity", Activity],
] as const;
type SearchData = {
  emails: Array<{ id: string; subject: string; sender: string }>;
  tasks: Array<{ id: string; title: string; status: string }>;
};
type UiPreferences = {
  theme: "system" | "light" | "dark";
  accent: "violet" | "ocean" | "ember" | "mint";
  motion: "full" | "reduced";
  density: "comfortable" | "compact";
  taskView: "kanban" | "sprint" | "list" | "matrix";
};
function applyPreferences(settings: UiPreferences) {
  const root = document.documentElement;
  const dark =
    settings.theme === "dark" ||
    (settings.theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.dataset.accent = settings.accent;
  root.dataset.motion = settings.motion;
  root.dataset.density = settings.density;
  localStorage.setItem("chief-task-view", settings.taskView);
  return dark;
}
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname(),
    [initials, setInitials] = useState(""),
    [mobile, setMobile] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [dark, setDark] = useState(false),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<SearchData | null>(null);
  useEffect(() => {
    const stored = localStorage.getItem("chief-theme");
    const enabled =
      stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", enabled);
    setDark(enabled);
  }, []);
  useEffect(() => {
    fetch("/api/settings")
      .then((response) => (response.ok ? response.json() : null))
      .then((settings: UiPreferences | null) => {
        if (settings) setDark(applyPreferences(settings));
      })
      .catch(() => undefined);
    const refresh = () => {
      fetch("/api/settings")
        .then((response) => (response.ok ? response.json() : null))
        .then((settings: UiPreferences | null) => {
          if (settings) setDark(applyPreferences(settings));
        })
        .catch(() => undefined);
    };
    window.addEventListener("chief-preferences", refresh);
    return () => window.removeEventListener("chief-preferences", refresh);
  }, []);
  useEffect(() => {
    fetch("/api/auth/get-session")
      .then((response) => (response.ok ? response.json() : null))
      .then((session) => {
        const label = session?.user?.name ?? session?.user?.email ?? "";
        setInitials(
          label
            .split(/\s+|@/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part: string) => part[0]?.toUpperCase())
            .join(""),
        );
      })
      .catch(() => setInitials(""));
  }, []);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((response) => (response.ok ? response.json() : null))
        .then(setResults)
        .catch(() => setResults(null));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  const signOut = async () => {
    await fetch("/api/auth/sign-out", { method: "POST" });
    window.location.assign("/login");
  };
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("chief-theme", next ? "dark" : "light");
  };
  return (
    <div className="shell">
      <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brandmark">C</span>
          <span className="brand-copy">
            Chief <small>AI Chief of Staff</small>
          </span>
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="core-widget" aria-hidden="true">
          <div className="core-scene">
            <div className="core-cube">
              <i className="cube-face face-front" />
              <i className="cube-face face-back" />
              <i className="cube-face face-right" />
              <i className="cube-face face-left" />
              <i className="cube-face face-top" />
              <i className="cube-face face-bottom" />
            </div>
            <span className="core-ring ring-a" />
            <span className="core-ring ring-b" />
          </div>
          <div>
            <strong>Chief core</strong>
            <span><i className="live-dot" /> Online</span>
          </div>
        </div>
        <Navigation path={path} close={() => setMobile(false)} />
        <div className="sidebar-foot nav">
          <Link
            href="/settings"
            className={path.startsWith("/settings") ? "active" : ""}
          >
            <Settings size={17} />
            Settings
          </Link>
          <button className="nav-button" onClick={() => void signOut()}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="scrim"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        />
      )}
      <main className="main">
        <header className="topbar">
          <div className="row">
            <button
              className="button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={17} />
            </button>
            <span className="workspace-label">
              <span className="live-dot" /> Personal workspace
            </span>
          </div>
          <div className="row">
            <button className="button" onClick={() => setSearchOpen(true)}>
              <Search size={16} />
              Search{" "}
              <span className="badge">
                <Command size={10} /> K
              </span>
            </button>
            <button
              className="button icon-only"
              onClick={toggleTheme}
              aria-label={dark ? "Use light theme" : "Use dark theme"}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link
              className="button"
              href="/inbox"
              aria-label="Open inbox synchronization"
            >
              <RefreshCw size={16} />
            </Link>
            {initials && <span className="brandmark">{initials}</span>}
          </div>
        </header>
        {children}
      </main>
      {searchOpen && (
        <SearchDialog
          query={query}
          setQuery={setQuery}
          results={results}
          close={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}
function Navigation({ path, close }: { path: string; close: () => void }) {
  return (
    <nav className="nav">
      {nav.map(([href, label, Icon]) => (
        <Link
          key={href}
          href={href}
          onClick={close}
          className={path.startsWith(href) ? "active" : ""}
        >
          <Icon size={17} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
function SearchDialog({
  query,
  setQuery,
  results,
  close,
}: {
  query: string;
  setQuery: (value: string) => void;
  results: SearchData | null;
  close: () => void;
}) {
  const count = (results?.emails.length ?? 0) + (results?.tasks.length ?? 0);
  return (
    <div
      className="dialog-layer"
      role="dialog"
      aria-modal="true"
      aria-label="Search Chief"
    >
      <button
        className="dialog-scrim"
        onClick={close}
        aria-label="Close search"
      />
      <section className="command-dialog">
        <div className="command-input">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search emails and tasks"
          />
          <button className="icon-button" onClick={close}>
            <X size={17} />
          </button>
        </div>
        {query.trim().length < 2 ? (
          <div className="command-empty">Enter at least two characters.</div>
        ) : !results ? (
          <div className="command-empty">Searching…</div>
        ) : count === 0 ? (
          <div className="command-empty">No matching records.</div>
        ) : (
          <div className="command-results">
            {results.emails.map((email) => (
              <Link href={`/inbox/${email.id}`} onClick={close} key={email.id}>
                <Inbox size={16} />
                <div>
                  <strong>{email.subject}</strong>
                  <span>{email.sender}</span>
                </div>
              </Link>
            ))}
            {results.tasks.map((task) => (
              <Link href="/tasks" onClick={close} key={task.id}>
                <SquareKanban size={16} />
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.status.replaceAll("_", " ")}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
