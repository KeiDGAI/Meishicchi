"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createReward,
  deleteReward,
  getOrCreateUserProfile,
  getUserPointTotals,
  listRewards,
  redeemReward,
  updateReward,
  type Reward,
} from "@/lib/db";

export default function RewardsPage() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [balancePoints, setBalancePoints] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [name, setName] = useState("");
  const [costPoints, setCostPoints] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCost, setEditCost] = useState(0);

  const load = async () => {
    try {
      const profile = await getOrCreateUserProfile();
      if (!profile?.family_id) {
        setMessage("家族参加が必要です");
        setLoading(false);
        return;
      }
      setProfileId(profile.id);
      setFamilyId(profile.family_id);
      setDisplayName(profile.display_name);
      const [rewardList, totals] = await Promise.all([
        listRewards(),
        getUserPointTotals(profile.id),
      ]);
      setRewards(rewardList);
      setBalancePoints(totals.balancePoints);
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
    if (!name.trim() || costPoints <= 0) {
      setMessage("名前と必要ポイントを入力してください");
      return;
    }
    try {
      setMessage(null);
      await createReward(name.trim(), costPoints, familyId);
      setName("");
      setCostPoints(0);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "作成に失敗");
    }
  };

  const handleDelete = async (rewardId: string) => {
    try {
      await deleteReward(rewardId);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "削除に失敗");
    }
  };

  const handleRedeem = async (reward: Reward) => {
    if (!familyId || !profileId || !displayName) return;
    if (balancePoints < reward.cost_points) {
      setMessage("ポイントが不足しています");
      return;
    }
    try {
      setMessage(null);
      await redeemReward(reward, familyId, displayName);
      setBalancePoints((prev) => prev - reward.cost_points);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "交換に失敗");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50 to-sky-50 text-slate-900">
      <div className="mx-auto w-full max-w-xl space-y-6 px-6 py-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">ご褒美管理</h1>
            <p className="text-sm text-slate-500">保有ポイント: {balancePoints} pt</p>
          </div>
          <Link className="text-sm underline" href="/home">
            ホームへ
          </Link>
        </header>

        {message && <p className="text-sm text-slate-600">{message}</p>}

        <section className="rounded-2xl bg-white/90 p-5 shadow-sm border border-amber-100 space-y-3">
          <h2 className="text-lg font-semibold">ご褒美を追加</h2>
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="名前"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            type="number"
            min={0}
            placeholder="必要ポイント"
            value={costPoints || ""}
            onChange={(event) => setCostPoints(Number(event.target.value))}
          />
          <button
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white"
            onClick={handleCreate}
            disabled={loading}
          >
            追加する
          </button>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">ご褒美一覧</h2>
          {loading ? (
            <p className="text-slate-600">読み込み中...</p>
          ) : rewards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              ご褒美がまだありません。
            </div>
          ) : (
            <div className="space-y-3">
              {rewards.map((reward) => (
                <div key={reward.id} className="rounded-xl bg-white/90 p-4 shadow-sm border border-rose-100">
                  {editingId === reward.id ? (
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
                        value={editCost || ""}
                        onChange={(event) => setEditCost(Number(event.target.value))}
                      />
                      <div className="flex gap-2">
                        <button
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                          onClick={async () => {
                            if (!editName.trim() || editCost <= 0) {
                              setMessage("名称と必要ポイントを入力してください");
                              return;
                            }
                            try {
                              setMessage(null);
                              await updateReward(reward.id, editName.trim(), editCost);
                              setEditingId(null);
                              await load();
                            } catch (error) {
                              setMessage(
                                error instanceof Error ? error.message : "更新に失敗"
                              );
                            }
                          }}
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
                        <p className="font-medium">{reward.name}</p>
                        <p className="text-sm text-slate-500">
                          {reward.cost_points} pt
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                          onClick={() => handleRedeem(reward)}
                        >
                          交換
                        </button>
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          onClick={() => {
                            setEditingId(reward.id);
                            setEditName(reward.name);
                            setEditCost(reward.cost_points);
                          }}
                        >
                          編集
                        </button>
                        <button
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600"
                          onClick={() => handleDelete(reward.id)}
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
