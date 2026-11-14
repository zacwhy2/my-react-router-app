import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Route } from "./+types/txns1";
import { getSupabaseClient } from "../utils/supabase";

type Transaction = {
  id: number;
  created_at: string;
  occured_at: string;
  amount: number | string;
  from: string;
  to: string;
  description: string;
};

type TransactionDraft = {
  occured_at: string;
  amount: string;
  from: string;
  to: string;
  description: string;
};

const emptyDraft: TransactionDraft = {
  occured_at: "",
  amount: "",
  from: "",
  to: "",
  description: "",
};

function newTransactionDraft(): TransactionDraft {
  const today = new Date();
  const occured_at = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  return { ...emptyDraft, occured_at };
}

const inputClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";

function sortTransactions(transactions: Transaction[]) {
  return [...transactions].sort(
    (a, b) =>
      b.occured_at.localeCompare(a.occured_at) ||
      b.id - a.id,
  );
}

function hasMissingFields(draft: TransactionDraft) {
  return (
    !draft.occured_at ||
    !draft.amount.trim() ||
    !draft.from.trim() ||
    !draft.to.trim() ||
    !draft.description.trim()
  );
}

function amountToCents(amount: string): number | null {
  const match = /^(-?)(\d*)(?:\.(\d{0,2}))?$/.exec(amount.trim());
  if (!match || (!match[2] && !match[3])) return null;

  const cents = Number(`${match[2] || "0"}${(match[3] || "").padEnd(2, "0")}`);
  if (!Number.isSafeInteger(cents)) return null;
  return match[1] === "-" ? -cents : cents;
}

