import {
  isRouteErrorResponse,
  Links,
  Meta,
  Navigate,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import type { Route } from "./+types/root";
import { getSupabaseClient } from "./utils/supabase";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    try {
      const supabase = getSupabaseClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        setUser(session?.user ?? null);
        setAuthLoading(false);
        setAuthError("");
      });

      unsubscribe = () => subscription.unsubscribe();
      void supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (error) throw error;
          if (!active) return;
          setUser(data.session?.user ?? null);
          setAuthLoading(false);
        })
        .catch((error: unknown) => {
          if (!active) return;
          setAuthError(
            error instanceof Error ? error.message : "Unable to check sign-in.",
          );
          setAuthLoading(false);
        });
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Unable to initialize sign-in.",
      );
      setAuthLoading(false);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    setSignOutError("");
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw error;
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : "Unable to sign out.",
      );
    }
  }

  const isPublicRoute =
    location.pathname === "/signin" ||
    location.pathname === "/auth/callback";
  const nextPath = `${location.pathname}${location.search}`;

  return (
    <div>
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          {user ? (
            <>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                Todos
              </NavLink>
              <NavLink
                to="/txns1"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                Transactions
              </NavLink>
              <NavLink
                to="/accounts"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                Accounts
              </NavLink>
              <NavLink
                to="/teams"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                Teams
              </NavLink>
              <span
                className="hidden max-w-56 truncate text-right text-sm text-slate-500 sm:ml-auto sm:block"
                title={`Signed in as ${user.email ?? "unknown email"}`}
              >
                Signed in as {user.email ?? "unknown email"}
              </span>
              <button
                className="hidden shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 sm:block"
                type="button"
                onClick={() => void handleSignOut()}
              >
                Sign out
              </button>
              <details className="relative ml-auto sm:hidden">
                <summary
                  aria-label="Open account menu"
                  className="flex cursor-pointer list-none items-center rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M4 6h16M4 12h16M4 18h16"
                      strokeLinecap="round"
                    />
                  </svg>
                </summary>
                <div className="absolute right-0 top-full z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                  <p className="px-2 pt-1 text-xs text-slate-500">
                    Signed in as
                  </p>
                  <p className="break-all px-2 py-1 text-sm text-slate-700">
                    {user.email ?? "unknown email"}
                  </p>
                  <button
                    className="mt-2 w-full rounded-lg border-t border-slate-200 px-2 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
                    type="button"
                    onClick={() => void handleSignOut()}
                  >
                    Sign out
                  </button>
                </div>
              </details>
            </>
          ) : (
            <NavLink
              to="/signin"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-semibold ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              Sign in
            </NavLink>
          )}
        </div>
      </nav>
      {signOutError && (
        <p
          className="mx-auto mt-3 max-w-5xl px-4 text-sm text-red-700"
          role="alert"
        >
          {signOutError}
        </p>
      )}
      {authLoading ? (
        <main className="p-8 text-center text-slate-600" role="status">
          Checking sign-in…
        </main>
      ) : authError ? (
        <main className="mx-auto max-w-xl p-8 text-red-700" role="alert">
          Unable to initialize authentication: {authError}
        </main>
      ) : user && location.pathname === "/signin" ? (
        <Navigate to="/" replace />
      ) : !user && !isPublicRoute ? (
        <Navigate
          to={`/signin?next=${encodeURIComponent(nextPath)}`}
          replace
        />
      ) : (
        <Outlet />
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
