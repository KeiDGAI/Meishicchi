"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (!data.session) {
      setError("確認メールを開いてログインしてください。");
      return;
    }

    router.push("/home");
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50 to-sky-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6">
        <h1 className="text-2xl font-bold">新規登録</h1>
        <form onSubmit={handleSignup} className="space-y-4 rounded-2xl bg-white/90 p-5 shadow-sm border border-amber-100">
          <div className="space-y-2">
            <label className="text-sm font-medium">表示名</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">メールアドレス</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">パスワード</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-60 btn-ripple btn-press"
            type="submit"
            disabled={loading}
          >
            {loading ? "登録中..." : "登録"}
          </button>
        </form>
        <p className="text-sm text-slate-600">
          すでにアカウントをお持ちですか？{" "}
          <Link className="underline" href="/login">
            ログインへ
          </Link>
        </p>
      </div>
    </main>
  );
}