function formatAmount(amount: number | string): string {
  const cents = Number(amount);
  return Number.isFinite(cents) ? (cents / 100).toFixed(2) : String(amount);
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Transactions" },
    { name: "description", content: "Manage transactions." },
  ];
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newDraft, setNewDraft] = useState<TransactionDraft>(
    newTransactionDraft,
  );
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<TransactionDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isModalOpen = isCreateOpen || editingId !== null;

  useEffect(() => {
    async function fetchTransactions() {
      try {
        const { data, error } = await getSupabaseClient()
          .from("txns1")
          .select("*")
          .order("occured_at", { ascending: false })
          .order("id", { ascending: false });

        if (error) throw error;

        setTransactions(data);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load transactions.",
        );
      } finally {
        setLoading(false);
      }
    }

    void fetchTransactions();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;

    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [isModalOpen]);

  function closeModal() {
    setIsCreateOpen(false);
    setEditingId(null);
    setNewDraft(newTransactionDraft());
    setEditDraft(emptyDraft);
    setErrorMessage("");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (hasMissingFields(newDraft)) {
      setErrorMessage("All transaction fields are required.");
      return;
    }
    const amount = amountToCents(newDraft.amount);
    if (amount === null) {
      setErrorMessage("Enter a valid amount with no more than two decimal places.");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    try {
      const { data, error } = await getSupabaseClient()
        .from("txns1")
        .insert({
          occured_at: newDraft.occured_at,
          amount,
          from: newDraft.from.trim(),
          to: newDraft.to.trim(),
          description: newDraft.description.trim(),
        })
        .select("*")
        .single();

      if (error) throw error;

      setTransactions((currentTransactions) =>
        sortTransactions([...currentTransactions, data]),
      );
      setNewDraft(newTransactionDraft());
      setIsCreateOpen(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the transaction.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingId === null || busy) return;
    if (hasMissingFields(editDraft)) {
      setErrorMessage("All transaction fields are required.");
      return;
    }
    const amount = amountToCents(editDraft.amount);
    if (amount === null) {
      setErrorMessage("Enter a valid amount with no more than two decimal places.");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    try {
      const { data, error } = await getSupabaseClient()
        .from("txns1")
        .update({
          occured_at: editDraft.occured_at,
          amount,
          from: editDraft.from.trim(),
          to: editDraft.to.trim(),
          description: editDraft.description.trim(),
        })
        .eq("id", editingId)
        .select("*")
        .single();

      if (error) throw error;

      setTransactions((currentTransactions) =>
        sortTransactions(
          currentTransactions.map((transaction) =>
            transaction.id === data.id ? data : transaction,
          ),
        ),
      );
      setEditingId(null);
      setEditDraft(emptyDraft);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update the transaction.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    if (busy) return;

    setBusy(true);
    setErrorMessage("");
    try {
      const { data, error } = await getSupabaseClient()
        .from("txns1")
        .delete()
        .eq("id", id)
        .select("id");

      if (error) throw error;
      if (data.length === 0) {
        throw new Error("This transaction could not be found or deleted.");
      }

      setTransactions((currentTransactions) =>
        currentTransactions.filter((transaction) => transaction.id !== id),
      );
      if (editingId === id) {
        setEditingId(null);
        setEditDraft(emptyDraft);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete the transaction.",
      );
    } finally {
      setBusy(false);
    }
  }

  function startEditing(transaction: Transaction) {
    setEditingId(transaction.id);
    setEditDraft({
      occured_at: transaction.occured_at,
      amount: formatAmount(transaction.amount),
      from: transaction.from,
      to: transaction.to,
      description: transaction.description,
    });
    setErrorMessage("");
  }

  function renderFields(
    draft: TransactionDraft,
    setDraft: (draft: TransactionDraft) => void,
    prefix: string,
  ) {
    return (
      <>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-slate-700"
            htmlFor={`${prefix}-occured-at`}
          >
            Date
          </label>
          <input
            id={`${prefix}-occured-at`}
            className={inputClassName}
            type="date"
            value={draft.occured_at}
            onChange={(event) =>
              setDraft({ ...draft, occured_at: event.target.value })
            }
            required
          />
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-slate-700"
            htmlFor={`${prefix}-amount`}
          >
            Amount
          </label>
          <input
            id={`${prefix}-amount`}
            className={inputClassName}
            type="number"
            step="0.01"
            value={draft.amount}
            onChange={(event) =>
              setDraft({ ...draft, amount: event.target.value })
            }
            required
          />
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-slate-700"
            htmlFor={`${prefix}-from`}
          >
            From
          </label>
          <input
            id={`${prefix}-from`}
            className={inputClassName}
            value={draft.from}
            onChange={(event) => setDraft({ ...draft, from: event.target.value })}
            required
          />
        </div>
        <div>
          <label
            className="mb-1 block text-sm font-medium text-slate-700"
            htmlFor={`${prefix}-to`}
          >
            To
          </label>
          <input
            id={`${prefix}-to`}
            className={inputClassName}
            value={draft.to}
            onChange={(event) => setDraft({ ...draft, to: event.target.value })}
            required
          />
        </div>
        <div className="sm:col-span-2">
          <label
            className="mb-1 block text-sm font-medium text-slate-700"
            htmlFor={`${prefix}-description`}
          >
            Description
          </label>
          <input
            id={`${prefix}-description`}
            className={inputClassName}
            value={draft.description}
            onChange={(event) =>
              setDraft({ ...draft, description: event.target.value })
            }
            required
          />
        </div>
      </>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900">
      <section className="mx-auto w-full max-w-5xl">
        <div className="mb-4 flex justify-end">
          <button
            className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={() => {
              setErrorMessage("");
              setNewDraft(newTransactionDraft());
              setIsCreateOpen(true);
            }}
            disabled={loading || busy}
          >
            Add a transaction
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
          aria-label="Transactions list"
        >
          {loading ? (
            <p className="p-6 text-slate-600" role="status">
              Loading transactions…
            </p>
          ) : transactions.length === 0 ? (
            <p className="p-6 text-slate-600">
              No transactions yet. Add one above to get started.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {transactions.map((transaction) => (
                <li className="p-5" key={transaction.id}>
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-lg font-semibold">
                          {formatAmount(transaction.amount)}
                        </span>
                        <span className="text-sm text-slate-500">
                          {transaction.occured_at}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-slate-800">
                        {transaction.from} <span aria-hidden="true">→</span>{" "}
                        {transaction.to}
                      </p>
                      <p className="mt-1 break-words text-sm text-slate-600">
                        {transaction.description}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        Created{" "}
                        {new Date(transaction.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                        type="button"
                        onClick={() => startEditing(transaction)}
                        disabled={busy}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        type="button"
                        onClick={() => void handleDelete(transaction.id)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>

      {isModalOpen && (
        <dialog
          ref={dialogRef}
          className="m-auto max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50"
          aria-labelledby="transaction-modal-title"
          onCancel={(event) => {
            event.preventDefault();
            if (!busy) closeModal();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget && !busy) closeModal();
          }}
        >
          <form
            className="p-6"
            onSubmit={isCreateOpen ? handleCreate : handleUpdate}
          >
            <h2
              className="mb-5 text-xl font-semibold"
              id="transaction-modal-title"
            >
              {isCreateOpen ? "Add transaction" : "Edit transaction"}
            </h2>
            {errorMessage && (
              <p
                className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
              >
                {errorMessage}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {renderFields(
                isCreateOpen ? newDraft : editDraft,
                isCreateOpen ? setNewDraft : setEditDraft,
                isCreateOpen ? "new" : `edit-${editingId}`,
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                type="button"
                onClick={closeModal}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                type="submit"
                disabled={
                  busy ||
                  hasMissingFields(isCreateOpen ? newDraft : editDraft) ||
                  amountToCents(
                    (isCreateOpen ? newDraft : editDraft).amount,
                  ) === null
                }
              >
                {isCreateOpen ? "Add transaction" : "Save changes"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </main>
  );
}
