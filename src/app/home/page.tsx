"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Contact = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

type PetState = {
  lineage: string | null;
  stage: number;
  evolutionKey: string | null;
  cardCount: number;
  nextEvolutionAt: number | null;
};

type ContactForm = {
  name: string;
  company: string;
  email: string;
  phone: string;
  title: string;
  memo: string;
};

const defaultForm: ContactForm = {
  name: "",
  company: "",
  email: "",
  phone: "",
  title: "",
  memo: "",
};

export default function HomePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("ユーザー");
  const [form, setForm] = useState<ContactForm>(defaultForm);
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pet, setPet] = useState<PetState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      setToken(session.access_token);
      setProfileName(
        (session.user.user_metadata?.display_name as string | undefined) ??
          session.user.email ??
          "ユーザー"
      );
    };

    bootstrap();
  }, [router]);

  const authHeaders = useMemo(() => {
    if (!token) return null;
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  const refreshData = async (currentHeaders: Record<string, string>) => {
    const [contactsRes, petRes] = await Promise.all([
      fetch("/api/contacts", {
        headers: currentHeaders,
      }),
      fetch("/api/pet", {
        headers: currentHeaders,
      }),
    ]);

    if (!contactsRes.ok || !petRes.ok) {
      throw new Error("データ取得に失敗しました");
    }

    const contactsJson = await contactsRes.json();
    const petJson = await petRes.json();

    setContacts((contactsJson.contacts ?? []) as Contact[]);
    setPet((petJson ?? null) as PetState | null);
  };

  useEffect(() => {
    const run = async () => {
      if (!authHeaders) return;
      setLoading(true);
      try {
        await refreshData(authHeaders);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "読み込み失敗");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [authHeaders]);

  const onCreateContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authHeaders) return;

    if (!form.name.trim()) {
      setMessage("名前は必須です");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "登録失敗" }));
        throw new Error(body.error ?? "登録失敗");
      }

      setForm(defaultForm);
      await refreshData(authHeaders);
      setMessage("名刺を登録しました。キャラが成長しました。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登録失敗");
    } finally {
      setSaving(false);
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    return [contact.name, contact.company, contact.email]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(query));
  });

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 via-emerald-50 to-cyan-50 text-slate-900">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-600">名刺っちダッシュボード</p>
            <h1 className="text-2xl font-bold">{profileName}</h1>
          </div>
          <button className="text-sm underline btn-press" onClick={logout}>
            ログアウト
          </button>
        </header>

        <section className="rounded-2xl border border-emerald-100 bg-white/90 p-5 shadow-sm">
          <h2 className="text-lg font-semibold">キャラ成長ステータス</h2>
          {pet ? (
            <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <p>系統: <span className="font-semibold">{pet.lineage ?? "未確定"}</span></p>
              <p>ステージ: <span className="font-semibold">{pet.stage}</span></p>
              <p>登録名刺数: <span className="font-semibold">{pet.cardCount}</span></p>
              <p>
                次進化: <span className="font-semibold">{pet.nextEvolutionAt ?? "最終進化済み"}</span>
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">まだ名刺が登録されていません。</p>
          )}
        </section>

        <section className="rounded-2xl border border-cyan-100 bg-white/90 p-5 shadow-sm">
          <h2 className="text-lg font-semibold">名刺を登録</h2>
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onCreateContact}>
            <input
              className="rounded-lg border border-slate-300 px-3 py-2"
              placeholder="名前 *"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2"
              placeholder="会社名"
              value={form.company}
              onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2"
              placeholder="メール"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2"
              placeholder="電話番号"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2"
              placeholder="役職"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2"
              placeholder="メモ"
              value={form.memo}
              onChange={(event) => setForm((prev) => ({ ...prev, memo: event.target.value }))}
            />
            <button
              className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-60 btn-ripple btn-press sm:col-span-2"
              type="submit"
              disabled={saving}
            >
              {saving ? "登録中..." : "名刺を登録"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-orange-100 bg-white/90 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">名刺一覧</h2>
            <input
              className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="名前・会社・メールで検索"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {loading ? (
            <p className="text-sm text-slate-600">読み込み中...</p>
          ) : filteredContacts.length === 0 ? (
            <p className="text-sm text-slate-600">一致する名刺がありません。</p>
          ) : (
            <div className="space-y-2">
              {filteredContacts.map((contact) => (
                <article key={contact.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold">{contact.name}</p>
                  <p className="text-sm text-slate-600">{contact.company ?? "会社未設定"}</p>
                  <p className="text-sm text-slate-600">{contact.email ?? "メール未設定"}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        {message && <p className="text-sm text-slate-700">{message}</p>}
      </div>
    </main>
  );
}
