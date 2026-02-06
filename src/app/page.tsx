import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50 to-sky-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-8 px-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            家族向け家事ポイント
          </p>
          <h1 className="text-3xl font-bold">家事を楽に、見える化。</h1>
          <p className="text-slate-600">
            最小操作で家事を記録し、ポイントでご褒美交換まで。
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            className="rounded-xl bg-slate-900 px-4 py-3 text-center text-white"
            href="/login"
          >
            ログイン
          </Link>
          <Link
            className="rounded-xl border border-slate-300 bg-white/80 px-4 py-3 text-center"
            href="/signup"
          >
            新規登録
          </Link>
        </div>
      </div>
    </main>
  );
}
