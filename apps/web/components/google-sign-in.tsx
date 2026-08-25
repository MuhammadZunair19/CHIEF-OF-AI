"use client";
import { useState } from "react";
import { createAuthClient } from "better-auth/react";
import { AlertTriangle, ArrowRight, LoaderCircle } from "lucide-react";
const authClient = createAuthClient();
export function GoogleSignIn() {
  const [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null);
  const signIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/onboarding",
      });
      if (result.error)
        throw new Error(
          result.error.message ?? "Google sign-in could not start.",
        );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Google sign-in could not start.",
      );
      setLoading(false);
    }
  };
  return (
    <div>
      <button
        type="button"
        className="button primary"
        onClick={() => void signIn()}
        disabled={loading}
        style={{ marginTop: 20, padding: "13px 18px" }}
      >
        {loading ? <LoaderCircle className="spin" size={17} /> : null}Continue
        with Google <ArrowRight size={17} />
      </button>
      {error && (
        <div className="notice">
          <AlertTriangle size={17} />
          {error}
        </div>
      )}
    </div>
  );
}
