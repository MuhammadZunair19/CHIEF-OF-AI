"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarDays,
  Command,
  CircleHelp,
  Focus,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Radar,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  SquareKanban,
  UsersRound,
  X,
} from "lucide-react";
const nav = [
  ["/dashboard", "Dashboard", LayoutDashboard],
  ["/inbox", "Inbox", Inbox],
  ["/tasks", "Tasks", SquareKanban],
  ["/follow-ups", "Follow-up radar", Radar],
  ["/relationships", "Relationships", UsersRound],
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
    [shortcutsOpen, setShortcutsOpen] = useState(false),
    [quiet, setQuiet] = useState(false),
    [coreState, setCoreState] = useState<
      "online" | "thinking" | "approval" | "success" | "failure"
    >("online"),
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
    setQuiet(localStorage.getItem("chief-quiet") === "true");
    const events = new EventSource("/api/events");
    let reset: ReturnType<typeof setTimeout> | undefined;
    events.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as { type?: string };
        const next = event.type?.includes("failed")
          ? "failure"
          : event.type === "approval.created"
            ? "approval"
            : event.type?.includes("completed") ||
                event.type === "approval.updated"
              ? "success"
              : "thinking";
        setCoreState(next);
        clearTimeout(reset);
        reset = setTimeout(
          () => setCoreState("online"),
          next === "approval" ? 8000 : 3500,
        );
      } catch {
        setCoreState("online");
      }
    };
    events.onerror = () => setCoreState("failure");
    return () => {
      clearTimeout(reset);
      events.close();
    };
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
      const target = event.target as HTMLElement;
      if (
        event.key === "?" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      )
        setShortcutsOpen(true);
      if (event.key === "Escape") setShortcutsOpen(false);
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
  const toggleQuiet = () => {
    const next = !quiet;
    setQuiet(next);
    localStorage.setItem("chief-quiet", String(next));
  };
  return (
    <div className={`shell ${quiet ? "quiet-shell" : ""}`}>
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
        <div className={`core-widget core-${coreState}`} aria-live="polite">
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
            <span>
              <i className="live-dot" />{" "}
              {coreState === "online"
                ? "Online"
                : coreState === "thinking"
                  ? "Thinking"
                  : coreState === "approval"
                    ? "Needs approval"
                    : coreState === "success"
                      ? "Done"
                      : "Needs attention"}
            </span>
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
              className={`button icon-only ${quiet ? "active" : ""}`}
              onClick={toggleQuiet}
              aria-label={quiet ? "Exit quiet mode" : "Enter quiet mode"}
              title="Quiet mode"
            >
              <Focus size={16} />
            </button>
            <button
              className="button icon-only"
              onClick={() => setShortcutsOpen(true)}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts"
            >
              <CircleHelp size={16} />
            </button>
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
      {shortcutsOpen && (
        <ShortcutDialog close={() => setShortcutsOpen(false)} />
      )}
    </div>
  );
}
function ShortcutDialog({ close }: { close: () => void }) {
  const groups = [
    [
      "Global",
      [
        ["Ctrl/⌘ K", "Open command palette"],
        ["?", "Show this shortcut guide"],
        ["Esc", "Close overlays"],
      ],
    ],
    [
      "Inbox",
      [
        ["J / K", "Move through messages"],
        ["A", "Analyze selected email"],
        ["T", "Create a task"],
        ["R", "Open Reply Studio"],
        ["S / E", "Snooze / mark handled"],
      ],
    ],
  ] as const;
  return (
    <div
      className="dialog-layer"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <button
        className="dialog-scrim"
        onClick={close}
        aria-label="Close shortcuts"
      />
      <section className="shortcut-dialog">
        <div className="section-head">
          <div>
            <div className="eyebrow">Move at thought speed</div>
            <h2>Keyboard shortcuts</h2>
          </div>
          <button className="icon-button" onClick={close}>
            <X size={17} />
          </button>
        </div>
        {groups.map(([label, shortcuts]) => (
          <div className="shortcut-group" key={label}>
            <strong>{label}</strong>
            {shortcuts.map(([keys, action]) => (
              <div key={keys}>
                <span>{action}</span>
                <kbd>{keys}</kbd>
              </div>
            ))}
          </div>
        ))}
      </section>
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
  const [running, setRunning] = useState<string | null>(null),
    count = (results?.emails.length ?? 0) + (results?.tasks.length ?? 0),
    normalized = query.trim().toLowerCase();
  const actions = [
    {
      id: "sync",
      label: "Sync Gmail now",
      detail: "Retrieve current Gmail and Calendar records",
      Icon: RefreshCw,
      run: async () => {
        await fetch("/api/inbox/sync", { method: "POST" });
      },
    },
    {
      id: "approvals",
      label: "Review pending approvals",
      detail: "Open approval queue",
      Icon: ShieldCheck,
      run: async () => location.assign("/approvals"),
    },
    {
      id: "radar",
      label: "Open follow-up radar",
      detail: "Find commitments that need a nudge",
      Icon: Radar,
      run: async () => location.assign("/follow-ups"),
    },
    {
      id: "sprint",
      label: "Switch tasks to Sprint view",
      detail: "Focus on active and upcoming work",
      Icon: SquareKanban,
      run: async () => {
        localStorage.setItem("chief-task-view", "sprint");
        location.assign("/tasks");
      },
    },
  ].filter(
    (action) =>
      !normalized ||
      `${action.label} ${action.detail}`.toLowerCase().includes(normalized),
  );
  const execute = async (id: string, run: () => Promise<unknown>) => {
    setRunning(id);
    try {
      await run();
      close();
    } finally {
      setRunning(null);
    }
  };
  const createTask = async () =>
    execute("create", async () => {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: query.trim(), priority: "MEDIUM" }),
      });
      if (response.ok) location.assign("/tasks");
    });
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
        <div className="command-results">
          <div className="command-group-label">Quick actions</div>
          {query.trim().length >= 2 && (
            <button
              className="command-action"
              onClick={() => void createTask()}
              disabled={running === "create"}
            >
              <Plus size={16} />
              <div>
                <strong>Create task “{query.trim()}”</strong>
                <span>Add a medium-priority commitment</span>
              </div>
              <kbd>Enter</kbd>
            </button>
          )}
          {actions.map(({ id, label, detail, Icon, run }) => (
            <button
              className="command-action"
              onClick={() => void execute(id, run)}
              disabled={running === id}
              key={id}
            >
              <Icon className={running === id ? "spin" : ""} size={16} />
              <div>
                <strong>{label}</strong>
                <span>{detail}</span>
              </div>
            </button>
          ))}
          {query.trim().length >= 2 && (
            <div className="command-group-label">Search results</div>
          )}
          {query.trim().length >= 2 && !results && (
            <div className="command-empty">Searching…</div>
          )}
          {query.trim().length >= 2 && results && count === 0 && (
            <div className="command-empty">No matching records.</div>
          )}
          {results && (
            <>
              {results.emails.map((email) => (
                <Link
                  href={`/inbox/${email.id}`}
                  onClick={close}
                  key={email.id}
                >
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
            </>
          )}
        </div>
      </section>
    </div>
  );
}
