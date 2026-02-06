"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getOrCreateUserProfile,
  listTasksByCategory,
  recordCompletion,
  type Task,
} from "@/lib/db";

export default function CategoryPage() {
  const params = useParams();
  const categoryId = params?.id as string;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        await getOrCreateUserProfile();
        const taskList = await listTasksByCategory(categoryId);
        setTasks(taskList);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "読み込み失敗");
      } finally {
        setLoading(false);
      }
    };

    if (categoryId) {
      load();
    }
  }, [categoryId]);

  const handleComplete = async (task: Task) => {
    try {
      setMessage(null);
      const profile = await getOrCreateUserProfile();
      if (!profile?.family_id) {
        setMessage("家族参加が必要です");
        return;
      }
      await recordCompletion(task.id, task.points, profile.family_id);
      setMessage(`${task.name} を登録しました`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登録に失敗");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-xl space-y-6 px-6 py-8">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold">カテゴリの家事</h1>
          <Link className="text-sm underline" href="/home">
            ホームへ
          </Link>
        </header>
        {message && <p className="text-sm text-slate-600">{message}</p>}
        {loading ? (
          <p className="text-slate-600">読み込み中...</p>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{task.name}</p>
                    <p className="text-sm text-slate-500">{task.points} pt</p>
                  </div>
                  <button
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                    onClick={() => handleComplete(task)}
                  >
                    完了
                  </button>
                </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                タスクがまだありません。
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
