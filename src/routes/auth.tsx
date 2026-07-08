import { createFileRoute, redirect, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile as updateAuthProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";
import { Brand, BrandMark } from "@/components/Brand";
import { ArrowLeft, Loader2 } from "lucide-react";

const ADMIN_EMAIL = "abocomaax@gmail.com";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional().default("signin"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Access Defense Portal · ti3lab" },
      { name: "description", content: "Sign in to the ti3lab cyber defense operations console." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    if (auth.currentUser) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const { mode } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignup) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const finalHandle = handle || email.split("@")[0];
        await updateAuthProfile(cred.user, { displayName: finalHandle });
        await setDoc(doc(db, "profiles", cred.user.uid), {
          handle: finalHandle,
          displayName: finalHandle,
          xp: 0,
          badge: email.toLowerCase() === ADMIN_EMAIL ? "Admin" : "Recruit",
          casesClosed: 0,
          createdAt: serverTimestamp(),
        });
        // Firebase never sends a confirmation email unless we ask it to — the
        // account is active immediately.
        navigate({ to: "/dashboard" });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute inset-0 bg-scanlines" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyber/8 blur-[120px]" />

      <header className="relative z-10 border-b border-border/60">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Brand />
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-md border border-cyber/40 bg-cyber/5 mb-4">
              <BrandMark size={26} />
            </div>
            <h1 className="font-display text-3xl font-bold">Access Defense Portal</h1>
            <p className="mt-2 text-sm text-muted-foreground font-mono uppercase tracking-widest">
              {isSignup ? "provision operator" : "authenticate operator"}
            </p>
          </div>

          <form onSubmit={onSubmit} className="panel p-8 space-y-5 ring-cyber">
            {isSignup && (
              <Field
                label="Callsign"
                hint="Handle · lowercase, no spaces"
                value={handle}
                onChange={setHandle}
                placeholder="analyst_01"
                required
              />
            )}
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="operator@ti3lab.io"
              required
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••••••"
              required
              minLength={6}
            />

            {error && (
              <p className="text-xs font-mono text-destructive border border-destructive/40 bg-destructive/5 px-3 py-2 rounded-sm">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSignup ? "Provision access" : "Authenticate"}
            </button>

            <div className="pt-2 border-t border-border text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignup(!isSignup);
                  setError(null);
                }}
                className="text-xs text-muted-foreground hover:text-cyber font-mono uppercase tracking-widest"
              >
                {isSignup ? "Have credentials? Sign in →" : "Need access? Register operator →"}
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
            Session secured · TLS 1.3 · zero-trust
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  minLength,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        {hint && <span className="text-[10px] font-mono text-muted-foreground/70">{hint}</span>}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-cyber focus:ring-1 focus:ring-cyber transition font-mono"
      />
    </label>
  );
}
