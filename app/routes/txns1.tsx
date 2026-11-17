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

function getLocalDateString() {
  return formatLocalDate(new Date());
}

function formatLocalDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function newTransactionDraft(): TransactionDraft {
  return { ...emptyDraft, occured_at: getLocalDateString() };
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
  const [selectedDate, setSelectedDate] = useState(getLocalDateString);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newDraft, setNewDraft] = useState<TransactionDraft>(
    newTransactionDraft,
  );
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<TransactionDraft>(emptyDraft);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const calendarPopoverRef = useRef<HTMLDetailsElement>(null);
  const isModalOpen =
    isCreateOpen || editingId !== null || selectedTransaction !== null;
  const visibleTransactions = transactions.filter(
    (transaction) => transaction.occured_at === selectedDate,
  );
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const firstWeekday = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1,
    ).getDay();
    return new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      index - firstWeekday + 1,
    );
  });

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
    setSelectedTransaction(null);
    setIsDeleteConfirmOpen(false);
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
      setSelectedTransaction(null);
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
      if (editingId === id) setEditingId(null);
      if (selectedTransaction?.id === id) setSelectedTransaction(null);
      setIsDeleteConfirmOpen(false);
      setEditDraft(emptyDraft);
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
    setSelectedTransaction(null);
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
        <div className="mb-4 flex items-center justify-between gap-3">
          <details ref={calendarPopoverRef} className="relative w-fit">
            <summary
              className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 [&::-webkit-details-marker]:hidden"
              aria-label={`Choose date, currently ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString()}`}
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z"
                />
              </svg>
              {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
                undefined,
                { dateStyle: "medium" },
              )}
            </summary>
            <section
              className="absolute left-0 top-full z-10 mt-2 w-72 rounded-xl bg-white p-3 shadow-lg ring-1 ring-slate-200"
              aria-label="Select transaction date"
            >
              <div className="mb-2 flex items-center justify-between">
                <button
                  className="rounded-md p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  type="button"
                  aria-label="Previous month"
                  onClick={() =>
                    setCalendarMonth(
                      (month) =>
                        new Date(month.getFullYear(), month.getMonth() - 1, 1),
                    )
                  }
                >
                  <span aria-hidden="true">‹</span>
                </button>
                <h2 className="text-sm font-semibold text-slate-800">
                  {calendarMonth.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
                <button
                  className="rounded-md p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  type="button"
                  aria-label="Next month"
                  onClick={() =>
                    setCalendarMonth(
                      (month) =>
                        new Date(month.getFullYear(), month.getMonth() + 1, 1),
                    )
                  }
                >
                  <span aria-hidden="true">›</span>
                </button>
              </div>
              <div
                className="grid grid-cols-7 text-center text-xs"
                aria-label="Calendar days"
              >
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (weekday) => (
                    <span
                      className="py-1 font-medium text-slate-500"
                      key={weekday}
                    >
                      {weekday}
                    </span>
                  ),
                )}
                {calendarDays.map((date) => {
                  const dateString = formatLocalDate(date);
                  const isSelected = dateString === selectedDate;
                  const isCurrentMonth =
                    date.getMonth() === calendarMonth.getMonth();
                  const isToday = dateString === getLocalDateString();

                  return (
                    <button
                      className={`mx-auto my-0.5 flex h-9 w-9 items-center justify-center rounded-full text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        isSelected
                          ? "bg-indigo-600 font-semibold text-white"
                          : isCurrentMonth
                            ? "text-slate-800 hover:bg-indigo-50"
                            : "text-slate-400 hover:bg-slate-100"
                      } ${isToday && !isSelected ? "ring-1 ring-inset ring-indigo-300" : ""}`}
                      key={dateString}
                      type="button"
                      aria-label={date.toLocaleDateString(undefined, {
                        dateStyle: "full",
                      })}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedDate(dateString);
                        if (calendarPopoverRef.current) {
                          calendarPopoverRef.current.open = false;
                        }
                        if (!isCurrentMonth) {
                          setCalendarMonth(
                            new Date(date.getFullYear(), date.getMonth(), 1),
                          );
                        }
                      }}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </section>
          </details>
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
            Add transaction
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
          ) : visibleTransactions.length === 0 ? (
            <p className="p-6 text-slate-600">
              {transactions.length === 0
                ? "No transactions yet. Add one above to get started."
                : `No transactions for ${selectedDate}.`}
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {visibleTransactions.map((transaction) => (
                <li key={transaction.id}>
                  <button
                    className="w-full px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                    type="button"
                    onClick={() => {
                      setErrorMessage("");
                      setSelectedTransaction(transaction);
                    }}
                    disabled={busy}
                    aria-haspopup="dialog"
                  >
                    <div className="flex min-w-0 items-center justify-start gap-4">
                      <span className="shrink-0 font-semibold">
                        {formatAmount(transaction.amount)}
                      </span>
                      <div className="min-w-0 text-left">
                        <p className="break-words text-sm text-slate-800">
                          {transaction.from} <span aria-hidden="true">→</span>{" "}
                          {transaction.to}
                        </p>
                        <p className="mt-0.5 break-words text-xs text-slate-600">
                          {transaction.description}
                        </p>
                      </div>
                    </div>
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
          className="m-auto max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50"
          aria-labelledby="transaction-modal-title"
          onCancel={(event) => {
            event.preventDefault();
            if (!busy) {
              if (isDeleteConfirmOpen) {
                setIsDeleteConfirmOpen(false);
                setErrorMessage("");
              } else {
                closeModal();
              }
            }
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget && !busy) {
              if (isDeleteConfirmOpen) {
                setIsDeleteConfirmOpen(false);
                setErrorMessage("");
              } else {
                closeModal();
              }
            }
          }}
        >
          {isCreateOpen || editingId !== null ? (
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
          ) : selectedTransaction && isDeleteConfirmOpen ? (
            <div className="p-6" aria-describedby="delete-confirmation-message">
              <h2
                className="mb-3 text-xl font-semibold"
                id="transaction-modal-title"
              >
                Delete transaction?
              </h2>
              <p
                className="text-sm text-slate-600"
                id="delete-confirmation-message"
              >
                This action can’t be undone.
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
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
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
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  type="button"
                  onClick={() => void handleDelete(selectedTransaction.id)}
                  disabled={busy}
                >
                  {busy ? "Deleting…" : "Delete transaction"}
                </button>
              </div>
            </div>
          ) : selectedTransaction ? (
            <div className="p-6">
              <h2
                className="mb-5 text-xl font-semibold"
                id="transaction-modal-title"
              >
                Transaction details
              </h2>
              {errorMessage && (
                <p
                  className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-slate-500">Date</dt>
                  <dd className="mt-1">{selectedTransaction.occured_at}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Amount</dt>
                  <dd className="mt-1">
                    {formatAmount(selectedTransaction.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">From</dt>
                  <dd className="mt-1 break-words">
                    {selectedTransaction.from}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">To</dt>
                  <dd className="mt-1 break-words">{selectedTransaction.to}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-slate-500">
                    Description
                  </dt>
                  <dd className="mt-1 break-words">
                    {selectedTransaction.description}
                  </dd>
                </div>
              </dl>
              <div className="mt-6 flex items-center justify-between">
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
                  type="button"
                  onClick={() => {
                    setErrorMessage("");
                    setIsDeleteConfirmOpen(true);
                  }}
                  disabled={busy}
                  aria-label="Delete transaction"
                  title="Delete transaction"
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
                      d="M4 7h16m-10 4v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"
                    />
                  </svg>
                </button>
                <div className="flex justify-end gap-2">
                  <button
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    type="button"
                    onClick={closeModal}
                    disabled={busy}
                  >
                    Close
                  </button>
                  <button
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    type="button"
                    onClick={() => startEditing(selectedTransaction)}
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
