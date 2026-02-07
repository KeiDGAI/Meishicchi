"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getOrCreateUserProfile,
  listFamilyMembers,
  listRecentCompletions,
  getUserPointTotals,
  getTasksByIds,
} from "@/lib/db";
import BackButton from "@/components/BackButton";

type RecentCompletion = {
  id: string;
  points: number;
  completed_at: string;
  task_id: string;
  task_name?: string;
};

type MemberSummary = {
  id: string;
  name: string;
  todayPoints: number;
  balancePoints: number;
  recent: RecentCompletion[];
};

export default function FamilyPage() {
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await getOrCreateUserProfile();
        if (!profile?.family_id) {
          setMessage("家族参加が必要です");
          setLoading(false);
          return;
        }

        const familyMembers = await listFamilyMembers(profile.family_id);
        const summaries = await Promise.all(
          familyMembers.map(async (member) => {
            const [totals, recent] = await Promise.all([
              getUserPointTotals(member.id),
              listRecentCompletions(member.id, 3),
            ]);
            return {
              id: member.id,
              name: member.display_name,
              todayPoints: totals.todayPoints,
              balancePoints: totals.balancePoints,
              recent,
            };
          })
        );

        const allTaskIds = summaries.flatMap((summary) =>
          summary.recent.map((item) => item.task_id)
        );
        const tasks = await getTasksByIds(allTaskIds);
        const taskMap = new Map(tasks.map((task) => [task.id, task.name]));

        const withNames = summaries.map((summary) => ({
          ...summary,
          recent: summary.recent.map((item) => ({
            ...item,
            task_name: taskMap.get(item.task_id),
          })),
        }));

        setMembers(withNames);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "読み込み失敗");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50 to-sky-50 text-slate-900">
      <div className="mx-auto w-full max-w-xl space-y-6 px-6 py-8">
        <header className="flex items-center justify-between">
          <BackButton />
          <h1 className="text-xl font-bold">家族の状況</h1>
          <div className="w-10" />
        </header>

        {message && <p className="text-sm text-slate-600">{message}</p>}

        {loading ? (
          <p className="text-slate-600">読み込み中...</p>
        ) : members.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            メンバーがまだいません。
          </div>
        ) : (
          <div className="space-y-4">
            {members.map((member) => (
              <section
                key={member.id}
                className="rounded-2xl bg-white/90 p-5 shadow-sm border border-amber-100 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{member.name}</h2>
                  <div className="text-right text-sm text-slate-600">
                    <div>今日: {member.todayPoints} pt</div>
                    <div>保有: {member.balancePoints} pt</div>
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
