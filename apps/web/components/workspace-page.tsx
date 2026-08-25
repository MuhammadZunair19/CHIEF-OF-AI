"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Archive,
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Columns3,
  Gauge,
  Grid2X2,
  Inbox as InboxIcon,
  Keyboard,
  Layers3,
  ListTodo,
  LoaderCircle,
  Palette,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
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
  command: {
    overdue: Task[];
    meetings: CalendarEvent[];
    priorityEmails: Email[];
    focusMinutes: number;
    dayScore: number;
  };
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
  theme: "system" | "light" | "dark";
  accent: "violet" | "ocean" | "ember" | "mint";
  motion: "full" | "reduced";
  density: "comfortable" | "compact";
  taskView: "kanban" | "sprint" | "list" | "matrix";
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
      <section className="command-hero card">
        <div className="command-copy">
          <div className="eyebrow"><span className="live-dot" /> Live command center</div>
          <h2>{greeting()}, your day is {data.command.dayScore >= 75 ? "under control" : "asking for attention"}.</h2>
          <p className="subtle">{data.command.overdue.length ? `${data.command.overdue.length} overdue commitment${data.command.overdue.length === 1 ? "" : "s"} should be handled first.` : "No overdue commitments. You have room to work proactively."}</p>
          <div className="command-actions">
            <Link className="button primary" href="/tasks"><Zap size={16} />Plan my day</Link>
            <Link className="button" href="/approvals">Review approvals<ArrowUpRight size={15} /></Link>
          </div>
        </div>
        <div className="day-orbit" style={{"--score": `${data.command.dayScore * 3.6}deg`} as React.CSSProperties}>
          <div><strong>{data.command.dayScore}</strong><span>day score</span></div>
          <i className="orbit-dot" />
        </div>
      </section>
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
      <div className="command-grid">
        <section className="card command-panel">
          <div className="section-head"><h2>Next on your calendar</h2><CalendarDays size={17} /></div>
          {data.command.meetings.length ? data.command.meetings.slice(0,3).map((meeting)=><div className="command-line" key={meeting.id}><time>{new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(new Date(meeting.startAt))}</time><div><strong>{meeting.title}</strong><span className="subtle">{meeting.attendees.length} attendee{meeting.attendees.length===1?"":"s"}</span></div></div>) : <div className="mini-empty">Your calendar is clear for the rest of today.</div>}
        </section>
        <section className="card command-panel focus-panel">
          <div className="section-head"><h2>Focus capacity</h2><Clock3 size={17} /></div>
          <strong className="focus-number">{Math.floor(data.command.focusMinutes/60)}h {data.command.focusMinutes%60}m</strong>
          <span className="subtle">Estimated open capacity after today&apos;s synchronized meetings.</span>
          <div className="focus-meter"><i style={{width:`${Math.min(100,data.command.focusMinutes/4.8)}%`}} /></div>
        </section>
        <section className="card command-panel">
          <div className="section-head"><h2>Priority signals</h2><InboxIcon size={17} /></div>
          {data.command.priorityEmails.length ? data.command.priorityEmails.slice(0,3).map((email)=><Link className="command-line item-link" href={`/inbox/${email.id}`} key={email.id}><span className="dot"/><div><strong>{email.subject}</strong><span className="subtle">{email.sender}</span></div></Link>) : <div className="mini-empty">No analyzed messages currently need action.</div>}
        </section>
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
function greeting(){const hour=new Date().getHours();return hour<12?"Good morning":hour<18?"Good afternoon":"Good evening"}
function Inbox({ data }: { data: Email[] }) {
  const [emails,setEmails]=useState(data),[cursor,setCursor]=useState(0),[selected,setSelected]=useState<Set<string>>(new Set()),[notice,setNotice]=useState<string|null>(null);
  const active=emails[cursor];
  const apply=useCallback(async(action:"SNOOZE"|"HANDLE",override?:string[])=>{const ids=override??(selected.size?[...selected]:active?[active.id]:[]);if(!ids.length)return;const response=await fetch("/api/inbox/triage",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({ids,action,...action==="SNOOZE"?{days:1}:{}})});if(response.ok){setEmails(current=>current.filter(email=>!ids.includes(email.id)));setSelected(new Set());setCursor(0);setNotice(action==="SNOOZE"?"Email snoozed until tomorrow.":"Email marked handled.")}},[active,selected]);
  const run=useCallback(async(action:"ANALYZE"|"TASK"|"REPLY")=>{if(!active)return;if(action==="REPLY"){location.assign(`/inbox/${active.id}?compose=1`);return}const response=await fetch(`/api/inbox/${active.id}/${action==="ANALYZE"?"analyze":"task"}`,{method:"POST"});setNotice(response.ok?action==="ANALYZE"?"Analysis queued.":"Task created from email.":action==="TASK"?"A task already exists for this email.":"Analysis could not be queued.")},[active]);
  useEffect(()=>{const keyboard=(event:KeyboardEvent)=>{const target=event.target as HTMLElement;if(["INPUT","TEXTAREA","SELECT"].includes(target.tagName))return;const key=event.key.toLowerCase();if(key==="j"){event.preventDefault();setCursor(current=>Math.min(emails.length-1,current+1))}if(key==="k"){event.preventDefault();setCursor(current=>Math.max(0,current-1))}if(key==="a")void run("ANALYZE");if(key==="t")void run("TASK");if(key==="r")void run("REPLY");if(key==="s")void apply("SNOOZE");if(key==="e")void apply("HANDLE");if(key==="enter"&&active)location.assign(`/inbox/${active.id}`);if(key==="escape")setSelected(new Set())};window.addEventListener("keydown",keyboard);return()=>window.removeEventListener("keydown",keyboard)},[active,apply,emails.length,run]);
  const toggle=(id:string)=>setSelected(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next});
  return (
    <>
    <PushSyncStatus />
    <section className="card">
      <div className="triage-toolbar"><div><Keyboard size={16}/><strong>{selected.size?`${selected.size} selected`:"Keyboard triage"}</strong><span className="subtle">J/K navigate · A analyze · T task · R reply · S snooze · E handled</span></div>{selected.size>0&&<div className="row"><button className="button" onClick={()=>void apply("SNOOZE")}><Clock3 size={14}/>Snooze</button><button className="button" onClick={()=>void apply("HANDLE")}><Archive size={14}/>Handled</button></div>}</div>
      {notice&&<div className="triage-notice">{notice}</div>}
      {emails.length ? (
        <div className="list">
          {emails.map((email,index) => (
            <div className={`triage-row ${cursor===index?"cursor":""} ${selected.has(email.id)?"selected":""}`} key={email.id}>
            <button className="select-email" onClick={()=>toggle(email.id)} aria-label={`${selected.has(email.id)?"Deselect":"Select"} ${email.subject}`}><i>{selected.has(email.id)&&<CheckCircle2 size={13}/>}</i></button>
            <Link
              className="list-item item-link"
              href={`/inbox/${email.id}`}
              onMouseEnter={()=>setCursor(index)}
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
            </div>
          ))}
        </div>
      ) : (
        <Empty
          Icon={InboxIcon}
          title="No synchronized messages"
          detail="Your active inbox is clear. Sync Gmail or wait for live updates."
        />
      )}
    </section>
    </>
  );
}
function PushSyncStatus(){const[status,setStatus]=useState<{configured:boolean;active:boolean;expiresAt:string|null;lastNotificationAt:string|null}|null>(null),[starting,setStarting]=useState(false),[error,setError]=useState<string|null>(null);const load=useCallback(()=>fetch("/api/gmail/watch").then(response=>response.ok?response.json():null).then(setStatus).catch(()=>setStatus(null)),[]);useEffect(()=>{void load()},[load]);const start=async()=>{setStarting(true);setError(null);try{const response=await fetch("/api/gmail/watch",{method:"POST"});if(!response.ok)throw new Error("Live Gmail updates could not be enabled.");await load()}catch(cause){setError(cause instanceof Error?cause.message:"Live Gmail updates could not be enabled.")}finally{setStarting(false)}};if(!status)return null;return <section className={`push-status ${status.active?"active":""}`}><div className="push-icon"><RadioTower size={18}/><i/></div><div className="grow"><strong>{status.active?"Live Gmail updates are active":status.configured?"Enable live Gmail updates":"Live updates need Pub/Sub setup"}</strong><span className="subtle">{status.active?`Chief listens for new inbox activity${status.lastNotificationAt?` · Last signal ${formatDate(status.lastNotificationAt)}`:""}.`:status.configured?"Start a secure Gmail watch to sync without polling.":"Add the Google Cloud project, Pub/Sub topic, OIDC audience, and service account settings."}</span>{error&&<span className="danger-text">{error}</span>}</div>{status.configured&&!status.active&&<button className="button primary" disabled={starting} onClick={()=>void start()}>{starting?<LoaderCircle className="spin" size={15}/>:<RadioTower size={15}/>}Enable live sync</button>}{status.active&&status.expiresAt&&<span className="badge">Renews before {new Date(status.expiresAt).toLocaleDateString()}</span>}</section>}
function Tasks({ data }: { data: Task[] }) {
  const columns = [
      "BACKLOG",
      "TODO",
      "IN_PROGRESS",
      "WAITING",
      "DONE",
    ] as const,
    [tasks, setTasks] = useState(data),
    [failure, setFailure] = useState<string | null>(null),
    [view, setView] = useState<"kanban" | "sprint" | "list" | "matrix">("kanban");
  useEffect(() => {
    const saved = localStorage.getItem("chief-task-view");
    if (["kanban", "sprint", "list", "matrix"].includes(saved ?? ""))
      setView(saved as typeof view);
    fetch("/api/settings")
      .then((response) => (response.ok ? response.json() : null))
      .then((settings) => settings?.taskView && setView(settings.taskView))
      .catch(() => undefined);
  }, []);
  const chooseView = (next: typeof view) => {
    setView(next);
    localStorage.setItem("chief-task-view", next);
  };
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
      <div className="task-toolbar">
        <div>
          <strong>{tasks.filter((task) => !["DONE", "ARCHIVED"].includes(task.status)).length} open commitments</strong>
          <span className="subtle">Switch perspective without changing your data.</span>
        </div>
        <div className="view-tabs" role="tablist" aria-label="Task view">
          {([
            ["kanban", "Kanban", Columns3],
            ["sprint", "Sprint", Gauge],
            ["list", "List", ListTodo],
            ["matrix", "Matrix", Grid2X2],
          ] as const).map(([value, label, Icon]) => (
            <button className={view === value ? "active" : ""} onClick={() => chooseView(value)} key={value} role="tab" aria-selected={view === value}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>
      </div>
      {view === "kanban" && <div className="kanban">
        {columns.map((status) => {
          const columnTasks = tasks.filter((task) => task.status === status);
          return (
            <div className="column" key={status}>
              <div className="column-title">
                <span>{status.replaceAll("_", " ")}</span>
                <span className="badge">{columnTasks.length}</span>
              </div>
              {columnTasks.map((task) => <TaskCard key={task.id} task={task} columns={columns} move={move} />)}
              {!columnTasks.length && (
                <div className="subtle column-empty">
                  No tasks in this status
                </div>
              )}
            </div>
          );
        })}
      </div>}
      {view === "list" && <div className="card task-list-view">{tasks.map((task) => <TaskCard key={task.id} task={task} columns={columns} move={move} compact />)}{!tasks.length && <Empty Icon={ListTodo} title="No tasks yet" detail="Tasks created from selected emails will appear here." />}</div>}
      {view === "sprint" && <SprintView tasks={tasks} columns={columns} move={move} />}
      {view === "matrix" && <MatrixView tasks={tasks} columns={columns} move={move} />}
    </>
  );
}
function TaskCard({ task, columns, move, compact=false }: { task: Task; columns: readonly ["BACKLOG", "TODO", "IN_PROGRESS", "WAITING", "DONE"]; move: (task: Task, status: (typeof columns)[number]) => Promise<void>; compact?: boolean }) {
  return <div className={`task ${compact ? "task-row" : ""}`}><div className="grow"><strong>{task.title}</strong><div className="row task-meta"><span className={`badge priority-${task.priority.toLowerCase()}`}>{task.priority}</span><span className="subtle">{task.source}</span>{task.dueAt && <span className="subtle">Due {formatDate(task.dueAt)}</span>}</div></div><label className="field task-status"><span>Status</span><select className="input" value={task.status} onChange={(event) => void move(task, event.target.value as (typeof columns)[number])}>{columns.map((option) => <option value={option} key={option}>{option.replaceAll("_", " ")}</option>)}</select></label></div>;
}
function SprintView({ tasks, columns, move }: { tasks: Task[]; columns: readonly ["BACKLOG", "TODO", "IN_PROGRESS", "WAITING", "DONE"]; move: (task: Task, status: (typeof columns)[number]) => Promise<void> }) {
  const completed=tasks.filter((task)=>task.status==="DONE").length,progress=tasks.length?Math.round(completed/tasks.length*100):0,groups=[{title:"In focus",detail:"Work currently moving",items:tasks.filter((task)=>["IN_PROGRESS","WAITING"].includes(task.status))},{title:"Sprint queue",detail:"Ready and planned",items:tasks.filter((task)=>["BACKLOG","TODO"].includes(task.status))},{title:"Completed",detail:"Finished commitments",items:tasks.filter((task)=>task.status==="DONE")}];
  return <div className="sprint-view"><section className="card sprint-health"><div><div className="eyebrow">Sprint health</div><strong>{progress}% complete</strong><span className="subtle">{completed} of {tasks.length} commitments finished</span></div><div className="progress-ring" style={{"--progress":`${progress*3.6}deg`} as React.CSSProperties}><span>{progress}%</span></div></section><div className="sprint-groups">{groups.map((group)=><section className="card" key={group.title}><div className="section-head"><div><h2>{group.title}</h2><span className="subtle">{group.detail}</span></div><span className="badge">{group.items.length}</span></div>{group.items.map((task)=><TaskCard key={task.id} task={task} columns={columns} move={move} compact />)}{!group.items.length&&<div className="subtle column-empty">Nothing here yet</div>}</section>)}</div></div>;
}
function MatrixView({ tasks, columns, move }: { tasks: Task[]; columns: readonly ["BACKLOG", "TODO", "IN_PROGRESS", "WAITING", "DONE"]; move: (task: Task, status: (typeof columns)[number]) => Promise<void> }) {
  const open=tasks.filter((task)=>task.status!=="DONE"),quadrants=[{title:"Do now",detail:"Urgent or high priority",items:open.filter((task)=>["URGENT","HIGH"].includes(task.priority)&&task.status!=="WAITING")},{title:"Plan next",detail:"Important, not urgent",items:open.filter((task)=>task.priority==="MEDIUM"&&task.status!=="WAITING")},{title:"Waiting",detail:"Blocked or delegated",items:open.filter((task)=>task.status==="WAITING")},{title:"Low leverage",detail:"Review when capacity opens",items:open.filter((task)=>task.priority==="LOW"&&task.status!=="WAITING")}];
  return <div className="matrix-view">{quadrants.map((quadrant,index)=><section className={`card matrix-quadrant q${index+1}`} key={quadrant.title}><div className="section-head"><div><h2>{quadrant.title}</h2><span className="subtle">{quadrant.detail}</span></div><span className="badge">{quadrant.items.length}</span></div>{quadrant.items.map((task)=><TaskCard key={task.id} task={task} columns={columns} move={move} compact />)}{!quadrant.items.length&&<div className="subtle column-empty">No matching tasks</div>}</section>)}</div>;
}
function Calendar({ data }: { data: CalendarEvent[] }) {
  return (
    <><FocusPlanner /><section className="card">
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
    </section></>
  );
}
function FocusPlanner(){const[suggestions,setSuggestions]=useState<Array<{start:string;end:string;score:number}>>([]),[loading,setLoading]=useState(true),[pending,setPending]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);useEffect(()=>{fetch("/api/calendar/focus").then(response=>response.ok?response.json():[]).then(setSuggestions).finally(()=>setLoading(false))},[]);const propose=async(slot:{start:string;end:string})=>{setPending(slot.start);const response=await fetch("/api/calendar/focus",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title:"Focus time",start:slot.start,end:slot.end,autoDecline:false})});setPending(null);setMessage(response.ok?"Focus block sent to Approvals.":"Focus block could not be proposed.")};return <section className="focus-planner card"><div className="section-head"><div><div className="eyebrow">Schedule defense</div><h2>Protect deep work</h2><span className="subtle">Open 90-minute windows calculated from your live calendar.</span></div><ShieldCheck size={18}/></div>{loading?<div className="mini-empty"><LoaderCircle className="spin"/></div>:suggestions.length?<div className="focus-suggestions">{suggestions.map(slot=><button className="focus-slot" onClick={()=>void propose(slot)} disabled={pending===slot.start} key={slot.start}><div className="focus-score"><strong>{slot.score}</strong><span>quality</span></div><div><strong>{new Intl.DateTimeFormat(undefined,{weekday:"short",month:"short",day:"numeric"}).format(new Date(slot.start))}</strong><span>{new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(new Date(slot.start))}–{new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(new Date(slot.end))}</span></div>{pending===slot.start?<LoaderCircle className="spin" size={16}/>:<ArrowUpRight size={16}/>}</button>)}</div>:<div className="mini-empty">No 90-minute focus windows are available in the next week.</div>}{message&&<p className="subtle">{message}</p>}</section>}
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
      window.dispatchEvent(new Event("chief-preferences"));
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Settings could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="settings-layout">
      <section className="card settings-span">
        <div className="section-head">
          <div>
            <h2>Workspace appearance</h2>
            <div className="subtle">Shape how Chief looks and moves.</div>
          </div>
          <Palette size={18} />
        </div>
        <div className="preference-groups">
          <PreferenceGroup label="Theme">
            {(["system", "light", "dark"] as const).map((value) => (
              <Choice
                key={value}
                label={value}
                active={form.theme === value}
                onClick={() => setForm((current) => ({ ...current, theme: value }))}
              />
            ))}
          </PreferenceGroup>
          <PreferenceGroup label="Accent">
            {(["violet", "ocean", "ember", "mint"] as const).map((value) => (
              <Choice
                key={value}
                label={value}
                swatch={value}
                active={form.accent === value}
                onClick={() => setForm((current) => ({ ...current, accent: value }))}
              />
            ))}
          </PreferenceGroup>
          <PreferenceGroup label="Motion">
            {(["full", "reduced"] as const).map((value) => (
              <Choice
                key={value}
                label={value}
                active={form.motion === value}
                onClick={() => setForm((current) => ({ ...current, motion: value }))}
              />
            ))}
          </PreferenceGroup>
          <PreferenceGroup label="Density">
            {(["comfortable", "compact"] as const).map((value) => (
              <Choice
                key={value}
                label={value}
                active={form.density === value}
                onClick={() => setForm((current) => ({ ...current, density: value }))}
              />
            ))}
          </PreferenceGroup>
        </div>
      </section>
      <section className="card settings-span">
        <div className="section-head">
          <div>
            <h2>Task workspace</h2>
            <div className="subtle">Choose the default planning perspective.</div>
          </div>
          <Layers3 size={18} />
        </div>
        <div className="view-choices">
          {([
            ["kanban", "Kanban", "Move work through status columns."],
            ["sprint", "Sprint", "Focus on active and upcoming work."],
            ["list", "List", "Scan every commitment in one view."],
            ["matrix", "Priority matrix", "Balance urgency and importance."],
          ] as const).map(([value, label, detail]) => (
            <button
              className={`view-choice ${form.taskView === value ? "active" : ""}`}
              onClick={() => setForm((current) => ({ ...current, taskView: value }))}
              key={value}
            >
              <ListTodo size={18} />
              <span><strong>{label}</strong><small>{detail}</small></span>
              <i />
            </button>
          ))}
        </div>
      </section>
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
      <div className="settings-savebar settings-span">
        <div>
          <strong>{message ?? "Preferences are saved to your workspace."}</strong>
          <span className="subtle">Changes apply across signed-in sessions.</span>
        </div>
        <button
          className="button primary"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
          {saving ? "Saving…" : "Apply customization"}
        </button>
      </div>
    </div>
  );
}
function PreferenceGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="preference-group"><span>{label}</span><div className="choice-row">{children}</div></div>;
}
function Choice({ label, active, swatch, onClick }: { label: string; active: boolean; swatch?: string; onClick: () => void }) {
  return <button className={`choice ${active ? "active" : ""}`} onClick={onClick}>{swatch && <i className={`swatch ${swatch}`} />}<span>{label}</span>{active && <CheckCircle2 size={14} />}</button>;
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
