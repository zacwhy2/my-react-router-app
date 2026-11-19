import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";
import type { Route } from "./+types/signin";
import { getSafeRedirectPath } from "../utils/auth";
import { getSupabaseClient } from "../utils/supabase";

type FormMode = "sign-in" | "sign-up" | "reset-password";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sign in" },
    { name: "description", content: "Sign in with your email and password." },
  ];
}

export default function SignIn() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<FormMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const nextPath = getSafeRedirectPath(
    new URLSearchParams(location.search).get("next"),
  );

  function changeMode(nextMode: FormMode) {
    setMode(nextMode);
    setMessage("");
    setErrorMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || sending) return;

    setSending(true);
    setMessage("");
    setErrorMessage("");
    try {
      const supabase = getSupabaseClient();

      if (mode === "reset-password") {
        const callbackUrl = new URL("/auth/callback", window.location.origin);
        callbackUrl.searchParams.set("mode", "recovery");
        callbackUrl.searchParams.set("next", nextPath);

        const { error } = await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          { redirectTo: callbackUrl.toString() },
        );
        if (error) throw error;
        setMessage("If an account exists for that email, a reset link is on its way.");
        return;
      }

      if (!password) return;

      if (mode === "sign-up") {
        const callbackUrl = new URL("/auth/callback", window.location.origin);
        callbackUrl.searchParams.set("next", nextPath);
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: callbackUrl.toString() },
        });
        if (error) throw error;

        if (data.session) {
          navigate(nextPath, { replace: true });
        } else {
          setMessage("Check your email to confirm your account, then sign in.");
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;
      navigate(nextPath, { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to authenticate.",
      );
    } finally {
      setSending(false);
    }
  }

  const isReset = mode === "reset-password";

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-slate-50 px-4 py-12 text-slate-900">
      <section className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold tracking-tight">
          {mode === "sign-up"
            ? "Create account"
            : isReset
              ? "Reset password"
              : "Sign in"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {mode === "sign-up"
            ? "Create an account with your email and password."
            : isReset
              ? "We’ll email you a link to choose a new password."
              : "Sign in with your email and password."}
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-slate-700"
              htmlFor="signin-email"
            >
              Email
            </label>
            <input
              id="signin-email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={sending}
            />
          </div>

          {!isReset && (
            <div>
              <label
                className="mb-1 block text-sm font-medium text-slate-700"
                htmlFor="signin-password"
              >
                Password
              </label>
              <input
                id="signin-password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                type="password"
                autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={sending}
              />
            </div>
          )}

          {message && (
            <p
              className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
              role="status"
            >
              {message}
            </p>
          )}
          {errorMessage && (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {errorMessage}
            </p>
          )}

          <button
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={
              sending ||
              !email.trim() ||
              (!isReset && !password)
            }
          >
            {sending
              ? "Please wait…"
              : isReset
                ? "Send password reset link"
                : mode === "sign-up"
                  ? "Create account"
                  : "Sign in"}
          </button>
        </form>

        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {mode === "sign-in" ? (
            <>
              <button
                className="font-medium text-indigo-700 hover:underline"
                type="button"
                onClick={() => changeMode("reset-password")}
              >
                Forgot password?
              </button>
              <button
                className="font-medium text-indigo-700 hover:underline"
                type="button"
                onClick={() => changeMode("sign-up")}
              >
                Create account
              </button>
            </>
          ) : (
            <button
              className="font-medium text-indigo-700 hover:underline"
              type="button"
              onClick={() => changeMode("sign-in")}
            >
              Back to sign in
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
