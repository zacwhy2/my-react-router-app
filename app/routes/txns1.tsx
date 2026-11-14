import { useEffect, useState, type FormEvent } from "react";
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

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Transactions" },
    { name: "description", content: "Manage transactions." },
  ];
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [newDraft, setNewDraft] = useState<TransactionDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<TransactionDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (hasMissingFields(newDraft)) {
      setErrorMessage("All transaction fields are required.");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    try {
      const { data, error } = await getSupabaseClient()
        .from("txns1")
        .insert({
          occured_at: newDraft.occured_at,
          amount: newDraft.amount,
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
      setNewDraft(emptyDraft);
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

    setBusy(true);
    setErrorMessage("");
    try {
      const { data, error } = await getSupabaseClient()
        .from("txns1")
        .update({
          occured_at: editDraft.occured_at,
          amount: editDraft.amount,
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
      amount: String(transaction.amount),
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
            step="any"
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
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <section className="mx-auto w-full max-w-5xl">
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Money movement
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Transactions</h1>
          <p className="mt-2 text-slate-600">
            Record, review, and manage your transactions.
          </p>
        </header>

        <form
          className="mb-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          onSubmit={handleCreate}
        >
          <h2 className="mb-4 text-lg font-semibold">Add transaction</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {renderFields(newDraft, setNewDraft, "new")}
          </div>
          <button
            className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={loading || busy}
          >
            Add transaction
          </button>
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
                  {editingId === transaction.id ? (
                    <form onSubmit={handleUpdate}>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {renderFields(editDraft, setEditDraft, `edit-${transaction.id}`)}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                          type="submit"
                          disabled={busy}
                        >
                          Save changes
                        </button>
                        <button
                          className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft(emptyDraft);
                          }}
                          disabled={busy}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="text-lg font-semibold">
                            {String(transaction.amount)}
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
                          Created {new Date(transaction.created_at).toLocaleString()}
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
