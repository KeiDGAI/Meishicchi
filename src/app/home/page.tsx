"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getOrCreateUserProfile,
  getFamily,
  listCategories,
  listRecentCompletions,
  getUserPointTotals,
  listUnreadNotifications,
  markNotificationsRead,
  createFamily,
  updateUserFamily,
  seedInitialData,
  deleteCompletion,
  getTasksByIds,
  listFamilies,
  type Category,
  type Notification,
  type UserProfile,
} from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";

type RecentCompletion = {
  id: string;
  points: number;
  completed_at: string;
  task_id: string;
  task_name?: string;
};

const iconFallbackMap: Record<string, string> = {
  料理: "🍳",
  洗濯: "🧺",
  掃除: "🧹",
  その他家事: "🧴",
  子守: "🍼",
};

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [families, setFamilies] = useState<
    { id: string; name: string | null; invite_code: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recent, setRecent] = useState<RecentCompletion[]>([]);
  const [todayPoints, setTodayPoints] = useState(0);
  const [balancePoints, setBalancePoints] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [familyInvite, setFamilyInvite] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    const load = async () => {
      try {
        const userProfile = await getOrCreateUserProfile();
        if (!userProfile) {
          router.push("/login");
          return;
        }
        setProfile(userProfile);

        if (!userProfile.family_id) {
          const familyList = await listFamilies();
          setFamilies(familyList);
          setLoading(false);
          return;
        }

        const [family, categoryList, recentList, totals, unread] =
          await Promise.all([
            getFamily(userProfile.family_id),
            listCategories(),
            listRecentCompletions(userProfile.id),
            getUserPointTotals(userProfile.id),
            listUnreadNotifications(userProfile.id),
          ]);

        setFamilyInvite(family.invite_code);
        setCategories(categoryList);
        const taskIds = recentList.map((item) => item.task_id);
        const tasks = await getTasksByIds(taskIds);
        const taskMap = new Map(tasks.map((task) => [task.id, task.name]));
        setRecent(
          recentList.map((item) => ({
            ...item,
            task_name: taskMap.get(item.task_id),
          }))
        );
        setTodayPoints(totals.todayPoints);
        setBalancePoints(totals.balancePoints);
        setNotifications(unread);

        if (unread.length > 0) {
          await markNotificationsRead(unread.map((item) => item.id));
        }
      } catch (error) {
        const message =
          typeof error === "object" && error && "message" in error
            ? String((error as { message: unknown }).message)
            : "読み込み失敗";
        setActionError(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const ensureProfile = async () => {
    if (profile) return profile;
    const userProfile = await getOrCreateUserProfile();
    if (!userProfile) {
      router.push("/login");
      return null;
    }
    setProfile(userProfile);
    return userProfile;
  };

  const handleCreateFamily = async () => {
    const currentProfile = await ensureProfile();
    if (!currentProfile) return;
    setActionError(null);
    try {
      const family = await createFamily(familyName || null);
      await updateUserFamily(currentProfile.id, family.id);
      setProfile({ ...currentProfile, family_id: family.id });
      setFamilyInvite(family.invite_code);
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : "作成に失敗";
      setActionError(message);
    }
  };

  const handleJoinFamily = async (familyId: string, inviteCode: string) => {
    const currentProfile = await ensureProfile();
    if (!currentProfile) return;
    setActionError(null);
    try {
      await updateUserFamily(currentProfile.id, familyId);
      setProfile({ ...currentProfile, family_id: familyId });
      setFamilyInvite(inviteCode);
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : "参加に失敗";
      setActionError(message);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50 to-sky-50 text-slate-900">
        <div className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-6">
          <p className="text-slate-600">読み込み中...</p>
        </div>
      </main>
    );
  }

  if (!profile?.family_id) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50 to-sky-50 text-slate-900">
        <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 px-6 py-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">ようこそ</p>
              <h1 className="text-2xl font-bold">家族を作成または参加</h1>
            </div>
            <button
              className="text-sm underline"
              onClick={handleLogout}
            >
              ログアウト
            </button>
          </div>
          {actionError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p>{actionError}</p>
              <button
                className="mt-2 underline"
                onClick={() => window.location.reload()}
              >
                再読み込み
              </button>
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
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white"
              onClick={handleCreateFamily}
            >
              作成する
            </button>
          </section>
          <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold">家族一覧から参加</h2>
            {families.length === 0 ? (
              <p className="text-sm text-slate-500">
                まだ家族が作成されていません。
              </p>
            ) : (
              <div className="space-y-2">
                {families.map((family) => (
                  <div
                    key={family.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <span className="text-sm">
                      {family.name ?? "家族"}
                    </span>
                    <button
                      className="rounded-lg border border-slate-300 px-3 py-1 text-sm"
                      onClick={() => handleJoinFamily(family.id, family.invite_code)}
                    >
                      参加
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
          <Link className="text-sm underline" href="/login">
            ログイン画面へ戻る
          </Link>
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
            <h1 className="text-2xl font-bold">{profile.display_name}</h1>
            {familyInvite && (
              <p className="text-xs text-slate-500">
                招待コード: <span className="font-semibold">{familyInvite}</span>
              </p>
            )}
          </div>
          <button className="text-sm underline" onClick={handleLogout}>
            ログアウト
          </button>
        </header>

        {notifications.length > 0 && (
          <section className="rounded-2xl bg-amber-50 p-4 text-amber-900">
            <p className="text-sm font-semibold">未読通知</p>
            <ul className="mt-2 space-y-2 text-sm">
              {notifications.map((item) => (
                <li key={item.id}>{item.message}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-2xl bg-white/90 p-5 shadow-sm border border-amber-100">
          <p className="text-sm text-slate-500">今日のポイント</p>
          <p className="text-3xl font-bold">{todayPoints} pt</p>
        </section>

        <section className="rounded-2xl bg-white/90 p-5 shadow-sm border border-sky-100">
          <p className="text-sm text-slate-500">累計保有ポイント</p>
          <p className="text-3xl font-bold">{balancePoints} pt</p>
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
            {categories.map((category) => (
              <button
                key={category.id}
                className="rounded-xl bg-white/90 px-4 py-3 text-left shadow-sm border border-rose-100"
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
            {categories.length === 0 && (
              <div className="col-span-2 rounded-xl border border-dashed border-slate-300 bg-white/80 p-4 text-sm text-slate-600">
                <p className="font-medium">カテゴリがまだありません。</p>
                <p>初期データを投入するとすぐに使い始められます。</p>
                <button
                  className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-white disabled:opacity-60"
                  onClick={async () => {
                    if (!profile?.family_id) return;
                    setSeeding(true);
                    try {
                      const result = await seedInitialData(profile.family_id);
                      if (result.skipped) {
                        setActionError("既にカテゴリが存在しています");
                      } else {
                        const categoryList = await listCategories();
                        setCategories(categoryList);
                      }
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
            {recent.length === 0 ? (
              <div className="rounded-xl bg-white/90 p-4 shadow-sm">
                <p className="font-medium">家事履歴がまだありません</p>
                <p className="text-sm text-slate-500">
                  カテゴリから家事を登録しましょう
                </p>
              </div>
            ) : (
              recent.map((item) => (
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
                      className="text-sm text-red-600 underline disabled:opacity-60"
                      onClick={async () => {
                        setDeletingId(item.id);
                        try {
                          await deleteCompletion(item.id);
                          const next = recent.filter((row) => row.id !== item.id);
                          setRecent(next);
                          if (profile?.id) {
                            const totals = await getUserPointTotals(profile.id);
                            setTodayPoints(totals.todayPoints);
                            setBalancePoints(totals.balancePoints);
                          }
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
