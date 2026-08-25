"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
} from "lucide-react";
type Setup = { google: boolean; gemini: boolean };
export function Onboarding() {
  const [setup, setSetup] = useState<Setup | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    Promise.all([fetch("/api/setup"), fetch("/api/settings")])
      .then(async ([setupResponse, settingsResponse]) => {
        if (settingsResponse.status === 401) {
          window.location.assign("/login");
          return;
        }
        if (!setupResponse.ok || !settingsResponse.ok) throw new Error();
        setSetup((await setupResponse.json()).integrations);
      })
      .catch(() => setError(true));
  }, []);
  return (
    <main style={{ maxWidth: 680, margin: "70px auto", padding: 24 }}>
      <div className="brand">
        <span className="brandmark">M</span>Morrow
      </div>
      <div className="eyebrow">Workspace setup</div>
      <h1 className="title">Connect your working day.</h1>
      <p className="subtle">
        Morrow verifies your live configuration before opening the workspace.
      </p>
      <div className="card" style={{ marginTop: 28 }}>
        {!setup && !error && (
          <div className="state">
            <LoaderCircle className="spin" />
            <strong>Checking integrations</strong>
          </div>
        )}
        {error && (
          <div className="notice">
            <AlertTriangle size={18} />
            Morrow could not verify the current setup.
          </div>
        )}
        {setup && (
          <>
            <SetupRow
              ready={setup.google}
              label="Google OAuth"
              detail={
                setup.google
                  ? "Server credentials are configured."
                  : "Add Google client credentials and token encryption key."
              }
            />
            <SetupRow
              ready={setup.gemini}
              label="Gemini"
              detail={
                setup.gemini
                  ? "Gemini analysis is configured."
                  : "Add GEMINI_API_KEY to the environment."
              }
            />
            <Link
              className="button primary"
              href="/dashboard"
              style={{ marginTop: 18, textDecoration: "none" }}
            >
              Open workspace <ArrowRight size={16} />
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
function SetupRow({
  ready,
  label,
  detail,
}: {
  ready: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="list-item">
      {ready ? <CheckCircle2 size={20} /> : <KeyRound size={20} />}
      <div className="grow">
        <strong>{label}</strong>
        <div className="subtle">{detail}</div>
      </div>
      <span className="badge">{ready ? "Ready" : "Required"}</span>
    </div>
  );
}
