"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createCategory,
  deleteCategory,
  getOrCreateUserProfile,
  listCategories,
  updateCategory,
  type Category,
} from "@/lib/db";
import BackButton from "@/components/BackButton";

const iconOptions = ["🍳", "🧺", "🧹", "🧴", "🍼", "🧼", "🧊", "🧽", "🪴", "📌"];
const iconFallbackMap: Record<string, string> = {
  料理: "🍳",
  洗濯: "🧺",
  掃除: "🧹",
  その他家事: "🧴",
  子守: "🍼",
};

export default function CategoryManagePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>("📌");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [familyId, setFamilyId] = useState<string | null>(null);

  const load = async () => {
    try {
      const profile = await getOrCreateUserProfile();
      if (!profile?.family_id) {
        setMessage("家族参加が必要です");
        setLoading(false);
        return;
      }
      setFamilyId(profile.family_id);
      const list = await listCategories();
      setCategories(list);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "読み込み失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!familyId) return;
    if (!name.trim()) {
      setMessage("カテゴリ名を入力してください");
      return;
    }
    try {
      setMessage(null);
      await createCategory(familyId, name.trim(), icon);
      setName("");
      setIcon("📌");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "作成に失敗");
    }
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditIcon(category.icon ?? "📌");
  };

  const handleUpdate = async (categoryId: string) => {
    if (!editName.trim()) {
      setMessage("カテゴリ名を入力してください");
      return;
    }
    try {
      setMessage(null);
      await updateCategory(categoryId, editName.trim(), editIcon);
      setEditingId(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新に失敗");
    }
  };

  const handleDelete = async (categoryId: string) => {
    try {
      setMessage(null);
      await deleteCategory(categoryId);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "削除に失敗");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50 to-sky-50 text-slate-900">
      <div className="mx-auto w-full max-w-xl space-y-6 px-6 py-8">
        <header className="flex items-center justify-between">
          <BackButton />
          <h1 className="text-xl font-bold">カテゴリ管理</h1>
          <div className="w-10" />
        </header>

        {message && <p className="text-sm text-slate-600">{message}</p>}

        <section className="rounded-2xl bg-white/90 p-5 shadow-sm border border-amber-100 space-y-3">
          <h2 className="text-lg font-semibold">カテゴリ追加</h2>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="カテゴリ名"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            {iconOptions.map((value) => (
              <button
                key={value}
                className={`rounded-lg border px-3 py-2 text-lg ${
                  icon === value ? "border-slate-900" : "border-slate-300"
                }`}
                onClick={() => setIcon(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <button
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white btn-ripple btn-press"
            onClick={handleCreate}
          >
            追加する
          </button>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">カテゴリ一覧</h2>
          {loading ? (
            <p className="text-slate-600">読み込み中...</p>
          ) : categories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              カテゴリがまだありません。
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => (
                <div key={category.id} className="rounded-xl bg-white/90 p-4 shadow-sm border border-rose-100">
                  {editingId === category.id ? (
                    <div className="space-y-3">
                      <input
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        {iconOptions.map((value) => (
                          <button
                            key={value}
                            className={`rounded-lg border px-3 py-2 text-lg ${
                              editIcon === value
                                ? "border-slate-900"
                                : "border-slate-300"
                            }`}
                            onClick={() => setEditIcon(value)}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white btn-ripple btn-press"
                          onClick={() => handleUpdate(category.id)}
                        >
                          保存
                        </button>
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm btn-ripple btn-press"
                          onClick={() => setEditingId(null)}
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">
                          {category.icon ?? iconFallbackMap[category.name] ?? "📌"}
                        </span>
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm btn-ripple btn-press"
                          onClick={() => startEdit(category)}
                        >
                          編集
                        </button>
                        <button
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 btn-ripple btn-press"
                          onClick={() => handleDelete(category.id)}
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
