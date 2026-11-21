import { useEffect, useState, type FormEvent } from "react";
import type { Route } from "./+types/accounts";
import { getSupabaseClient } from "../utils/supabase";

type Account = {
  id: number;
  created_at: string;
  name: string;
  can_from: boolean;
  can_to: boolean;
};

type AccountDraft = Pick<Account, "name" | "can_from" | "can_to">;

const emptyDraft: AccountDraft = {
  name: "",
  can_from: false,
  can_to: false,
};

const inputClassName =
  "rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";
const buttonClassName =
  "rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Accounts" },
    { name: "description", content: "Manage transaction accounts." },
  ];
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newDraft, setNewDraft] = useState<AccountDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<AccountDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const { data, error } = await getSupabaseClient()
          .from("accounts")
          .select("id, created_at, name, can_from, can_to")
          .order("name", { ascending: true });

        if (error) throw error;
        setAccounts(data);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load accounts.",
        );
      } finally {
        setLoading(false);
      }
    }

    void fetchAccounts();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newDraft.name.trim();
    if (!name || busy) return;

    setBusy(true);
    setErrorMessage("");
    try {
      const { data, error } = await getSupabaseClient()
        .from("accounts")
        .insert({
          name,
          can_from: newDraft.can_from,
          can_to: newDraft.can_to,
        })
        .select("id, created_at, name, can_from, can_to")
        .single();

      if (error) throw error;
      setAccounts((currentAccounts) =>
        [...currentAccounts, data].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewDraft(emptyDraft);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create the account.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = editDraft.name.trim();
    if (editingId === null || !name || busy) return;

    setBusy(true);
    setErrorMessage("");
    try {
      const { data, error } = await getSupabaseClient()
        .from("accounts")
        .update({
          name,
          can_from: editDraft.can_from,
          can_to: editDraft.can_to,
        })
        .eq("id", editingId)
        .select("id, created_at, name, can_from, can_to")
        .single();

      if (error) throw error;
      setAccounts((currentAccounts) =>
        currentAccounts
          .map((account) => (account.id === data.id ? data : account))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditingId(null);
      setEditDraft(emptyDraft);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update the account.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(account: Account) {
    if (
      busy ||
      !window.confirm(
        `Delete "${account.name}"? Transactions that reference this account may prevent deletion.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setErrorMessage("");
    try {
      const { data, error } = await getSupabaseClient()
        .from("accounts")
        .delete()
        .eq("id", account.id)
        .select("id");

      if (error) {
        if (error.code === "23503") {
          throw new Error(
            "This account is used by one or more transactions. Update those transactions before deleting it.",
          );
        }
        throw error;
      }
      if (data.length === 0) {
        throw new Error("This account could not be found or deleted.");
      }

      setAccounts((currentAccounts) =>
        currentAccounts.filter((item) => item.id !== account.id),
      );
      if (editingId === account.id) {
        setEditingId(null);
        setEditDraft(emptyDraft);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to delete the account.",
      );
    } finally {
      setBusy(false);
    }
  }

  function startEditing(account: Account) {
    setEditingId(account.id);
    setEditDraft({
      name: account.name,
      can_from: account.can_from,
      can_to: account.can_to,
    });
    setErrorMessage("");
  }

  function renderPermissions(
    draft: AccountDraft,
    setDraft: (draft: AccountDraft) => void,
    prefix: string,
  ) {
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <label
          className="inline-flex items-center gap-2 text-sm text-slate-700"
          htmlFor={`${prefix}-can-from`}
        >
          <input
            id={`${prefix}-can-from`}
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            checked={draft.can_from}
            onChange={(event) =>
              setDraft({ ...draft, can_from: event.target.checked })
            }
          />
          Can be From
        </label>
        <label
          className="inline-flex items-center gap-2 text-sm text-slate-700"
          htmlFor={`${prefix}-can-to`}
        >
          <input
            id={`${prefix}-can-to`}
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            checked={draft.can_to}
            onChange={(event) =>
              setDraft({ ...draft, can_to: event.target.checked })
            }
          />
          Can be To
        </label>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <section className="mx-auto w-full max-w-3xl">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="mt-2 text-slate-600">
            Manage the accounts available in transaction From and To fields.
          </p>
        </header>

        <form
          className="mb-6 space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
          onSubmit={handleCreate}
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="new-account-name">
              Account name
            </label>
            <input
              id="new-account-name"
              className={`${inputClassName} min-w-0 flex-1`}
              value={newDraft.name}
              onChange={(event) =>
                setNewDraft({ ...newDraft, name: event.target.value })
              }
              placeholder="Account name"
              required
              disabled={busy}
            />
            <button
              className={`${buttonClassName} bg-indigo-600 px-4 text-white hover:bg-indigo-700`}
              type="submit"
              disabled={loading || busy || !newDraft.name.trim()}
            >
              Add account
            </button>
          </div>
          {renderPermissions(newDraft, setNewDraft, "new-account")}
        </form>

        {errorMessage && (
          <p
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {errorMessage}
          </p>
        )}

        <section
          className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
          aria-label="Accounts list"
        >
          {loading ? (
            <p className="p-6 text-slate-600" role="status">
              Loading accounts…
            </p>
          ) : accounts.length === 0 ? (
            <p className="p-6 text-slate-600">
              No accounts yet. Add one above to get started.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {accounts.map((account) => (
                <li className="px-4 py-4 sm:px-5" key={account.id}>
                  {editingId === account.id ? (
                    <form className="space-y-4" onSubmit={handleUpdate}>
                      <label
                        className="sr-only"
                        htmlFor={`edit-account-name-${account.id}`}
                      >
                        Account name
                      </label>
                      <input
                        id={`edit-account-name-${account.id}`}
                        className={`${inputClassName} w-full`}
                        value={editDraft.name}
                        onChange={(event) =>
                          setEditDraft({
                            ...editDraft,
                            name: event.target.value,
                          })
                        }
                        required
                        autoFocus
                        disabled={busy}
                      />
                      {renderPermissions(
                        editDraft,
                        setEditDraft,
                        `edit-account-${account.id}`,
                      )}
                      <div className="flex justify-end gap-2">
                        <button
                          className={`${buttonClassName} text-slate-600 hover:bg-slate-100`}
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft(emptyDraft);
                          }}
                          disabled={busy}
                        >
                          Cancel
                        </button>
                        <button
                          className={`${buttonClassName} bg-indigo-600 text-white hover:bg-indigo-700`}
                          type="submit"
                          disabled={busy || !editDraft.name.trim()}
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-medium">{account.name}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {account.can_from ? "Can be From" : "Cannot be From"}
                          {" · "}
                          {account.can_to ? "Can be To" : "Cannot be To"}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          className={`${buttonClassName} text-indigo-700 hover:bg-indigo-50`}
                          type="button"
                          onClick={() => startEditing(account)}
                          disabled={busy}
                        >
                          Edit
                        </button>
                        <button
                          className={`${buttonClassName} text-red-700 hover:bg-red-50`}
                          type="button"
                          onClick={() => void handleDelete(account)}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
