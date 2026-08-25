"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  Mail,
  RefreshCw,
  Search,
  UsersRound,
  X,
} from "lucide-react";
type Contact = {
  id: string;
  email: string;
  displayName: string | null;
  notes: string | null;
  commonTopics: string[];
  interactionCount: number;
  lastInteractionAt: string;
  preferredMeetingMinutes: number | null;
  typicalResponseHours: number | null;
  importantDate: string | null;
  openCommitments: number;
};
export function RelationshipMemory() {
  const [contacts, setContacts] = useState<Contact[]>([]),
    [selected, setSelected] = useState<Contact | null>(null),
    [query, setQuery] = useState(""),
    [loading, setLoading] = useState(true),
    [rebuilding, setRebuilding] = useState(false),
    [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/relationships");
    if (response.status === 401) {
      location.assign("/login");
      return;
    }
    if (response.ok) {
      setContacts(await response.json());
      setError(null);
    } else setError("Relationship memory could not be loaded.");
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const rebuild = async () => {
    setRebuilding(true);
    const response = await fetch("/api/relationships/rebuild", {
      method: "POST",
    });
    if (response.ok) await load();
    else setError("Memory could not be rebuilt from email history.");
    setRebuilding(false);
  };
  const filtered = useMemo(
    () =>
      contacts.filter((contact) =>
        `${contact.displayName ?? ""} ${contact.email} ${contact.commonTopics.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [contacts, query],
  );
  return (
    <div className="content">
      <div className="section-head">
        <div>
          <div className="eyebrow">Private relationship intelligence</div>
          <h1 className="title">Relationship memory</h1>
          <div className="subtle">
            Editable context derived only from your synchronized communication
            history.
          </div>
        </div>
        <button
          className="button primary"
          onClick={() => void rebuild()}
          disabled={rebuilding}
        >
          {rebuilding ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <RefreshCw size={15} />
          )}
          Rebuild from Gmail
        </button>
      </div>
      <div className="relationship-search">
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people or topics"
        />
      </div>
      {error && (
        <div className="notice">
          <AlertTriangle size={17} />
          {error}
        </div>
      )}
      {loading ? (
        <section className="card state">
          <LoaderCircle className="spin" />
          <strong>Retrieving relationship context</strong>
        </section>
      ) : filtered.length ? (
        <div className="contact-grid">
          {filtered.map((contact) => (
            <button
              className="contact-card card"
              onClick={() => setSelected(contact)}
              key={contact.id}
            >
              <div className="contact-avatar">
                {initials(contact.displayName ?? contact.email)}
              </div>
              <div className="grow">
                <strong>{contact.displayName ?? contact.email}</strong>
                {contact.displayName && (
                  <span className="subtle">{contact.email}</span>
                )}
              </div>
              {contact.openCommitments > 0 && (
                <span className="badge">{contact.openCommitments} open</span>
              )}
              <div className="contact-stats">
                <span>
                  <Mail size={14} />
                  {contact.interactionCount} messages
                </span>
                <span>
                  <CalendarDays size={14} />
                  {new Date(contact.lastInteractionAt).toLocaleDateString()}
                </span>
              </div>
              <div className="topic-cloud">
                {contact.commonTopics.slice(0, 5).map((topic) => (
                  <span key={topic}>{topic}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <section className="card state">
          <UsersRound />
          <strong>No relationship memories yet</strong>
          <span className="subtle">
            Rebuild from your real synchronized Gmail history to begin.
          </span>
        </section>
      )}
      {selected && (
        <ContactEditor
          contact={selected}
          close={() => setSelected(null)}
          saved={async () => {
            setSelected(null);
            await load();
          }}
        />
      )}
    </div>
  );
}
function ContactEditor({
  contact,
  close,
  saved,
}: {
  contact: Contact;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [name, setName] = useState(contact.displayName ?? ""),
    [notes, setNotes] = useState(contact.notes ?? ""),
    [minutes, setMinutes] = useState(contact.preferredMeetingMinutes ?? 30),
    [date, setDate] = useState(contact.importantDate?.slice(0, 10) ?? ""),
    [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const response = await fetch(`/api/relationships/${contact.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: name || null,
        notes: notes || null,
        preferredMeetingMinutes: minutes,
        importantDate: date ? new Date(`${date}T12:00:00`).toISOString() : null,
      }),
    });
    if (response.ok) await saved();
    setSaving(false);
  };
  return (
    <div className="memory-drawer-layer">
      <button
        className="dialog-scrim"
        onClick={close}
        aria-label="Close contact memory"
      />
      <aside className="memory-drawer">
        <div className="section-head">
          <div>
            <div className="eyebrow">Relationship context</div>
            <h2>{contact.displayName ?? contact.email}</h2>
          </div>
          <button className="icon-button" onClick={close}>
            <X size={18} />
          </button>
        </div>
        <div className="memory-evidence">
          <CheckCircle2 size={17} />
          <div>
              <strong>Why Morrow remembers this</strong>
            <span>
              {contact.interactionCount} synchronized messages, most recently{" "}
              {new Date(contact.lastInteractionAt).toLocaleString()}. Topics
              below come from subject keywords—not private reasoning.
            </span>
          </div>
        </div>
        <div className="topic-cloud">
          {contact.commonTopics.map((topic) => (
            <span key={topic}>{topic}</span>
          ))}
        </div>
        <label className="field">
          Display name
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="field">
          Private notes
          <textarea
            className="input"
            rows={7}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          placeholder="Preferences, context, or commitments you want Morrow to remember"
          />
        </label>
        <label className="field">
          Preferred meeting length
          <input
            className="input"
            type="number"
            min="15"
            max="240"
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
          />
        </label>
        <label className="field">
          Important date
          <input
            className="input"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <div className="settings-list">
          <div>
            <dt>Open commitments</dt>
            <dd>{contact.openCommitments}</dd>
          </div>
          <div>
            <dt>Typical response</dt>
            <dd>
              {contact.typicalResponseHours
                ? `${contact.typicalResponseHours.toFixed(1)} hours`
                : "Still learning"}
            </dd>
          </div>
        </div>
        <button
          className="button primary"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? (
            <LoaderCircle className="spin" size={15} />
          ) : (
            <CheckCircle2 size={15} />
          )}
          Save memory
        </button>
      </aside>
    </div>
  );
}
function initials(value: string) {
  return value
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
