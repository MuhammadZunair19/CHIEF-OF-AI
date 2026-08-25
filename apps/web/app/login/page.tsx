import { ShieldCheck, Inbox, CalendarDays, CheckCircle2 } from "lucide-react";
import { GoogleSignIn } from "@/components/google-sign-in";
export default function Login() {
  const capabilities = [
    {
      Icon: Inbox,
      title: "Inbox intelligence",
      detail: "Prioritize real Gmail messages and extract action items.",
    },
    {
      Icon: CalendarDays,
      title: "Scheduling context",
      detail: "Find availability from your connected Google Calendar.",
    },
    {
      Icon: CheckCircle2,
      title: "Deliberate execution",
      detail: "Review drafts and meetings before anything is sent.",
    },
  ];
  return (
    <main className="login">
      <section className="login-copy">
        <div className="brand">
          <span className="brandmark">M</span>
          <span className="brand-copy">
            Morrow <small>Workday intelligence</small>
          </span>
        </div>
        <div className="eyebrow">Your personal work companion</div>
        <h1 className="title login-title">
          Your workday,
          <br />
          <span>quietly organized.</span>
        </h1>
        <p className="subtle" style={{ fontSize: 17 }}>
          Morrow turns your inbox and calendar into a focused plan—while keeping
          every sensitive action under your control.
        </p>
        <GoogleSignIn />
        <p className="subtle" style={{ marginTop: 20 }}>
          <ShieldCheck
            size={15}
            style={{ display: "inline", verticalAlign: "-3px" }}
          />{" "}
          Private by design. Nothing is sent without your approval.
        </p>
      </section>
      <section className="login-preview">
        <div className="ambient-orb orb-one" />
        <div className="ambient-orb orb-two" />
        <div className="preview-card">
          <div className="section-head">
            <div>
              <div className="eyebrow">How Morrow works</div>
              <h2 style={{ fontFamily: "Georgia", fontWeight: 500 }}>
                From signal to approved action.
              </h2>
            </div>
            <span className="badge">Morrow</span>
          </div>
          {capabilities.map(({ Icon, title, detail }, index) => (
            <div
              className="list-item preview-step"
              style={{ animationDelay: `${index * 120 + 180}ms` }}
              key={title}
            >
              <Icon size={18} />
              <div>
                <strong>{title}</strong>
                <div className="subtle">{detail}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
