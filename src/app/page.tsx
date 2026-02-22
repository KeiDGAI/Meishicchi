import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 via-emerald-50 to-cyan-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-8 px-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
            Meishicchi PWA
          </p>
          <h1 className="text-4xl font-bold leading-tight">名刺管理で育つ、名刺っち。</h1>
          <p className="text-slate-700">
            名刺を登録するたびにキャラが進化。名刺検索と育成を一つにしたPWAです。
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            className="rounded-xl bg-teal-700 px-4 py-3 text-center text-white btn-ripple btn-press"
            href="/login"
          >
            ログイン
          </Link>
          <Link
            className="rounded-xl border border-teal-700/20 bg-white/90 px-4 py-3 text-center text-teal-900 btn-ripple btn-press"
            href="/signup"
          >
            新規登録
          </Link>
        </div>
      </div>
    </main>
  );
}
