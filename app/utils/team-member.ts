import { getSupabaseClient } from "./supabase";

export type TeamMemberLink = {
  id: number;
  team_id: number;
  user_id: string;
};

export async function getTeamMemberUserIds(teamId: number) {
  const { data, error } = await getSupabaseClient()
    .from("team_member")
    .select("id, team_id, user_id")
    .eq("team_id", teamId);

  if (error) throw error;
  return [...new Set(data.map((member) => member.user_id))];
}

export async function replaceTeamMembers(
  teamId: number,
  userIds: string[],
) {
  const supabase = getSupabaseClient();
  const { data: currentMembers, error: loadError } = await supabase
    .from("team_member")
    .select("id, team_id, user_id")
    .eq("team_id", teamId);

  if (loadError) throw loadError;

  const desiredIds = [...new Set(userIds)];
  const desiredIdSet = new Set(desiredIds);
  const keptIds = new Set<string>();
  const idsToRemove: number[] = [];

  for (const member of currentMembers) {
    if (!desiredIdSet.has(member.user_id) || keptIds.has(member.user_id)) {
      idsToRemove.push(member.id);
    } else {
      keptIds.add(member.user_id);
    }
  }

  const idsToAdd = desiredIds.filter((id) => !keptIds.has(id));
  if (idsToAdd.length > 0) {
    const { error } = await supabase
      .from("team_member")
      .insert(idsToAdd.map((user_id) => ({ team_id: teamId, user_id })));
    if (error) throw error;
  }

  if (idsToRemove.length > 0) {
    const { error } = await supabase
      .from("team_member")
      .delete()
      .in("id", idsToRemove);
    if (error) throw error;
  }

  const { data: savedMembers, error: verifyError } = await supabase
    .from("team_member")
    .select("id, team_id, user_id")
    .eq("team_id", teamId);

  if (verifyError) throw verifyError;
  const savedUserIds = savedMembers.map((member) => member.user_id);
  if (
    savedUserIds.length !== desiredIds.length ||
    desiredIds.some((id) => !savedUserIds.includes(id))
  ) {
    throw new Error("Team members could not be saved.");
  }
}
