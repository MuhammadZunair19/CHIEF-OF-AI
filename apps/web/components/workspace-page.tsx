"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Inbox as InboxIcon,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
type Kind =
  | "dashboard"
  | "inbox"
  | "tasks"
  | "calendar"
  | "approvals"
  | "activity"
  | "settings";
type Setup = { google: boolean; gemini: boolean };
type DashboardData = {
  metrics: {
    pending: number;
    tasksDue: number;
    attention: number;
    meetings: number;
  };
  recent: Array<{
    id: string;
    status: string;
    createdAt: string;
    steps: Array<{ title: string }>;
  }>;
};
type Email = {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  receivedAt: string;
  unread: boolean;
  analysisRecord?: {
    summary: string;
    category: string;
    priority: string;
  } | null;
};
type Task = {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueAt: string | null;
  source: string;
  createdByAi: boolean;
};
type CalendarEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  attendees: string[];
};
type Approval = {
  id: string;
  type: string;
  reason: string;
  riskLevel: string;
  status: string;
  requestedAt: string;
  draft?: { subject: string; recipients: string[] } | null;
};
type AgentRun = {
  id: string;
  status: string;
  trigger: string;
  createdAt: string;
  resultSummary: string | null;
  steps: Array<{
    id: string;
    title: string;
    description: string | null;
    startedAt: string;
  }>;
};
type Settings = {
  timezone: string;
  workingHourStart: number;
  workingHourEnd: number;
  meetingDuration: number;
  meetingBuffer: number;
  autoCreateTasks: boolean;
  requireSendApproval: boolean;
  requireScheduleApproval: boolean;
};
const copy: Record<Kind, [string, string]> = {
  dashboard: ["Today’s brief", "Your live inbox, schedule, and commitments."],
  inbox: [
    "Priority inbox",
    "Messages analyzed by urgency and required action.",
  ],
  tasks: ["Tasks", "Every database-backed commitment and follow-up."],
  calendar: [
    "Calendar",
    "Upcoming synchronized events and scheduling context.",
  ],
  approvals: [
    "Approvals",
    "Review sensitive actions before Chief executes them.",
  ],
  activity: [
    "Agent activity",
    "A safe operational timeline of completed work.",
  ],
  settings: ["Settings", "Your stored workday and automation boundaries."],
};
const endpoint: Record<Kind, string> = {
  dashboard: "/api/dashboard",
  inbox: "/api/inbox",
  tasks: "/api/tasks",
  calendar: "/api/calendar",
  approvals: "/api/approvals",
  activity: "/api/activity",
  settings: "/api/settings",
};
export function WorkspacePage({ kind }: { kind: Kind }) {
  const [setup, setSetup] = useState<Setup | null>(null),
    [data, setData] = useState<unknown>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [syncing, setSyncing] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [setupResponse, dataResponse] = await Promise.all([
        fetch("/api/setup"),
        fetch(endpoint[kind]),
      ]);
      if (dataResponse.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!dataResponse.ok)
        throw new Error("Chief could not load this workspace view.");
      const setupPayload = setupResponse.ok ? await setupResponse.json() : null;
      setSetup(setupPayload?.integrations ?? null);
      setData(await dataResponse.json());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Chief could not load this workspace view.",
      );
    } finally {
      setLoading(false);
    }
  }, [kind]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const events = new EventSource("/api/events");
    events.onmessage = () => void load();
    return () => events.close();
  }, [load]);
  const sync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch("/api/inbox/sync", { method: "POST" });
      if (!response.ok)
        throw new Error("Gmail synchronization could not be queued.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Synchronization failed.",
      );
    } finally {
      setSyncing(false);
    }
  };
  const [title, subtitle] = copy[kind];
  return (
    <div className="content">
      <div className="section-head">
        <div>
          <div className="eyebrow">Chief of Staff</div>
          <h1 className="title">{title}</h1>
          <div className="subtle">{subtitle}</div>
        </div>
        {["inbox", "dashboard"].includes(kind) && (
          <button className="button primary" onClick={sync} disabled={syncing}>
            {syncing ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <RefreshCw size={15} />
            )}
            Sync Gmail
          </button>
        )}
      </div>
      {setup && (!setup.google || !setup.gemini) && (
        <div className="notice">
          <AlertTriangle size={19} />
          <div>
            <strong>Complete your workspace setup</strong>
            <div>
              {!setup.google
                ? "Add Google OAuth credentials to connect Gmail and Calendar. "
                : ""}
              {!setup.gemini ? "Add a Gemini API key to enable analysis." : ""}
            </div>
          </div>
        </div>
      )}
      {loading || data === null ? (
        <Loading />
      ) : error ? (
        <Failure message={error} retry={load} />
      ) : (
        <Content kind={kind} data={data} />
      )}
    </div>
  );
}
function Content({ kind, data }: { kind: Kind; data: unknown }) {
  if (kind === "dashboard") return <Dashboard data={data as DashboardData} />;
  if (kind === "inbox") return <Inbox data={data as Email[]} />;
  if (kind === "tasks") return <Tasks data={data as Task[]} />;
  if (kind === "calendar") return <Calendar data={data as CalendarEvent[]} />;
  if (kind === "approvals") return <Approvals data={data as Approval[]} />;
  if (kind === "activity") return <AgentActivity data={data as AgentRun[]} />;
  return <SettingsPanel data={data as Settings} />;
}
function Loading() {
  return (
    <section className="card state">
      <LoaderCircle className="spin" />
      <strong>Loading your workspace</strong>
      <span className="subtle">Chief is retrieving current data.</span>
    </section>
  );
}
function Failure({
  message,
  retry,
}: {
  message: string;
  retry: () => Promise<void>;
}) {
  return (
    <section className="card state">
      <AlertTriangle />
      <strong>Unable to load this view</strong>
      <span className="subtle">{message}</span>
      <button className="button" onClick={() => void retry()}>
        Try again
      </button>
    </section>
  );
}
function Empty({
  Icon,
  title,
  detail,
}: {
  Icon: typeof InboxIcon;
  title: string;
  detail: string;
}) {
  return (
    <div className="empty">
      <Icon size={26} />
      <strong>{title}</strong>
      <div className="subtle">{detail}</div>
    </div>
  );
}
function Dashboard({ data }: { data: DashboardData }) {
  const metrics = [
    {
      label: "Needs attention",
      value: data.metrics.attention,
      Icon: InboxIcon,
    },
    {
      label: "Pending approvals",
      value: data.metrics.pending,
      Icon: ShieldCheck,
    },
    {
      label: "Tasks due today",
      value: data.metrics.tasksDue,
      Icon: CheckCircle2,
    },
    {
      label: "Meetings today",
      value: data.metrics.meetings,
      Icon: CalendarDays,
    },
  ];
  return (
    <>
      <div className="grid4">
        {metrics.map(({ label, value, Icon }) => (
          <div className="card" key={label}>
            <div className="metric-label">
              <span>{label}</span>
              <Icon size={17} />
            </div>
            <div className="metric">{value}</div>
          </div>
        ))}
      </div>
      <section className="card">
        <div className="section-head">
          <h2>Recent agent activity</h2>
          <Activity size={17} />
        </div>
        {data.recent.length ? (
          <div className="list">
            {data.recent.map((run) => (
              <Link
                className="list-item item-link"
                href={`/activity/${run.id}`}
                key={run.id}
              >
                <span className="dot" />
                <div className="grow">
                  <strong>
                    {run.steps[0]?.title ?? run.status.replaceAll("_", " ")}
                  </strong>
                  <div className="subtle">{formatDate(run.createdAt)}</div>
                </div>
                <span className="badge">{run.status}</span>
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            Icon={Activity}
            title="No agent runs yet"
            detail="Synchronize Gmail to start the first workflow."
          />
        )}
      </section>
    </>
  );
}
function Inbox({ data }: { data: Email[] }) {
  return (
    <section className="card">
      {data.length ? (
        <div className="list">
          {data.map((email) => (
            <Link
              className="list-item item-link"
              href={`/inbox/${email.id}`}
              key={email.id}
            >
              <span
                className="dot"
                style={{ opacity: email.unread ? 1 : 0.2 }}
              />
              <div className="grow">
                <strong>{email.subject}</strong>
                <div className="subtle">
                  {email.sender} ·{" "}
                  {email.analysisRecord?.summary ?? email.preview}
                </div>
              </div>
              {email.analysisRecord && (
                <span className="badge">{email.analysisRecord.priority}</span>
              )}
              <time className="subtle">{formatDate(email.receivedAt)}</time>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          Icon={InboxIcon}
          title="No synchronized messages"
          detail="Use Sync Gmail to retrieve your recent messages."
        />
      )}
    </section>
  );
}
function Tasks({ data }: { data: Task[] }) {
  const columns = [
      "BACKLOG",
      "TODO",
      "IN_PROGRESS",
      "WAITING",
      "DONE",
    ] as const,
    [tasks, setTasks] = useState(data),
    [failure, setFailure] = useState<string | null>(null);
  const move = async (task: Task, status: (typeof columns)[number]) => {
    const previous = task.status;
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, status } : item)),
    );
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, status: previous } : item,
        ),
      );
      setFailure("Task status could not be updated.");
    }
  };
  return (
    <>
      {failure && (
        <div className="notice">
          <AlertTriangle size={17} />
          {failure}
        </div>
      )}
      <div className="kanban">
        {columns.map((status) => {
          const columnTasks = tasks.filter((task) => task.status === status);
          return (
            <div className="column" key={status}>
              <div className="column-title">
                <span>{status.replaceAll("_", " ")}</span>
                <span className="badge">{columnTasks.length}</span>
              </div>
              {columnTasks.map((task) => (
                <div className="task" key={task.id}>
                  <strong>{task.title}</strong>
                  <div className="row task-meta">
                    <span className="badge">{task.priority}</span>
                    <span className="subtle">{task.source}</span>
                  </div>
                  {task.dueAt && (
                    <div className="subtle">Due {formatDate(task.dueAt)}</div>
                  )}
                  <label className="field task-status">
                    Status
                    <select
                      className="input"
                      value={task.status}
                      onChange={(event) =>
                        void move(
                          task,
                          event.target.value as (typeof columns)[number],
                        )
                      }
                    >
                      {columns.map((option) => (
                        <option value={option} key={option}>
                          {option.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
              {!columnTasks.length && (
                <div className="subtle column-empty">
                  No tasks in this status
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
function Calendar({ data }: { data: CalendarEvent[] }) {
  return (
    <section className="card">
      {data.length ? (
        <div className="list">
          {data.map((event) => (
            <div className="list-item" key={event.id}>
              <CalendarDays size={18} />
              <div className="grow">
                <strong>{event.title}</strong>
                <div className="subtle">
                  {formatRange(event.startAt, event.endAt)}
                  {event.attendees.length
                    ? ` · ${event.attendees.length} attendee${event.attendees.length === 1 ? "" : "s"}`
                    : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          Icon={CalendarDays}
          title="No upcoming events"
          detail="Calendar events will appear after Google synchronization."
        />
      )}
    </section>
  );
}
function Approvals({ data }: { data: Approval[] }) {
  return (
    <section className="card">
      {data.length ? (
        <div className="list">
          {data.map((approval) => (
            <Link
              className="list-item item-link"
              href={`/approvals/${approval.id}`}
              key={approval.id}
            >
              <ShieldCheck size={18} />
              <div className="grow">
                <strong>
                  {approval.draft?.subject ??
                    approval.type.replaceAll("_", " ")}
                </strong>
                <div className="subtle">
                  {approval.reason} · {formatDate(approval.requestedAt)}
                </div>
              </div>
              <span className="badge">{approval.status}</span>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          Icon={ShieldCheck}
          title="No approval requests"
          detail="Sensitive actions generated by Chief will wait here."
        />
      )}
    </section>
  );
}
function AgentActivity({ data }: { data: AgentRun[] }) {
  return (
    <section className="card">
      {data.length ? (
        <div className="list">
          {data.map((run) => (
            <Link
              className="list-item item-link"
              href={`/activity/${run.id}`}
              key={run.id}
            >
              <Activity size={18} />
              <div className="grow">
                <strong>
                  {run.resultSummary ??
                    run.steps[0]?.title ??
                    run.trigger.replaceAll("_", " ")}
                </strong>
                <div className="subtle">
                  {formatDate(run.createdAt)} · {run.steps.length} recorded step
                  {run.steps.length === 1 ? "" : "s"}
                </div>
              </div>
              <span className="badge">{run.status}</span>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          Icon={Activity}
          title="No agent activity"
          detail="Operational events will appear after Chief processes work."
        />
      )}
    </section>
  );
}
function SettingsPanel({ data }: { data: Settings }) {
  const [form, setForm] = useState(data),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState<string | null>(null);
  const number = (key: keyof Settings, value: string) =>
    setForm((current) => ({ ...current, [key]: Number(value) }));
  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error("Settings could not be saved.");
      setMessage("Settings saved.");
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Settings could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="split">
      <section className="card">
        <div className="section-head">
          <h2>General</h2>
        </div>
        <div className="form-grid">
          <label className="field">
            Timezone
            <input
              className="input"
              value={form.timezone}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  timezone: event.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            Meeting duration
            <input
              className="input"
              type="number"
              min="15"
              max="180"
              value={form.meetingDuration}
              onChange={(event) =>
                number("meetingDuration", event.target.value)
              }
            />
          </label>
          <label className="field">
            Working day starts
            <input
              className="input"
              type="number"
              min="0"
              max="23"
              value={form.workingHourStart}
              onChange={(event) =>
                number("workingHourStart", event.target.value)
              }
            />
          </label>
          <label className="field">
            Working day ends
            <input
              className="input"
              type="number"
              min="1"
              max="24"
              value={form.workingHourEnd}
              onChange={(event) => number("workingHourEnd", event.target.value)}
            />
          </label>
          <label className="field">
            Calendar buffer
            <input
              className="input"
              type="number"
              min="0"
              max="120"
              value={form.meetingBuffer}
              onChange={(event) => number("meetingBuffer", event.target.value)}
            />
          </label>
        </div>
        {message && <p className="subtle">{message}</p>}
        <button
          className="button primary"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </section>
      <section className="card">
        <div className="section-head">
          <h2>Safety controls</h2>
          <ShieldCheck size={17} />
        </div>
        <Toggle
          label="Approval before sending"
          enabled={form.requireSendApproval}
          change={(value) =>
            setForm((current) => ({ ...current, requireSendApproval: value }))
          }
        />
        <Toggle
          label="Approval before scheduling"
          enabled={form.requireScheduleApproval}
          change={(value) =>
            setForm((current) => ({
              ...current,
              requireScheduleApproval: value,
            }))
          }
        />
        <Toggle
          label="Automatic safe task creation"
          enabled={form.autoCreateTasks}
          change={(value) =>
            setForm((current) => ({ ...current, autoCreateTasks: value }))
          }
        />
      </section>
    </div>
  );
}
function Toggle({
  label,
  enabled,
  change,
}: {
  label: string;
  enabled: boolean;
  change: (value: boolean) => void;
}) {
  return (
    <button
      className="list-item settings-toggle"
      onClick={() => change(!enabled)}
    >
      <span>
        {enabled ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      </span>
      <span className="grow">
        <strong>{label}</strong>
        <span className="subtle toggle-state">
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </span>
    </button>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
function formatRange(start: string, end: string) {
  return `${formatDate(start)}–${new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(end))}`;
}
