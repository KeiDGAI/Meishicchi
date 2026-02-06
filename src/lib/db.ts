import { supabase } from "@/lib/supabaseClient";
import { initialCategories } from "@/lib/seedData";

export type UserProfile = {
  id: string;
  family_id: string | null;
  display_name: string;
};

export type Family = {
  id: string;
  name: string | null;
  invite_code: string;
};

export type Category = {
  id: string;
  name: string;
  icon: string | null;
};

export type Task = {
  id: string;
  name: string;
  points: number;
  category_id: string;
  created_at?: string;
};

export type Reward = {
  id: string;
  name: string;
  cost_points: number;
};

export type Notification = {
  id: string;
  message: string;
  created_at: string;
  is_read: boolean;
};

export async function getSessionUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}

export async function getOrCreateUserProfile() {
  const user = await getSessionUser();
  if (!user) return null;

  const { data: existing, error: selectError } = await supabase
    .from("users")
    .select("id, family_id, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) return existing as UserProfile;

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ??
    user.email ??
    "ユーザー";

  const { data: inserted, error: insertError } = await supabase
    .from("users")
    .insert({
      id: user.id,
      display_name: displayName,
    })
    .select("id, family_id, display_name")
    .single();

  if (insertError) throw insertError;
  return inserted as UserProfile;
}

export async function updateUserFamily(userId: string, familyId: string) {
  const { error } = await supabase
    .from("users")
    .update({ family_id: familyId })
    .eq("id", userId);
  if (error) throw error;
}

export async function createFamily(name: string | null) {
  const user = await getSessionUser();
  if (!user) throw new Error("not authenticated");
  const { data, error } = await supabase
    .from("families")
    .insert({
      name: name && name.trim().length > 0 ? name.trim() : null,
      created_by: user.id,
    })
    .select("id, name, invite_code")
    .single();
  if (error) throw error;
  return data as Family;
}

export async function findFamilyByInviteCode(code: string) {
  const normalized = code.trim().toUpperCase();
  const { data, error } = await supabase
    .from("families")
    .select("id, name, invite_code")
    .eq("invite_code", normalized)
    .maybeSingle();
  if (error) throw error;
  return data as Family | null;
}

export async function getFamily(familyId: string) {
  const { data, error } = await supabase
    .from("families")
    .select("id, name, invite_code")
    .eq("id", familyId)
    .single();
  if (error) throw error;
  return data as Family;
}

export async function getCategory(categoryId: string) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, icon")
    .eq("id", categoryId)
    .single();
  if (error) throw error;
  return data as Category;
}

export async function listCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, icon")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function seedInitialData(familyId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("categories")
    .select("id")
    .eq("family_id", familyId)
    .limit(1);
  if (existingError) throw existingError;
  if (existing && existing.length > 0) {
    return { skipped: true };
  }

  const { data: categoryRows, error: categoryError } = await supabase
    .from("categories")
    .insert(
      initialCategories.map((category) => ({
        family_id: familyId,
        name: category.name,
        icon: category.icon,
      }))
    )
    .select("id, name");
  if (categoryError) throw categoryError;

  const categoryMap = new Map(
    (categoryRows ?? []).map((row) => [row.name, row.id])
  );

  const tasksToInsert = initialCategories.flatMap((category) => {
    const categoryId = categoryMap.get(category.name);
    if (!categoryId) return [];
    return category.tasks.map((task) => ({
      family_id: familyId,
      category_id: categoryId,
      name: task.name,
      points: task.points,
    }));
  });

  const { error: taskError } = await supabase
    .from("chore_tasks")
    .insert(tasksToInsert);
  if (taskError) throw taskError;

  return { skipped: false };
}

