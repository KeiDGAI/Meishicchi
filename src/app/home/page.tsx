"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFamily,
  deleteCompletion,
  getFamily,
  getOrCreateUserProfile,
  getTasksByIds,
  listCategories,
  listFamilies,
  listRecentCompletions,
  listUnreadNotifications,
  markNotificationsRead,
  seedInitialData,
  updateUserFamily,
  getUserPointTotals,
  type Category,
  type Notification,
  type RecentCompletion,
  type UserProfile,
} from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";

type HomeData = {
  authenticated: boolean;
  profile: UserProfile | null;
  familyInvite: string | null;
  families: { id: string; name: string | null; invite_code: string }[];
  categories: Category[];
  recent: (RecentCompletion & { task_name?: string })[];
  todayPoints: number;
  balancePoints: number;
  notifications: Notification[];
};

const iconFallbackMap: Record<string, string> = {
  料理: "🍳",
  洗濯: "🧺",
  掃除: "🧹",
  その他家事: "🧴",
  子守: "🍼",
};

async function loadHomeData(): Promise<HomeData> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const userProfile = await getOrCreateUserProfile();
  if (!userProfile) {
    return {
      authenticated: false,
      profile: null,
      familyInvite: null,
      families: [],
      categories: [],
      recent: [],
      todayPoints: 0,
      balancePoints: 0,
      notifications: [],
    };
  }

  if (!userProfile.family_id) {
    const families = await listFamilies();
    return {
      authenticated: true,
      profile: userProfile,
      familyInvite: null,
      families,
      categories: [],
      recent: [],
      todayPoints: 0,
      balancePoints: 0,
      notifications: [],
    };
  }

  const [family, categories, recentRaw, totals, notifications] = await Promise.all([
    getFamily(userProfile.family_id),
    listCategories(),
    listRecentCompletions(userProfile.id, 5),
    getUserPointTotals(userProfile.id, timeZone),
    listUnreadNotifications(userProfile.id),
  ]);

  const tasks = await getTasksByIds(recentRaw.map((item) => item.task_id));
  const taskMap = new Map(tasks.map((task) => [task.id, task.name]));

  return {
    authenticated: true,
    profile: userProfile,
    familyInvite: family.invite_code,
    families: [],
    categories,
    recent: recentRaw.map((item) => ({
      ...item,
      task_name: taskMap.get(item.task_id),
    })),
    todayPoints: totals.todayPoints,
    balancePoints: totals.balancePoints,
    notifications,
  };
}

