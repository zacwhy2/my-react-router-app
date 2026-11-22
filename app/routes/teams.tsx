import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Route } from "./+types/teams";
import { getSupabaseClient } from "../utils/supabase";

type Team = {
  id: number;
  created_at: string;
  name: string;
};

type TeamDraft = {
  name: string;
};

const emptyDraft: TeamDraft = { name: "" };
const inputClassName =
  "rounded-lg border border-slate-300 px-3 py-2 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";
const buttonClassName =
  "rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Teams" },
    { name: "description", content: "Manage teams." },
  ];
}

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [newDraft, setNewDraft] = useState<TeamDraft>(emptyDraft);
  const [editDraft, setEditDraft] = useState<TeamDraft>(emptyDraft);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isModalOpen = isCreateOpen || selectedTeam !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open || !isModalOpen) return;

    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [isModalOpen]);

  useEffect(() => {
    async function fetchTeams() {
      try {
        const { data, error } = await getSupabaseClient()
          .from("teams")
          .select("id, created_at, name")
          .order("name", { ascending: true });

        if (error) throw error;
        setTeams(data);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load teams.",
        );
      } finally {
        setLoading(false);
      }
    }

    void fetchTeams();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const name = newDraft.name.trim();
    if (!name) {
      setErrorMessage("Team name is required.");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    try {
      const { data, error } = await getSupabaseClient()
        .from("teams")
        .insert({ name })
        .select("id, created_at, name")
        .single();

      if (error?.code === "23505") {
        throw new Error("A team with this name already exists.");
      }
      if (error) throw error;
      setTeams((currentTeams) =>
        [...currentTeams, data].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setNewDraft(emptyDraft);
      setIsCreateOpen(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create the team.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTeam || busy) return;
    const name = editDraft.name.trim();
    if (!name) {
      setErrorMessage("Team name is required.");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    try {
      const { data, error } = await getSupabaseClient()
        .from("teams")
        .update({ name })
        .eq("id", selectedTeam.id)
        .select("id, created_at, name")
        .single();

      if (error?.code === "23505") {
        throw new Error("A team with this name already exists.");
      }
      if (error) throw error;
      setTeams((currentTeams) =>
        currentTeams
          .map((team) => (team.id === data.id ? data : team))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setSelectedTeam(data);
      setIsEditing(false);
      setEditDraft(emptyDraft);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update the team.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(team: Team) {
    if (busy) return;

    setBusy(true);
    setErrorMessage("");
    try {
      const { data, error } = await getSupabaseClient()
        .from("teams")
        .delete()
        .eq("id", team.id)
        .select("id");

      if (error) throw error;
      if (data.length === 0) {
        throw new Error("This team could not be found or deleted.");
      }

      setTeams((currentTeams) =>
        currentTeams.filter((item) => item.id !== team.id),
      );
      setIsDeleteConfirmOpen(false);
      setSelectedTeam(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to delete the team.",
      );
    } finally {
      setBusy(false);
    }
  }

  function startEditing(team: Team) {
    setEditDraft({ name: team.name });
    setIsEditing(true);
    setIsDeleteConfirmOpen(false);
    setErrorMessage("");
  }

  function closeModal() {
    if (busy) return;
    setIsCreateOpen(false);
    setSelectedTeam(null);
    setIsEditing(false);
    setIsDeleteConfirmOpen(false);
    setNewDraft(emptyDraft);
    setEditDraft(emptyDraft);
    setErrorMessage("");
  }

  function renderNameInput(
    draft: TeamDraft,
    setDraft: (draft: TeamDraft) => void,
    id: string,
  ) {
    return (
      <div>
        <label
          className="mb-1 block text-sm font-medium text-slate-700"
          htmlFor={id}
        >
          Name
        </label>
        <input
          id={id}
          className={`${inputClassName} w-full`}
          value={draft.name}
          onChange={(event) => setDraft({ name: event.target.value })}
          required
          autoFocus
          disabled={busy}
        />
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
            Add team
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
          aria-label="Teams list"
        >
          {loading ? (
            <p className="p-6 text-slate-600" role="status">
              Loading teams…
            </p>
          ) : teams.length === 0 ? (
            <p className="p-6 text-slate-600">
              No teams yet. Add one to get started.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {teams.map((team) => (
                <li key={team.id}>
                  <button
                    className="w-full px-4 py-4 text-left font-medium transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 sm:px-5"
                    type="button"
                    onClick={() => {
                      setErrorMessage("");
                      setSelectedTeam(team);
                    }}
                    disabled={busy}
                    aria-haspopup="dialog"
                  >
                    {team.name}
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
          aria-labelledby="teams-modal-title"
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
            if (event.target !== event.currentTarget) return;
            if (isDeleteConfirmOpen) {
              setIsDeleteConfirmOpen(false);
              setErrorMessage("");
            } else {
              closeModal();
            }
          }}
        >
          {isCreateOpen ? (
            <form className="space-y-5 p-5" onSubmit={handleCreate}>
              <h2 className="text-xl font-semibold" id="teams-modal-title">
                Add team
              </h2>
              {errorMessage && (
                <p
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}
              {renderNameInput(newDraft, setNewDraft, "new-team-name")}
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
                  {busy ? "Adding…" : "Add team"}
                </button>
              </div>
            </form>
          ) : selectedTeam && isDeleteConfirmOpen ? (
            <div className="p-6">
              <h2 className="mb-3 text-xl font-semibold" id="teams-modal-title">
                Delete team?
              </h2>
              <p className="text-sm text-slate-600">
                Delete “{selectedTeam.name}”? This can’t be undone.
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
                  onClick={() => void handleDelete(selectedTeam)}
                  disabled={busy}
                >
                  {busy ? "Deleting…" : "Delete team"}
                </button>
              </div>
            </div>
          ) : selectedTeam && isEditing ? (
            <form className="space-y-5 p-5" onSubmit={handleUpdate}>
              <h2 className="text-xl font-semibold" id="teams-modal-title">
                Edit team
              </h2>
              {errorMessage && (
                <p
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}
              {renderNameInput(
                editDraft,
                setEditDraft,
                `edit-team-name-${selectedTeam.id}`,
              )}
              <div className="flex justify-end gap-2">
                <button
                  className={`${buttonClassName} text-slate-600 hover:bg-slate-100`}
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
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
          ) : selectedTeam ? (
            <div className="p-6">
              <h2 className="mb-5 text-xl font-semibold" id="teams-modal-title">
                Team details
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
                  <dd className="mt-1 break-words">
                    {selectedTeam.name}
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
                    onClick={() => startEditing(selectedTeam)}
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