export async function listTasksByCategory(categoryId: string) {
  const { data, error } = await supabase
    .from("chore_tasks")
    .select("id, name, points, category_id, created_at")
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function createCategory(
  familyId: string,
  name: string,
  icon: string | null
) {
  const { data, error } = await supabase
    .from("categories")
    .insert({
      family_id: familyId,
      name,
      icon,
    })
    .select("id, name, icon")
    .single();
  if (error) throw error;
  return data as Category;
}

export async function updateCategory(
  categoryId: string,
  name: string,
  icon: string | null
) {
  const { data, error } = await supabase
    .from("categories")
    .update({ name, icon })
    .eq("id", categoryId)
    .select("id, name, icon")
    .single();
  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(categoryId: string) {
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) throw error;
}

export async function createTask(
  familyId: string,
  categoryId: string,
  name: string,
  points: number
) {
  const { data, error } = await supabase
    .from("chore_tasks")
    .insert({
      family_id: familyId,
      category_id: categoryId,
      name,
      points,
    })
    .select("id, name, points, category_id, created_at")
    .single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(taskId: string, name: string, points: number) {
  const { data, error } = await supabase
    .from("chore_tasks")
    .update({ name, points })
    .eq("id", taskId)
    .select("id, name, points, category_id, created_at")
    .single();
  if (error) throw error;
  return data as Task;
}

export async function deleteTask(taskId: string) {
  const { error } = await supabase.from("chore_tasks").delete().eq("id", taskId);
  if (error) throw error;
}

export async function recordCompletion(taskId: string, points: number, familyId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("not authenticated");
  const { error } = await supabase.from("chore_completions").insert({
    task_id: taskId,
    user_id: user.id,
    family_id: familyId,
    points,
  });
  if (error) throw error;
}

export async function listRecentCompletions(userId: string, limit = 5) {
  const { data, error } = await supabase
    .from("chore_completions")
    .select("id, points, completed_at, chore_tasks(name)")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as {
    id: string;
    points: number;
    completed_at: string;
    chore_tasks: { name: string }[] | null;
  }[];
}

export async function deleteCompletion(completionId: string) {
  const { error } = await supabase
    .from("chore_completions")
    .delete()
    .eq("id", completionId);
  if (error) throw error;
}

export async function listTaskLastCompletions(userId: string, taskIds: string[]) {
  if (taskIds.length === 0) return new Map<string, string>();
  const { data, error } = await supabase
    .from("chore_completions")
    .select("task_id, completed_at")
    .eq("user_id", userId)
    .in("task_id", taskIds);
  if (error) throw error;
  const map = new Map<string, string>();
  (data ?? []).forEach((row) => {
    const existing = map.get(row.task_id);
    if (!existing || new Date(row.completed_at) > new Date(existing)) {
      map.set(row.task_id, row.completed_at);
    }
  });
  return map;
}

export async function listRewards() {
  const { data, error } = await supabase
    .from("rewards")
    .select("id, name, cost_points")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Reward[];
}

export async function createReward(name: string, costPoints: number, familyId: string) {
  const { data, error } = await supabase
    .from("rewards")
    .insert({
      family_id: familyId,
      name,
      cost_points: costPoints,
    })
    .select("id, name, cost_points")
    .single();
  if (error) throw error;
  return data as Reward;
}

export async function deleteReward(rewardId: string) {
  const { error } = await supabase.from("rewards").delete().eq("id", rewardId);
  if (error) throw error;
}

export async function updateReward(rewardId: string, name: string, costPoints: number) {
  const { data, error } = await supabase
    .from("rewards")
    .update({ name, cost_points: costPoints })
    .eq("id", rewardId)
    .select("id, name, cost_points")
    .single();
  if (error) throw error;
  return data as Reward;
}

export async function getUserPointTotals(userId: string) {
  const { data: completions, error: completionError } = await supabase
    .from("chore_completions")
    .select("points, completed_at")
    .eq("user_id", userId);

  if (completionError) throw completionError;

  const { data: redemptions, error: redemptionError } = await supabase
    .from("reward_redemptions")
    .select("points_spent")
    .eq("user_id", userId);

  if (redemptionError) throw redemptionError;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayPoints = (completions ?? []).reduce((sum, row) => {
    const completedAt = new Date(row.completed_at);
    return completedAt >= todayStart ? sum + (row.points ?? 0) : sum;
  }, 0);

  const totalEarned = (completions ?? []).reduce(
    (sum, row) => sum + (row.points ?? 0),
    0
  );
  const totalSpent = (redemptions ?? []).reduce(
    (sum, row) => sum + (row.points_spent ?? 0),
    0
  );

  return {
    todayPoints,
    balancePoints: totalEarned - totalSpent,
  };
}

export async function listUnreadNotifications(userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, message, created_at, is_read")
    .eq("user_id", userId)
    .eq("is_read", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function markNotificationsRead(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .in("id", ids);
  if (error) throw error;
}

export async function redeemReward(
  reward: Reward,
  familyId: string,
  displayName: string
) {
  const user = await getSessionUser();
  if (!user) throw new Error("not authenticated");

  const { error: redeemError } = await supabase
    .from("reward_redemptions")
    .insert({
      reward_id: reward.id,
      user_id: user.id,
      family_id: familyId,
      points_spent: reward.cost_points,
    });
  if (redeemError) throw redeemError;

  const { data: familyUsers, error: familyUsersError } = await supabase
    .from("users")
    .select("id")
    .eq("family_id", familyId);
  if (familyUsersError) throw familyUsersError;

  const message = `${displayName}が${reward.name}をご褒美を交換しました`;

  const { error: notifyError } = await supabase.from("notifications").insert(
    (familyUsers ?? []).map((member) => ({
      family_id: familyId,
      user_id: member.id,
      message,
    }))
  );
  if (notifyError) throw notifyError;
}
