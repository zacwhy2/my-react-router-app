import { getSupabaseClient } from "./supabase";

export type TeamAccountLink = {
  id: number;
  team_id: number;
  account_id: number;
};

export async function getTeamAccountRelatedIds(
  entityColumn: "team_id" | "account_id",
  entityId: number,
  relatedColumn: "account_id" | "team_id",
) {
  const { data, error } = await getSupabaseClient()
    .from("team_account")
    .select("id, team_id, account_id")
    .eq(entityColumn, entityId);

  if (error) throw error;
  return [...new Set(data.map((link) => link[relatedColumn]))];
}

export async function replaceTeamAccountLinks(
  entityColumn: "team_id" | "account_id",
  entityId: number,
  relatedColumn: "account_id" | "team_id",
  relatedIds: number[],
) {
  const supabase = getSupabaseClient();
  const { data: currentLinks, error: loadError } = await supabase
    .from("team_account")
    .select("id, team_id, account_id")
    .eq(entityColumn, entityId);

  if (loadError) throw loadError;

  const desiredIds = [...new Set(relatedIds)];
  const desiredIdSet = new Set(desiredIds);
  const keptIds = new Set<number>();
  const idsToRemove: number[] = [];

  for (const link of currentLinks) {
    const relatedId = link[relatedColumn];
    if (!desiredIdSet.has(relatedId) || keptIds.has(relatedId)) {
      idsToRemove.push(link.id);
    } else {
      keptIds.add(relatedId);
    }
  }

  const idsToAdd = desiredIds.filter((id) => !keptIds.has(id));
  if (idsToAdd.length > 0) {
    const newLinks =
      entityColumn === "team_id"
        ? idsToAdd.map((accountId) => ({
            team_id: entityId,
            account_id: accountId,
          }))
        : idsToAdd.map((teamId) => ({
            team_id: teamId,
            account_id: entityId,
          }));
    const { error } = await supabase.from("team_account").insert(newLinks);
    if (error) throw error;
  }

  if (idsToRemove.length > 0) {
    const { error } = await supabase
      .from("team_account")
      .delete()
      .in("id", idsToRemove);
    if (error) throw error;
  }

  const { data: savedLinks, error: verifyError } = await supabase
    .from("team_account")
    .select("id, team_id, account_id")
    .eq(entityColumn, entityId);

  if (verifyError) throw verifyError;
  const savedIds = savedLinks.map((link) => link[relatedColumn]);
  if (
    savedIds.length !== desiredIds.length ||
    desiredIds.some((id) => !savedIds.includes(id))
  ) {
    throw new Error("Team-account assignments could not be saved.");
  }
}
