"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  History,
  LoaderCircle,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  XCircle,
} from "lucide-react";
type DetailKind = "inbox" | "approvals" | "activity";
type Email = {
  sender: string;
  subject: string;
  bodyText: string | null;
  preview: string;
  receivedAt: string;
  analysisRecord?: {
    summary: string;
    category: string;
    priority: string;
    requiresAction: boolean;
  } | null;
  tasks: Array<{ id: string; title: string; priority: string }>;
  drafts: Array<{
    id: string;
    body: string;
    subject: string;
    recipients: string[];
    status: string;
    createdAt: string;
  }>;
};
type Approval = {
  id: string;
  type: string;
  reason: string;
  riskLevel: string;
  status: string;
  requestedAt: string;
  payload: unknown;
  draft: { body: string; subject: string; recipients: string[] } | null;
};
type Run = {
  status: string;
  trigger: string;
  createdAt: string;
  resultSummary: string | null;
  error: string | null;
  steps: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    startedAt: string;
  }>;
  toolCalls: Array<{
    id: string;
    toolName: string;
    status: string;
    resultSummary: string | null;
    timestamp: string;
  }>;
};
export function DetailView({ kind, id }: { kind: DetailKind; id: string }) {
  const [data, setData] = useState<unknown>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/${kind}/${id}`);
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok) throw new Error("This record could not be loaded.");
      setData(await response.json());
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This record could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [id, kind]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (kind !== "inbox") return;
    const events = new EventSource("/api/events");
    events.onmessage = () => void load();
    return () => events.close();
  }, [kind, load]);
  if (loading)
    return (
      <State
        icon={<LoaderCircle className="spin" />}
        title="Loading current record"
      />
    );
  if (error) return <State icon={<AlertTriangle />} title={error} />;
  if (kind === "inbox") return <EmailDetail id={id} data={data as Email} />;
  if (kind === "approvals")
    return <ApprovalDetail data={data as Approval} reload={load} />;
  return <RunDetail data={data as Run} />;
}
function EmailDetail({ id, data }: { id: string; data: Email }) {
  const [analyzing, setAnalyzing] = useState(false),
    [message, setMessage] = useState<string | null>(null);
  const analyze = async () => {
    setAnalyzing(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/inbox/${id}/analyze`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Analysis could not be queued.");
      }
      setMessage("Analysis queued. This page will update when it finishes.");
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Analysis could not be queued.",
      );
    } finally {
      setAnalyzing(false);
    }
  };
  return (
    <div className="content">
      <div className="eyebrow">
        Inbox · {new Date(data.receivedAt).toLocaleString()}
      </div>
      <h1 className="title">{data.subject}</h1>
      <div className="subtle">From {data.sender}</div>
      <div className="split detail-grid">
        <section className="card">
          <div className="section-head">
            <h2>Message</h2>
            <Mail size={17} />
          </div>
          <p className="message-body">{data.bodyText ?? data.preview}</p>
        </section>
        <aside className="card">
          <div className="section-head">
            <h2>Chief analysis</h2>
            {data.analysisRecord && (
              <span className="badge">{data.analysisRecord.priority}</span>
            )}
          </div>
          {data.analysisRecord ? (
            <>
              <p>{data.analysisRecord.summary}</p>
              <div className="subtle">
                {data.analysisRecord.category.replaceAll("_", " ")}
              </div>
              {data.tasks.map((task) => (
                <div className="list-item" key={task.id}>
                  <CheckCircle2 size={17} />
                  <div>
                    {task.title}
                    <div className="subtle">{task.priority}</div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <p className="subtle">
                Analyze this message only when you need Chief&apos;s help.
              </p>
              <button
                className="button primary"
                disabled={analyzing}
                onClick={() => void analyze()}
              >
                {analyzing ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Sparkles size={16} />
                )}
                Analyze email
              </button>
              {message && <p className="subtle">{message}</p>}
            </>
          )}
        </aside>
      </div>
      <ReplyStudio
        key={data.drafts[0]?.id ?? "new"}
        emailId={id}
        drafts={data.drafts}
      />
    </div>
  );
}
function ReplyStudio({
  emailId,
  drafts,
}: {
  emailId: string;
  drafts: Email["drafts"];
}) {
  const [currentId, setCurrentId] = useState(drafts[0]?.id ?? null),
    current = drafts.find((draft) => draft.id === currentId) ?? drafts[0],
    [body, setBody] = useState(current?.body ?? ""),
    [subject, setSubject] = useState(current?.subject ?? ""),
    [recipients, setRecipients] = useState(
      current?.recipients.join(", ") ?? "",
    ),
    [tone, setTone] = useState<
      "friendly" | "formal" | "direct" | "concise" | "detailed"
    >("friendly"),
    [working, setWorking] = useState(false),
    [message, setMessage] = useState<string | null>(null);
  const select = (draft: Email["drafts"][number]) => {
    setCurrentId(draft.id);
    setBody(draft.body);
    setSubject(draft.subject);
    setRecipients(draft.recipients.join(", "));
    setMessage(null);
  };
  const generate = async () => {
    setWorking(true);
    setMessage(null);
    const response = await fetch(`/api/inbox/${emailId}/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tone }),
    });
    setMessage(
      response.ok
        ? "Draft queued. Chief will refresh this studio when it is ready."
        : "Draft generation could not be queued.",
    );
    setWorking(false);
  };
  const save = async () => {
    if (!current) return;
    setWorking(true);
    const response = await fetch(`/api/drafts/${current.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        body,
        subject,
        recipients: recipients
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      }),
    });
    setMessage(
      response.ok
        ? "Draft changes saved."
        : "Draft could not be saved. Check recipient addresses.",
    );
    setWorking(false);
  };
  const requestApproval = async () => {
    if (!current) return;
    setWorking(true);
    const saved = await fetch(`/api/drafts/${current.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        body,
        subject,
        recipients: recipients
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      }),
    });
    const response = saved.ok
      ? await fetch(`/api/drafts/${current.id}/approval`, { method: "POST" })
      : saved;
    setMessage(
      response.ok
        ? "Send action is now waiting in Approvals."
        : "Approval could not be created.",
    );
    setWorking(false);
  };
  return (
    <section className="reply-studio card">
      <div className="section-head">
        <div>
          <div className="eyebrow">Smart reply studio</div>
          <h2>Shape the response</h2>
          <span className="subtle">
            Generate only when requested, edit freely, then send through
            approval.
          </span>
        </div>
        <WandSparkles size={19} />
      </div>
      <div className="reply-toolbar">
        <div className="tone-picker">
          {(
            ["friendly", "formal", "direct", "concise", "detailed"] as const
          ).map((value) => (
            <button
              className={tone === value ? "active" : ""}
              onClick={() => setTone(value)}
              key={value}
            >
              {value}
            </button>
          ))}
        </div>
        <button
          className="button primary"
          onClick={() => void generate()}
          disabled={working}
        >
          {working ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <Sparkles size={15} />
          )}
          Generate version
        </button>
      </div>
      {drafts.length ? (
        <div className="studio-grid">
          <aside className="version-rail">
            <div className="command-group-label">
              <History size={12} />
              Version history
            </div>
            {drafts.map((draft, index) => (
              <button
                className={draft.id === current?.id ? "active" : ""}
                onClick={() => select(draft)}
                key={draft.id}
              >
                <strong>Version {drafts.length - index}</strong>
                <span>{draft.status.replaceAll("_", " ")}</span>
                <time>{new Date(draft.createdAt).toLocaleString()}</time>
              </button>
            ))}
          </aside>
          <div className="draft-editor">
            <label className="field">
              To
              <input
                className="input"
                value={recipients}
                onChange={(event) => setRecipients(event.target.value)}
              />
            </label>
            <label className="field">
              Subject
              <input
                className="input"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </label>
            <label className="field grow">
              Message
              <textarea
                className="input message-body"
                rows={12}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
            <div className="approval-preview">
              <ShieldCheck size={17} />
              <div>
                <strong>What will happen?</strong>
                <span>
                  Saving changes never sends email. Request approval creates a
                  review item; Gmail sends only after you approve it.
                </span>
              </div>
            </div>
            {message && <p className="subtle">{message}</p>}
            <div className="row studio-actions">
              <button
                className="button"
                onClick={() => void save()}
                disabled={working}
              >
                Save draft
              </button>
              <button
                className="button primary"
                onClick={() => void requestApproval()}
                disabled={working}
              >
                <Send size={15} />
                Request send approval
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="studio-empty">
          <Mail size={25} />
          <strong>No draft versions yet</strong>
          <span className="subtle">
            Choose a tone and generate a reply when you need one.
          </span>
        </div>
      )}
    </section>
  );
}
function ApprovalDetail({
  data,
  reload,
}: {
  data: Approval;
  reload: () => Promise<void>;
}) {
  const [body, setBody] = useState(data.draft?.body ?? ""),
    [saving, setSaving] = useState(false),
    [failure, setFailure] = useState<string | null>(null);
  const decide = async (decision: "APPROVE" | "REJECT") => {
    setSaving(true);
    setFailure(null);
    try {
      const response = await fetch(`/api/approvals/${data.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          ...(body ? { draftBody: body } : {}),
        }),
      });
      if (!response.ok) throw new Error("The approval could not be updated.");
      await reload();
    } catch (cause) {
      setFailure(
        cause instanceof Error
          ? cause.message
          : "The approval could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  };
  const retry = async () => {
    setSaving(true);
    setFailure(null);
    try {
      const response = await fetch(`/api/approvals/${data.id}/retry`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Execution could not be retried.");
      await reload();
    } catch (cause) {
      setFailure(
        cause instanceof Error
          ? cause.message
          : "Execution could not be retried.",
      );
    } finally {
      setSaving(false);
    }
  };
  const cancel = async () => {
    setSaving(true);
    setFailure(null);
    try {
      const response = await fetch(`/api/approvals/${data.id}/cancel`, {
        method: "POST",
      });
      if (!response.ok)
        throw new Error(
          "The safety window has closed; execution may already be underway.",
        );
      await reload();
    } catch (cause) {
      setFailure(
        cause instanceof Error
          ? cause.message
          : "The action could not be cancelled.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="content">
      <div className="eyebrow">Approval · {data.status}</div>
      <h1 className="title">
        {data.draft?.subject ?? data.type.replaceAll("_", " ")}
      </h1>
      <div className="split detail-grid">
        <section className="card">
          <label className="field">
            <strong>Draft</strong>
            <textarea
              className="input message-body"
              rows={16}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              disabled={data.status !== "PENDING"}
            />
          </label>
        </section>
        <aside className="card">
          <div className="section-head">
            <h2>Requested action</h2>
            <ShieldCheck size={17} />
          </div>
          <p>{data.reason}</p>
          <dl className="settings-list">
            <div>
              <dt>Risk</dt>
              <dd>{data.riskLevel}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{data.status}</dd>
            </div>
            {data.draft && (
              <div>
                <dt>Recipients</dt>
                <dd>{data.draft.recipients.join(", ")}</dd>
              </div>
            )}
          </dl>
          {failure && (
            <div className="notice">
              <AlertTriangle size={17} />
              {failure}
            </div>
          )}
          {data.status === "PENDING" && (
            <div className="row action-row">
              <button
                className="button"
                disabled={saving}
                onClick={() => void decide("REJECT")}
              >
                <XCircle size={16} />
                Reject
              </button>
              <button
                className="button primary"
                disabled={saving}
                onClick={() => void decide("APPROVE")}
              >
                <CheckCircle2 size={16} />
                Approve
              </button>
            </div>
          )}
          {data.status === "APPROVED" && (
            <ExecutionCountdown saving={saving} cancel={cancel} />
          )}
          {data.status === "FAILED" && (
            <button
              className="button primary"
              disabled={saving}
              onClick={() => void retry()}
            >
              {saving ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Retry execution
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
function ExecutionCountdown({
  saving,
  cancel,
}: {
  saving: boolean;
  cancel: () => Promise<void>;
}) {
  const [seconds, setSeconds] = useState(10);
  useEffect(() => {
    const timer = setInterval(
      () => setSeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="execution-window">
      <div className="countdown-orbit">
        <strong>{seconds}</strong>
        <span>seconds</span>
      </div>
      <div>
        <strong>{seconds ? "Safety window open" : "Execution starting"}</strong>
        <p className="subtle">
          Chief waits briefly so you can stop an accidental approval.
        </p>
        <button
          className="button"
          disabled={saving || seconds === 0}
          onClick={() => void cancel()}
        >
          <XCircle size={15} />
          Cancel action
        </button>
      </div>
    </div>
  );
}
function RunDetail({ data }: { data: Run }) {
  return (
    <div className="content">
      <div className="eyebrow">Agent run · {data.status}</div>
      <h1 className="title">
        {data.resultSummary ?? data.trigger.replaceAll("_", " ")}
      </h1>
      {data.error && (
        <div className="notice">
          <AlertTriangle size={18} />
          {data.error}
        </div>
      )}
      <section className="card timeline">
        {data.steps.map((step) => (
          <div className="list-item" key={step.id}>
            <Activity size={17} />
            <div className="grow">
              <strong>{step.title}</strong>
              {step.description && (
                <div className="subtle">{step.description}</div>
              )}
              <time className="subtle">
                {new Date(step.startedAt).toLocaleString()}
              </time>
            </div>
            <span className="badge">{step.status}</span>
          </div>
        ))}
        {!data.steps.length && (
          <p className="subtle">
            No operational steps were recorded for this run.
          </p>
        )}
      </section>
    </div>
  );
}
function State({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="content">
      <section className="card state">
        {icon}
        <strong>{title}</strong>
      </section>
    </div>
  );
}
