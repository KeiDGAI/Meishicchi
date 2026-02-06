"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type SessionUser = {
  id: string;
  email: string | null;
  displayName: string | null;
};

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user;
      if (!sessionUser) {
        router.push("/login");
        return;
      }
      setUser({
        id: sessionUser.id,
        email: sessionUser.email ?? null,
        displayName: (sessionUser.user_metadata?.display_name as string) ?? null,
      });
    };

    fetchSession();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-6">
          <p className="text-slate-600">読み込み中...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-xl px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">おかえりなさい</p>
            <h1 className="text-2xl font-bold">
              {user.displayName ?? user.email ?? "ユーザー"}
            </h1>
          </div>
          <button
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            onClick={handleLogout}
          >
            ログアウト
          </button>
        </div>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">今日のポイント</p>
          <p className="text-3xl font-bold">0 pt</p>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">累計保有ポイント</p>
          <p className="text-3xl font-bold">0 pt</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">家事カテゴリ</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              "料理",
              "洗濯",
              "掃除",
              "その他家事",
              "子守",
            ].map((label) => (
              <button
                key={label}
                className="rounded-xl bg-white px-4 py-3 text-left shadow-sm"
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">直近の家事（自分）</h2>
          <div className="space-y-2">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="font-medium">家事履歴がまだありません</p>
              <p className="text-sm text-slate-500">
                カテゴリから家事を登録しましょう
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
