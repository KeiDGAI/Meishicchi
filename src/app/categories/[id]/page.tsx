"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  createTask,
  deleteTask,
  getCategory,
  getOrCreateUserProfile,
  listTaskLastCompletions,
  listTasksByCategory,
  recordCompletion,
  updateTask,
  type Task,
} from "@/lib/db";

export default function CategoryPage() {
  const params = useParams();
  const categoryId = params?.id as string;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("📌");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPoints, setNewPoints] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPoints, setEditPoints] = useState(0);

  const load = async () => {
    try {
      const profile = await getOrCreateUserProfile();
      if (!profile?.family_id) {
        setMessage("家族参加が必要です");
        setLoading(false);
        return;
      }
      setFamilyId(profile.family_id);
      const [category, taskList] = await Promise.all([
        getCategory(categoryId),
        listTasksByCategory(categoryId),
      ]);
      setCategoryName(category.name);
      const fallbackIcon =
        category.name === "料理"
          ? "🍳"
          : category.name === "洗濯"
          ? "🧺"
          : category.name === "掃除"
          ? "🧹"
          : category.name === "その他家事"
          ? "🧴"
          : category.name === "子守"
          ? "🍼"
          : "📌";
      setCategoryIcon(category.icon ?? fallbackIcon);

      const lastMap = await listTaskLastCompletions(
        profile.id,
        taskList.map((task) => task.id)
      );

      const sorted = [...taskList].sort((a, b) => {
        const aTime = lastMap.get(a.id);
        const bTime = lastMap.get(b.id);
        if (aTime && bTime) {
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        }
        if (aTime) return -1;
        if (bTime) return 1;
        return 0;
      });

      setTasks(sorted);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "読み込み失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (categoryId) {
      load();
    }
  }, [categoryId]);

  const handleComplete = async (task: Task) => {
    try {
      setMessage(null);
      if (!familyId) {
        setMessage("家族参加が必要です");
        return;
      }
      await recordCompletion(task.id, task.points, familyId);
      setMessage(`${task.name} を登録しました`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登録に失敗");
    }
  };

  const handleCreate = async () => {
    if (!familyId) return;
    if (!newName.trim() || newPoints <= 0) {
      setMessage("名称とポイントを入力してください");
      return;
    }
    try {
      setMessage(null);
      await createTask(familyId, categoryId, newName.trim(), newPoints);
      setNewName("");
      setNewPoints(0);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "追加に失敗");
    }
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditName(task.name);
    setEditPoints(task.points);
  };

  const handleUpdate = async (taskId: string) => {
    if (!editName.trim() || editPoints <= 0) {
      setMessage("名称とポイントを入力してください");
      return;
    }
    try {
      setMessage(null);
      await updateTask(taskId, editName.trim(), editPoints);
      setEditingId(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新に失敗");
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      setMessage(null);
      await deleteTask(taskId);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "削除に失敗");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50 to-sky-50 text-slate-900">
      <div className="mx-auto w-full max-w-xl space-y-6 px-6 py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{categoryIcon}</span>
            <h1 className="text-xl font-bold">{categoryName}</h1>
          </div>
          <Link className="text-sm underline" href="/home">
            ホームへ
          </Link>
        </header>
        {message && <p className="text-sm text-slate-600">{message}</p>}

        <section className="rounded-2xl bg-white/90 p-5 shadow-sm border border-amber-100 space-y-3">
          <h2 className="text-lg font-semibold">家事項目を追加</h2>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="名称"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            type="number"
            min={0}
            placeholder="ポイント"
            value={newPoints || ""}
            onChange={(event) => setNewPoints(Number(event.target.value))}
          />
          <button
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white"
            onClick={handleCreate}
          >
            追加する
          </button>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">家事項目</h2>
          {loading ? (
            <p className="text-slate-600">読み込み中...</p>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              タスクがまだありません。
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-xl bg-white/90 p-4 shadow-sm border border-rose-100">
                  {editingId === task.id ? (
                    <div className="space-y-3">
                      <input
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                      />
                      <input
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        type="number"
                        min={0}
                        value={editPoints || ""}
                        onChange={(event) => setEditPoints(Number(event.target.value))}
                      />
                      <div className="flex gap-2">
                        <button
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                          onClick={() => handleUpdate(task.id)}
                        >
                          保存
                        </button>
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          onClick={() => setEditingId(null)}
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{task.name}</p>
                        <p className="text-sm text-slate-500">{task.points} pt</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                          onClick={() => handleComplete(task)}
                        >
                          完了
                        </button>
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          onClick={() => startEdit(task)}
                        >
                          編集
                        </button>
                        <button
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
                          onClick={() => handleDelete(task.id)}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
