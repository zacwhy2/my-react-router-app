import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
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

type AccountCounts = {
  from: number;
  to: number;
};

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
  const [accountCounts, setAccountCounts] = useState<
    Record<number, AccountCounts>
  >({});
  const [newDraft, setNewDraft] = useState<AccountDraft>(emptyDraft);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<AccountDraft>(emptyDraft);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isModalOpen = isCreateOpen || selectedAccount !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open || !isModalOpen) return;

    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [isModalOpen]);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const { data, error } = await getSupabaseClient()
          .from("accounts")
          .select("id, created_at, name, can_from, can_to")
          .order("name", { ascending: true });

        if (error) throw error;
        setAccounts(data);

        const countEntries = await Promise.all(
          data.map(async (account) => {
            const [fromResult, toResult] = await Promise.all([
              getSupabaseClient()
                .from("txns1")
                .select("id", { count: "exact", head: true })
                .eq("from_account_id", account.id),
              getSupabaseClient()
                .from("txns1")
                .select("id", { count: "exact", head: true })
                .eq("to_account_id", account.id),
            ]);

            if (fromResult.error) throw fromResult.error;
            if (toResult.error) throw toResult.error;
            if (fromResult.count === null || toResult.count === null) {
              throw new Error(
                `Unable to count transactions for ${account.name}.`,
              );
            }

            return [
              account.id,
              { from: fromResult.count, to: toResult.count },
            ] as const;
          }),
        );
        setAccountCounts(Object.fromEntries(countEntries));
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
      setAccountCounts((currentCounts) => ({
        ...currentCounts,
        [data.id]: { from: 0, to: 0 },
      }));
      setNewDraft(emptyDraft);
      setIsCreateOpen(false);
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
      setSelectedAccount(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update the account.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(account: Account) {
    if (busy) return;

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
      setAccountCounts((currentCounts) => {
        const remainingCounts = { ...currentCounts };
        delete remainingCounts[account.id];
        return remainingCounts;
      });
      setIsDeleteConfirmOpen(false);
      setEditingId(null);
      setSelectedAccount(null);
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
    setIsDeleteConfirmOpen(false);
    setEditDraft({
      name: account.name,
      can_from: account.can_from,
      can_to: account.can_to,
    });
    setErrorMessage("");
  }

  function closeModal() {
    if (busy) return;
    setIsCreateOpen(false);
    setSelectedAccount(null);
    setEditingId(null);
    setIsDeleteConfirmOpen(false);
    setNewDraft(emptyDraft);
    setEditDraft(emptyDraft);
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
          From
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
          To
        </label>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900">
      <section className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex justify-end">
          <button
            className={`${buttonClassName} inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-3 text-slate-700 shadow-sm hover:bg-slate-50`}
            type="button"
            onClick={() => {
              setNewDraft(emptyDraft);
              setErrorMessage("");
              setIsCreateOpen(true);
            }}
            disabled={loading || busy}
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 5v14m-7-7h14"
              />
            </svg>
            Add account
          </button>
        </div>

        {errorMessage && !isModalOpen && (
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
              No accounts yet. Add one to get started.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {accounts.map((account) => (
                <li key={account.id}>
                  <button
                    className="grid w-full grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-2 px-4 py-3.5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 sm:px-5"
                    type="button"
                    onClick={() => {
                      setErrorMessage("");
                      setSelectedAccount(account);
                    }}
                    disabled={busy}
                    aria-haspopup="dialog"
                  >
                    <span className="min-w-0 break-words font-medium">
                      {account.name}
                    </span>
                    <span className="flex justify-center">
                      {account.can_from ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-800 ring-1 ring-inset ring-indigo-200">
                          From
                          <span className="flex size-6 items-center justify-center rounded-full bg-indigo-700 text-xs font-bold tabular-nums text-white">
                            {accountCounts[account.id]?.from ?? "—"}
                          </span>
                        </span>
                      ) : (
                        <span aria-hidden="true" />
                      )}
                    </span>
                    <span className="flex justify-center">
                      {account.can_to ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                          To
                          <span className="flex size-6 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold tabular-nums text-white">
                            {accountCounts[account.id]?.to ?? "—"}
                          </span>
                        </span>
                      ) : (
                        <span aria-hidden="true" />
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      {isModalOpen && (
        <dialog
          ref={dialogRef}
          className="m-auto max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50"
          aria-labelledby="accounts-modal-title"
          onCancel={(event) => {
            event.preventDefault();
            if (isDeleteConfirmOpen) {
              setIsDeleteConfirmOpen(false);
              setErrorMessage("");
            } else {
              closeModal();
            }
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              if (isDeleteConfirmOpen) {
                setIsDeleteConfirmOpen(false);
                setErrorMessage("");
              } else {
                closeModal();
              }
            }
          }}
        >
          {isCreateOpen ? (
            <form className="space-y-5 p-5" onSubmit={handleCreate}>
              <h2
                className="text-xl font-semibold"
                id="accounts-modal-title"
              >
                Add account
              </h2>
              {errorMessage && (
                <p
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-slate-700"
                  htmlFor="new-account-name"
                >
                  Name
                </label>
                <input
                  id="new-account-name"
                  className={`${inputClassName} w-full`}
                  value={newDraft.name}
                  onChange={(event) =>
                    setNewDraft({ ...newDraft, name: event.target.value })
                  }
                  required
                  autoFocus
                  disabled={busy}
                />
              </div>
              {renderPermissions(newDraft, setNewDraft, "new-account")}
              <div className="flex justify-end gap-2">
                <button
                  className={`${buttonClassName} text-slate-600 hover:bg-slate-100`}
                  type="button"
                  onClick={closeModal}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  className={`${buttonClassName} bg-indigo-600 px-4 text-white hover:bg-indigo-700`}
                  type="submit"
                  disabled={busy || !newDraft.name.trim()}
                >
                  {busy ? "Adding…" : "Add account"}
                </button>
              </div>
            </form>
          ) : selectedAccount && isDeleteConfirmOpen ? (
            <div className="p-6">
              <h2
                className="mb-3 text-xl font-semibold"
                id="accounts-modal-title"
              >
                Delete account?
              </h2>
              <p className="text-sm text-slate-600">
                Delete “{selectedAccount.name}”? This can’t be undone. Accounts
                referenced by transactions cannot be deleted.
              </p>
              {errorMessage && (
                <p
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  className={`${buttonClassName} text-slate-600 hover:bg-slate-100`}
                  type="button"
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setErrorMessage("");
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  className={`${buttonClassName} bg-red-600 px-4 text-white hover:bg-red-700`}
                  type="button"
                  onClick={() => void handleDelete(selectedAccount)}
                  disabled={busy}
                >
                  {busy ? "Deleting…" : "Delete account"}
                </button>
              </div>
            </div>
          ) : selectedAccount && editingId === selectedAccount.id ? (
            <form className="space-y-5 p-5" onSubmit={handleUpdate}>
              <h2
                className="text-xl font-semibold"
                id="accounts-modal-title"
              >
                Edit account
              </h2>
              {errorMessage && (
                <p
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-slate-700"
                  htmlFor={`edit-account-name-${selectedAccount.id}`}
                >
                  Name
                </label>
                <input
                  id={`edit-account-name-${selectedAccount.id}`}
                  className={`${inputClassName} w-full`}
                  value={editDraft.name}
                  onChange={(event) =>
                    setEditDraft({ ...editDraft, name: event.target.value })
                  }
                  required
                  autoFocus
                  disabled={busy}
                />
              </div>
              {renderPermissions(
                editDraft,
                setEditDraft,
                `edit-account-${selectedAccount.id}`,
              )}
              <div className="flex justify-end gap-2">
                <button
                  className={`${buttonClassName} text-slate-600 hover:bg-slate-100`}
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setEditDraft(emptyDraft);
                    setErrorMessage("");
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  className={`${buttonClassName} bg-indigo-600 px-4 text-white hover:bg-indigo-700`}
                  type="submit"
                  disabled={busy || !editDraft.name.trim()}
                >
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          ) : selectedAccount ? (
            <div className="p-6">
              <h2
                className="mb-5 text-xl font-semibold"
                id="accounts-modal-title"
              >
                Account details
              </h2>
              {errorMessage && (
                <p
                  className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-slate-500">Name</dt>
                  <dd className="mt-1 break-words">{selectedAccount.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    Available for
                  </dt>
                  <dd className="mt-2 flex gap-2">
                    {selectedAccount.can_from && (
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-sm font-medium text-indigo-700">
                        From
                      </span>
                    )}
                    {selectedAccount.can_to && (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700">
                        To
                      </span>
                    )}
                    {!selectedAccount.can_from && !selectedAccount.can_to && (
                      <span className="text-sm text-slate-500">None</span>
                    )}
                  </dd>
                </div>
              </dl>
              <div className="mt-6 flex items-center justify-between">
                <button
                  className={`${buttonClassName} text-red-700 hover:bg-red-50`}
                  type="button"
                  onClick={() => {
                    setErrorMessage("");
                    setIsDeleteConfirmOpen(true);
                  }}
                  disabled={busy}
                >
                  Delete
                </button>
                <div className="flex gap-2">
                  <button
                    className={`${buttonClassName} text-slate-600 hover:bg-slate-100`}
                    type="button"
                    onClick={closeModal}
                    disabled={busy}
                  >
                    Close
                  </button>
                  <button
                    className={`${buttonClassName} bg-indigo-600 px-4 text-white hover:bg-indigo-700`}
                    type="button"
                    onClick={() => startEditing(selectedAccount)}
                    disabled={busy}
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </dialog>
      )}
    </main>
  );
}
