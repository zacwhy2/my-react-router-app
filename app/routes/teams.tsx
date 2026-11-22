import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Route } from "./+types/teams";
import { getSupabaseClient } from "../utils/supabase";
import {
  getTeamAccountRelatedIds,
  replaceTeamAccountLinks,
  type TeamAccountLink,
} from "../utils/team-account";
import {
  getTeamMemberUserIds,
  replaceTeamMembers,
  type TeamMemberLink,
} from "../utils/team-member";

type Team = {
  id: number;
  created_at: string;
  name: string;
};

type TeamDraft = {
  name: string;
  account_ids: number[];
  member_user_ids: string[];
};

type Account = {
  id: number;
  name: string;
};

const emptyDraft: TeamDraft = {
  name: "",
  account_ids: [],
  member_user_ids: [],
};
const uuidPattern =
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [teamAccountIds, setTeamAccountIds] = useState<
    Record<number, number[]>
  >({});
  const [teamMemberUserIds, setTeamMemberUserIds] = useState<
    Record<number, string[]>
  >({});
  const [memberIdInput, setMemberIdInput] = useState("");
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
        const [teamResult, accountResult, linkResult, memberResult] =
          await Promise.all([
            getSupabaseClient()
              .from("teams")
              .select("id, created_at, name")
              .order("name", { ascending: true }),
            getSupabaseClient()
              .from("accounts")
              .select("id, name")
              .order("name", { ascending: true }),
            getSupabaseClient()
              .from("team_account")
              .select("id, team_id, account_id"),
            getSupabaseClient()
              .from("team_member")
              .select("id, team_id, user_id"),
          ]);

        if (teamResult.error) throw teamResult.error;
        if (accountResult.error) throw accountResult.error;
        if (linkResult.error) throw linkResult.error;
        if (memberResult.error) throw memberResult.error;
        setTeams(teamResult.data);
        setAccounts(accountResult.data);
        setTeamAccountIds(
          linkResult.data.reduce<Record<number, number[]>>(
            (assignments, link: TeamAccountLink) => {
              const accountIds = assignments[link.team_id] ?? [];
              if (!accountIds.includes(link.account_id)) {
                assignments[link.team_id] = [...accountIds, link.account_id];
              }
              return assignments;
            },
            {},
          ),
        );
        setTeamMemberUserIds(
          memberResult.data.reduce<Record<number, string[]>>(
            (members, member: TeamMemberLink) => {
              const userIds = members[member.team_id] ?? [];
              if (!userIds.includes(member.user_id)) {
                members[member.team_id] = [...userIds, member.user_id];
              }
              return members;
            },
            {},
          ),
        );
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
      try {
        await replaceTeamAccountLinks(
          "team_id",
          data.id,
          "account_id",
          newDraft.account_ids,
        );
        await replaceTeamMembers(data.id, newDraft.member_user_ids);
      } catch (error) {
        let savedAccountIds: number[] = [];
        let reloadError = "";
        try {
          savedAccountIds = await getTeamAccountRelatedIds(
            "team_id",
            data.id,
            "account_id",
          );
        } catch (loadError) {
          reloadError = ` Current assignments could not be reloaded: ${
            loadError instanceof Error ? loadError.message : "Unknown error."
          }`;
        }
        setTeams((currentTeams) =>
          [...currentTeams, data].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setTeamAccountIds((currentAssignments) => ({
          ...currentAssignments,
          [data.id]: savedAccountIds,
        }));
        let savedMemberUserIds: string[] = [];
        let reloadMembersError = "";
        try {
          savedMemberUserIds = await getTeamMemberUserIds(data.id);
        } catch (loadError) {
          reloadMembersError = ` Current members could not be reloaded: ${
            loadError instanceof Error ? loadError.message : "Unknown error."
          }`;
        }
        setTeamMemberUserIds((currentMembers) => ({
          ...currentMembers,
          [data.id]: savedMemberUserIds,
        }));
        setNewDraft(emptyDraft);
        setIsCreateOpen(false);
        setSelectedTeam(data);
        setIsEditing(true);
        setEditDraft({
          name: data.name,
          account_ids: savedAccountIds,
          member_user_ids: savedMemberUserIds,
        });
        setErrorMessage(
          `Team created, but account or member assignments could not be saved: ${
            error instanceof Error ? error.message : "Unknown error."
          }${reloadError}${reloadMembersError}`,
        );
        return;
      }
      setTeams((currentTeams) =>
        [...currentTeams, data].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setTeamAccountIds((currentAssignments) => ({
        ...currentAssignments,
        [data.id]: newDraft.account_ids,
      }));
      setTeamMemberUserIds((currentMembers) => ({
        ...currentMembers,
        [data.id]: newDraft.member_user_ids,
      }));
      setMemberIdInput("");
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
      try {
        await replaceTeamAccountLinks(
          "team_id",
          data.id,
          "account_id",
          editDraft.account_ids,
        );
        await replaceTeamMembers(data.id, editDraft.member_user_ids);
      } catch (error) {
        let savedAccountIds: number[] = [];
        let savedMemberUserIds: string[] = [];
        const reloadErrors: string[] = [];
        try {
          savedAccountIds = await getTeamAccountRelatedIds(
            "team_id",
            data.id,
            "account_id",
          );
        } catch (loadError) {
          reloadErrors.push(
            `Account assignments could not be reloaded: ${
              loadError instanceof Error ? loadError.message : "Unknown error."
            }.`,
          );
        }
        try {
          savedMemberUserIds = await getTeamMemberUserIds(data.id);
        } catch (loadError) {
          reloadErrors.push(
            `Member assignments could not be reloaded: ${
              loadError instanceof Error ? loadError.message : "Unknown error."
            }.`,
          );
        }
        setTeams((currentTeams) =>
          currentTeams
            .map((team) => (team.id === data.id ? data : team))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        setTeamAccountIds((currentAssignments) => ({
          ...currentAssignments,
          [data.id]: savedAccountIds,
        }));
        setTeamMemberUserIds((currentMembers) => ({
          ...currentMembers,
          [data.id]: savedMemberUserIds,
        }));
        setSelectedTeam(data);
        throw new Error(
          `Team details were updated, but account or member assignments could not be saved: ${
            error instanceof Error ? error.message : "Unknown error."
          } ${reloadErrors.join(" ")}`,
        );
      }
      setTeams((currentTeams) =>
        currentTeams
          .map((team) => (team.id === data.id ? data : team))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setTeamAccountIds((currentAssignments) => ({
        ...currentAssignments,
        [data.id]: editDraft.account_ids,
      }));
      setTeamMemberUserIds((currentMembers) => ({
        ...currentMembers,
        [data.id]: editDraft.member_user_ids,
      }));
      setMemberIdInput("");
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
      const previousAccountIds = await getTeamAccountRelatedIds(
        "team_id",
        team.id,
        "account_id",
      );
      const previousMemberUserIds = await getTeamMemberUserIds(team.id);
      try {
        await replaceTeamAccountLinks("team_id", team.id, "account_id", []);
        await replaceTeamMembers(team.id, []);
      } catch (unlinkError) {
        try {
          await replaceTeamAccountLinks(
            "team_id",
            team.id,
            "account_id",
            previousAccountIds,
          );
          await replaceTeamMembers(team.id, previousMemberUserIds);
        } catch (restoreError) {
          throw new Error(
            `Unable to remove the team's account assignments, and they could not be restored: ${
              restoreError instanceof Error
                ? restoreError.message
                : "Unknown error."
            }`,
          );
        }
        throw unlinkError;
      }
      const { data, error } = await getSupabaseClient()
        .from("teams")
        .delete()
        .eq("id", team.id)
        .select("id");

      if (error || data.length === 0) {
        try {
          await replaceTeamAccountLinks(
            "team_id",
            team.id,
            "account_id",
            previousAccountIds,
          );
          await replaceTeamMembers(team.id, previousMemberUserIds);
        } catch (restoreError) {
          throw new Error(
            `Unable to delete the team, and its account assignments could not be restored: ${
              restoreError instanceof Error
                ? restoreError.message
                : "Unknown error."
            }`,
          );
        }
        if (error) throw error;
        throw new Error("This team could not be found or deleted.");
      }

      setTeams((currentTeams) =>
        currentTeams.filter((item) => item.id !== team.id),
      );
      setTeamAccountIds((currentAssignments) => {
        const remainingAssignments = { ...currentAssignments };
        delete remainingAssignments[team.id];
        return remainingAssignments;
      });
      setTeamMemberUserIds((currentMembers) => {
        const remainingMembers = { ...currentMembers };
        delete remainingMembers[team.id];
        return remainingMembers;
      });
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
    setEditDraft({
      name: team.name,
      account_ids: teamAccountIds[team.id] ?? [],
      member_user_ids: teamMemberUserIds[team.id] ?? [],
    });
    setMemberIdInput("");
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
    setMemberIdInput("");
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
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          required
          autoFocus
          disabled={busy}
        />
      </div>
    );
  }

  function renderAccountAssignments(
    selectedAccountIds: number[],
    onChange: (accountIds: number[]) => void,
    prefix: string,
  ) {
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Accounts</legend>
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-500">No accounts available.</p>
        ) : (
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
            {accounts.map((account) => (
              <label
                key={account.id}
                className="flex items-center gap-2 text-sm text-slate-700"
                htmlFor={`${prefix}-account-${account.id}`}
              >
                <input
                  id={`${prefix}-account-${account.id}`}
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={selectedAccountIds.includes(account.id)}
                  disabled={busy}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selectedAccountIds, account.id]
                        : selectedAccountIds.filter((id) => id !== account.id),
                    )
                  }
                />
                {account.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
    );
  }

  function renderMembers(
    selectedUserIds: string[],
    onChange: (userIds: string[]) => void,
    prefix: string,
  ) {
    function addMember() {
      const userId = memberIdInput.trim().toLowerCase();
      if (!uuidPattern.test(userId)) {
        setErrorMessage("Enter a valid Supabase Auth user UUID.");
        return;
      }
      if (selectedUserIds.includes(userId)) {
        setErrorMessage("This user is already a team member.");
        return;
      }

      onChange([...selectedUserIds, userId]);
      setMemberIdInput("");
      setErrorMessage("");
    }

    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">Members</legend>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor={`${prefix}-member-user-id`}>
            Supabase Auth user UUID
          </label>
          <input
            id={`${prefix}-member-user-id`}
            className={`${inputClassName} min-w-0 flex-1`}
            value={memberIdInput}
            onChange={(event) => setMemberIdInput(event.target.value)}
            placeholder="Supabase Auth user UUID"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={busy}
          />
          <button
            className={`${buttonClassName} border border-slate-300 text-slate-700 hover:bg-slate-50`}
            type="button"
            onClick={addMember}
            disabled={busy || !memberIdInput.trim()}
          >
            Add
          </button>
        </div>
        {selectedUserIds.length > 0 ? (
          <ul className="max-h-36 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
            {selectedUserIds.map((userId) => (
              <li
                key={userId}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0 break-all text-slate-700">
                  {userId}
                </span>
                <button
                  className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                  type="button"
                  onClick={() => {
                    onChange(selectedUserIds.filter((id) => id !== userId));
                    setErrorMessage("");
                  }}
                  disabled={busy}
                  aria-label={`Remove member ${userId}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No team members assigned.</p>
        )}
      </fieldset>
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
              setMemberIdInput("");
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
                    <span className="block">{team.name}</span>
                    {(teamAccountIds[team.id] ?? []).length > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {(teamAccountIds[team.id] ?? []).map((accountId) => {
                          const account = accounts.find(
                            (item) => item.id === accountId,
                          );
                          return account ? (
                            <span
                              key={account.id}
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                            >
                              {account.name}
                            </span>
                          ) : null;
                        })}
                      </span>
                    )}
                    {(teamMemberUserIds[team.id] ?? []).length > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {(teamMemberUserIds[team.id] ?? []).map((userId) => (
                          <span
                            key={userId}
                            title={userId}
                            className="max-w-full break-all rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                          >
                            {userId}
                          </span>
                        ))}
                      </span>
                    )}
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
              {renderAccountAssignments(
                newDraft.account_ids,
                (account_ids) => setNewDraft({ ...newDraft, account_ids }),
                "new-team",
              )}
              {renderMembers(
                newDraft.member_user_ids,
                (member_user_ids) =>
                  setNewDraft({ ...newDraft, member_user_ids }),
                "new-team",
              )}
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
              {renderAccountAssignments(
                editDraft.account_ids,
                (account_ids) => setEditDraft({ ...editDraft, account_ids }),
                `edit-team-${selectedTeam.id}`,
              )}
              {renderMembers(
                editDraft.member_user_ids,
                (member_user_ids) =>
                  setEditDraft({ ...editDraft, member_user_ids }),
                `edit-team-${selectedTeam.id}`,
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
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    Accounts
                  </dt>
                  <dd className="mt-2 flex flex-wrap gap-2">
                    {(teamAccountIds[selectedTeam.id] ?? []).length > 0 ? (
                      (teamAccountIds[selectedTeam.id] ?? []).map(
                        (accountId) => {
                          const account = accounts.find(
                            (item) => item.id === accountId,
                          );
                          return account ? (
                            <span
                              key={account.id}
                              className="rounded-full bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700"
                            >
                              {account.name}
                            </span>
                          ) : null;
                        },
                      )
                    ) : (
                      <span className="text-sm text-slate-500">None</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">
                    Members
                  </dt>
                  <dd className="mt-2 space-y-1">
                    {(teamMemberUserIds[selectedTeam.id] ?? []).length > 0 ? (
                      (teamMemberUserIds[selectedTeam.id] ?? []).map(
                        (userId) => (
                          <div
                            key={userId}
                            className="break-all text-sm text-slate-700"
                          >
                            {userId}
                          </div>
                        ),
                      )
                    ) : (
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