export default function HomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [familyName, setFamilyName] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const homeQuery = useQuery({
    queryKey: ["home-data"],
    queryFn: loadHomeData,
    staleTime: 60 * 1000,
    refetchOnMount: "always",
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (homeQuery.data && !homeQuery.data.authenticated) {
      router.push("/login");
    }
  }, [homeQuery.data, router]);

  useEffect(() => {
    const markRead = async () => {
      if (!homeQuery.data?.profile?.id) return;
      if (homeQuery.data.notifications.length === 0) return;
      try {
        await markNotificationsRead(homeQuery.data.notifications.map((n) => n.id));
      } catch {
        return;
      }
    };
    markRead();
  }, [homeQuery.data]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["home-data"] });
  };

  const handleCreateFamily = async () => {
    const profile = homeQuery.data?.profile;
    if (!profile) return;
    setActionError(null);
    try {
      const family = await createFamily(familyName || null);
      await updateUserFamily(profile.id, family.id);
      setFamilyName("");
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "作成に失敗");
    }
  };

  const handleJoinFamily = async (familyId: string) => {
    const profile = homeQuery.data?.profile;
    if (!profile) return;
    setActionError(null);
    try {
      await updateUserFamily(profile.id, familyId);
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "参加に失敗");
    }
  };

  if (homeQuery.isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50 to-sky-50 text-slate-900">
        <div className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-6">
          <p className="text-slate-600">読み込み中...</p>
        </div>
      </main>
    );
  }

  if (homeQuery.error) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50 to-sky-50 text-slate-900">
        <div className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-6">
          <p className="text-slate-600">
            {homeQuery.error instanceof Error
              ? homeQuery.error.message
              : "読み込み失敗"}
          </p>
        </div>
      </main>
    );
  }

  const data = homeQuery.data;
  if (!data?.profile) return null;

  if (!data.profile.family_id) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50 to-sky-50 text-slate-900">
        <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-6 py-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">ようこそ</p>
              <h1 className="text-2xl font-bold">家族を作成または参加</h1>
            </div>
            <button className="text-sm underline btn-press" onClick={handleLogout}>
              ログアウト
            </button>
          </div>
          {actionError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p>{actionError}</p>
            </div>
          )}
          <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold">家族を作成</h2>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="家族名（任意）"
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
            />
            <button
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white btn-ripple btn-press"
              onClick={handleCreateFamily}
            >
              作成する
            </button>
          </section>
          <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold">家族一覧から参加</h2>
            {data.families.length === 0 ? (
              <p className="text-sm text-slate-500">まだ家族が作成されていません。</p>
            ) : (
              <div className="space-y-2">
                {data.families.map((family) => (
                  <div
                    key={family.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <span className="text-sm">{family.name ?? "家族"}</span>
                    <button
                      className="rounded-lg border border-slate-300 px-3 py-1 text-sm btn-ripple btn-press"
                      onClick={() => handleJoinFamily(family.id)}
                    >
                      参加
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50 to-sky-50 text-slate-900">
      <div className="mx-auto w-full max-w-xl space-y-6 px-6 py-8">
        <header className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-slate-500">おかえりなさい</p>
            <h1 className="text-2xl font-bold">{data.profile.display_name}</h1>
            {data.familyInvite && (
              <p className="text-xs text-slate-500">
                招待コード: <span className="font-semibold">{data.familyInvite}</span>
              </p>
            )}
          </div>
          <button className="text-sm underline btn-press" onClick={handleLogout}>
            ログアウト
          </button>
        </header>

        {data.notifications.length > 0 && (
          <section className="rounded-2xl bg-amber-50 p-4 text-amber-900">
            <p className="text-sm font-semibold">未読通知</p>
            <ul className="mt-2 space-y-2 text-sm">
              {data.notifications.map((item) => (
                <li key={item.id}>{item.message}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-2xl bg-white/90 p-5 shadow-sm border border-amber-100">
          <p className="text-sm text-slate-500">今日のポイント</p>
          <p className="text-3xl font-bold">{data.todayPoints} pt</p>
        </section>

        <section className="rounded-2xl bg-white/90 p-5 shadow-sm border border-sky-100">
          <p className="text-sm text-slate-500">累計保有ポイント</p>
          <p className="text-3xl font-bold">{data.balancePoints} pt</p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">家事カテゴリ</h2>
            <div className="flex items-center gap-3 text-sm">
              <Link className="underline" href="/family">
                家族の状況
              </Link>
              <Link className="underline" href="/categories/manage">
                カテゴリ管理
              </Link>
              <Link className="underline" href="/rewards">
                ご褒美管理へ
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {data.categories.map((category) => (
              <button
                key={category.id}
                className="rounded-xl bg-white/90 px-4 py-3 text-left shadow-sm border border-rose-100 btn-ripple btn-press"
                onClick={() => router.push(`/categories/${category.id}`)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">
                    {category.icon ?? iconFallbackMap[category.name] ?? "📌"}
                  </span>
                  <span>{category.name}</span>
                </div>
              </button>
            ))}
            {data.categories.length === 0 && (
              <div className="col-span-2 rounded-xl border border-dashed border-slate-300 bg-white/80 p-4 text-sm text-slate-600">
                <p className="font-medium">カテゴリがまだありません。</p>
                <p>初期データを投入するとすぐに使い始められます。</p>
                <button
                  className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-white disabled:opacity-60 btn-ripple btn-press"
                  onClick={async () => {
                    if (!data.profile?.family_id) return;
                    setSeeding(true);
                    setActionError(null);
                    try {
                      await seedInitialData(data.profile.family_id);
                      await refresh();
                    } catch (error) {
                      setActionError(
                        error instanceof Error ? error.message : "投入に失敗"
                      );
                    } finally {
                      setSeeding(false);
                    }
                  }}
                  disabled={seeding}
                >
                  {seeding ? "投入中..." : "初期データを投入"}
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">直近の家事（自分）</h2>
          <div className="space-y-2">
            {data.recent.length === 0 ? (
              <div className="rounded-xl bg-white/90 p-4 shadow-sm">
                <p className="font-medium">家事履歴がまだありません</p>
                <p className="text-sm text-slate-500">
                  カテゴリから家事を登録しましょう
                </p>
              </div>
            ) : (
              data.recent.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-white/90 p-4 shadow-sm border border-amber-100"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {item.task_name ?? "削除済みの家事"}
                      </p>
                      <p className="text-sm text-slate-500">
                        {new Date(item.completed_at).toLocaleString()} /{" "}
                        {item.points} pt
                      </p>
                    </div>
                    <button
                      className="text-sm text-red-600 underline disabled:opacity-60 btn-press"
                      onClick={async () => {
                        setDeletingId(item.id);
                        setActionError(null);
                        try {
                          await deleteCompletion(item.id);
                          await refresh();
                        } catch (error) {
                          setActionError(
                            error instanceof Error ? error.message : "削除に失敗"
                          );
                        } finally {
                          setDeletingId(null);
                        }
                      }}
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? "削除中..." : "削除"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {actionError && <p className="text-sm text-red-600">{actionError}</p>}
      </div>
    </main>
  );
}
