"use client";

import { useQuery } from "@tanstack/react-query";
import { getFamilyMemberSummaries, getOrCreateUserProfile } from "@/lib/db";
import BackButton from "@/components/BackButton";

async function loadFamilySummaries() {
  const profile = await getOrCreateUserProfile();
  if (!profile?.family_id) {
    throw new Error("家族参加が必要です");
  }
  return getFamilyMemberSummaries(profile.family_id, 3);
}

export default function FamilyPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["family-summaries"],
    queryFn: loadFamilySummaries,
    staleTime: 60 * 1000,
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50 to-sky-50 text-slate-900">
      <div className="mx-auto w-full max-w-xl space-y-6 px-6 py-8">
        <header className="flex items-center justify-between">
          <BackButton />
          <h1 className="text-xl font-bold">家族の状況</h1>
          <div className="w-10" />
        </header>

        {error && (
          <p className="text-sm text-slate-600">
            {error instanceof Error ? error.message : "読み込み失敗"}
          </p>
        )}

        {isLoading ? (
          <p className="text-slate-600">読み込み中...</p>
        ) : !data || data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            メンバーがまだいません。
          </div>
        ) : (
          <div className="space-y-4">
            {data.map((member) => (
              <section
                key={member.user_id}
                className="rounded-2xl bg-white/90 p-5 shadow-sm border border-amber-100 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{member.display_name}</h2>
                  <div className="text-right text-sm text-slate-600">
                    <div>今日: {member.today_points} pt</div>
                    <div>保有: {member.balance_points} pt</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {member.recent.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      最近の家事がまだありません
                    </p>
                  ) : (
                    member.recent.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-rose-100 bg-white/80 p-3 text-sm"
                      >
                        <div className="font-medium">
                          {item.task_name ?? "削除済みの家事"}
                        </div>
                        <div className="text-slate-500">
                          {new Date(item.completed_at).toLocaleString()} /{" "}
                          {item.points} pt
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
