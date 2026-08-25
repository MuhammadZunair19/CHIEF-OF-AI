"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlarmClock,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
type Signal = {
  key: string;
  kind: "OVERDUE_TASK" | "AWAITING_REPLY" | "STALE_APPROVAL";
  title: string;
  detail: string;
  href: string;
  occurredAt: string;
  urgency: string;
};
export function FollowUpRadar() {
  const [signals, setSignals] = useState<Signal[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/follow-ups");
      if (response.status === 401) {
        location.assign("/login");
        return;
      }
      if (!response.ok)
        throw new Error("Follow-up signals could not be loaded.");
      setSignals(await response.json());
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Follow-up signals could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (
    signalKey: string,
    action: "SNOOZE" | "DISMISS",
    days = 1,
  ) => {
    const response = await fetch("/api/follow-ups/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        signalKey,
        action,
        ...(action === "SNOOZE" ? { days } : {}),
      }),
    });
    if (response.ok)
      setSignals((current) => current.filter((item) => item.key !== signalKey));
  };
  return (
    <div className="content">
      <div className="section-head">
        <div>
          <div className="eyebrow">Proactive attention</div>
          <h1 className="title">Follow-up radar</h1>
          <div className="subtle">
            Chief surfaces commitments that are quietly slipping.
          </div>
        </div>
        <button className="button" onClick={() => void load()}>
          <RotateCcw size={15} />
          Refresh
        </button>
      </div>
      {loading ? (
        <section className="card state">
          <LoaderCircle className="spin" />
          <strong>Scanning commitments</strong>
        </section>
      ) : error ? (
        <div className="notice">
          <AlertTriangle size={18} />
          {error}
        </div>
      ) : signals.length ? (
        <div className="radar-layout">
          <section className="radar-visual card" aria-hidden="true">
            <div className="radar-sweep" />
            <div className="radar-ring r1" />
            <div className="radar-ring r2" />
            <div className="radar-ring r3" />
            {signals.slice(0, 6).map((signal, index) => (
              <i className={`radar-blip b${index + 1}`} key={signal.key} />
            ))}
          </section>
          <section className="card radar-feed">
            <div className="section-head">
              <h2>Needs a nudge</h2>
              <span className="badge">{signals.length}</span>
            </div>
            {signals.map((signal) => (
              <article className="follow-up" key={signal.key}>
                <div className={`signal-icon ${signal.kind.toLowerCase()}`}>
                  <AlarmClock size={17} />
                </div>
                <div className="grow">
                  <div className="row">
                    <strong>{signal.title}</strong>
                    <span className="badge">{signal.urgency}</span>
                  </div>
                  <p className="subtle">{signal.detail}</p>
                  <time className="subtle">
                    Waiting since {new Date(signal.occurredAt).toLocaleString()}
                  </time>
                  <div className="follow-actions">
                    <Link className="button" href={signal.href}>
                      Open
                      <ArrowUpRight size={14} />
                    </Link>
                    <button
                      className="button"
                      onClick={() => void act(signal.key, "SNOOZE", 1)}
                    >
                      Tomorrow
                    </button>
                    <button
                      className="button"
                      onClick={() => void act(signal.key, "SNOOZE", 7)}
                    >
                      Next week
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Dismiss follow-up"
                      onClick={() => void act(signal.key, "DISMISS")}
                    >
                      <CheckCircle2 size={17} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </div>
      ) : (
        <section className="card state radar-clear">
          <CheckCircle2 />
          <strong>You&apos;re all caught up</strong>
          <span className="subtle">
            No overdue replies, tasks, or approvals need a nudge.
          </span>
        </section>
      )}
    </div>
  );
}
