import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import type { Route } from "./+types/auth-callback";
import { getSafeRedirectPath } from "../utils/auth";
import { getSupabaseClient } from "../utils/supabase";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Completing sign in" }];
}

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const isRecovery =
    new URLSearchParams(location.search).get("mode") === "recovery";
  const nextPath = getSafeRedirectPath(
    new URLSearchParams(location.search).get("next"),
  );

  useEffect(() => {
    let active = true;

    async function completeSignIn() {
      try {
        const { data, error } = await getSupabaseClient().auth.getSession();
        if (error) throw error;
        if (!data.session) {
          throw new Error(
            "This link is invalid or expired. Request a new one and try again.",
          );
        }

        if (active && isRecovery) {
          setRecoveryReady(true);
        } else if (active) {
          navigate(nextPath, { replace: true });
        }
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error ? error.message : "Unable to complete sign in.",
          );
        }
      }
    }

    void completeSignIn();
    return () => {
      active = false;
    };
  }, [isRecovery, navigate, nextPath]);

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || saving) return;

    setSaving(true);
    setErrorMessage("");
    try {
      const { error } = await getSupabaseClient().auth.updateUser({ password });
      if (error) throw error;
      navigate(nextPath, { replace: true });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update password.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-slate-50 px-4 py-12 text-slate-900">
      <section className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {isRecovery && recoveryReady ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
            <form className="mt-6 space-y-4" onSubmit={handlePasswordUpdate}>
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-slate-700"
                  htmlFor="new-password"
                >
                  New password
                </label>
                <input
                  id="new-password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={saving}
                />
              </div>
              {errorMessage && (
                <p className="text-sm text-red-700" role="alert">
                  {errorMessage}
                </p>
              )}
              <button
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                type="submit"
                disabled={saving || !password}
              >
                {saving ? "Saving…" : "Update password"}
              </button>
            </form>
          </>
        ) : errorMessage ? (
          <>
            <h1 className="text-2xl font-bold tracking-tight">
              {isRecovery ? "Password reset failed" : "Sign-in failed"}
            </h1>
            <p className="mt-3 text-sm text-red-700" role="alert">
              {errorMessage}
            </p>
            <Link
              className="mt-5 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              to="/signin"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <p className="text-slate-600" role="status">
            Completing sign in…
          </p>
        )}
      </section>
    </main>
  );
}
