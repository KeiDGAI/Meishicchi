"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createReward,
  deleteReward,
  getOrCreateUserProfile,
  getUserPointTotals,
  listRewards,
  listRewardRedemptions,
  redeemReward,
  updateReward,
  type Reward,
  type RewardRedemption,
} from "@/lib/db";
import BackButton from "@/components/BackButton";

export default function RewardsPage() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [balancePoints, setBalancePoints] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [name, setName] = useState("");
  const [costPoints, setCostPoints] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCost, setEditCost] = useState(0);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [redemptionCursor, setRedemptionCursor] = useState<string | null>(null);
  const [hasMoreRedemptions, setHasMoreRedemptions] = useState(false);

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
      const [rewardList, totals, redemptionList] = await Promise.all([
        listRewards(),
        getUserPointTotals(profile.id),
        listRewardRedemptions(profile.id, 10),
      ]);
      setRewards(rewardList);
      setBalancePoints(totals.balancePoints);
      setRedemptions(redemptionList);
      setHasMoreRedemptions(redemptionList.length === 10);
      setRedemptionCursor(
        redemptionList.length > 0
          ? redemptionList[redemptionList.length - 1].redeemed_at
          : null
      );
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
    if (!familyId || !profileId) return;
    if (balancePoints < reward.cost_points) {
      setMessage("ポイントが不足しています");
      return;
    }
    try {
      setMessage(null);
      const comment = comments[reward.id]?.trim() || null;
      await redeemReward(reward, familyId, comment);
      setComments((prev) => ({ ...prev, [reward.id]: "" }));
      setBalancePoints((prev) => prev - reward.cost_points);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "交換に失敗");
    }
  };

  const handleLoadMoreRedemptions = async () => {
    if (!profileId || !redemptionCursor) return;
    try {
      const next = await listRewardRedemptions(profileId, 10, redemptionCursor);
      setRedemptions((prev) => [...prev, ...next]);
      setHasMoreRedemptions(next.length === 10);
      setRedemptionCursor(
        next.length > 0 ? next[next.length - 1].redeemed_at : null
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "履歴取得に失敗");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50 to-sky-50 text-slate-900">
      <div className="mx-auto w-full max-w-xl space-y-6 px-6 py-8">
        <header className="flex items-center justify-between">
          <BackButton />
          <div className="text-center">
            <h1 className="text-xl font-bold">ご褒美管理</h1>
            <p className="text-sm text-slate-500">保有ポイント: {balancePoints} pt</p>
          </div>
          <div className="w-10" />
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
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white btn-ripple btn-press"
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
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white btn-ripple btn-press"
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
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm btn-ripple btn-press"
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
                      <div className="flex flex-col items-end gap-2">
                        <textarea
                          className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                          placeholder="交換コメント"
                          value={comments[reward.id] ?? ""}
                          onChange={(event) =>
                            setComments((prev) => ({
                              ...prev,
                              [reward.id]: event.target.value,
                            }))
                          }
                          rows={2}
                        />
                        <button
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white btn-ripple btn-press"
                          onClick={() => handleRedeem(reward)}
                        >
                          交換
                        </button>
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm btn-ripple btn-press"
                          onClick={() => {
                            setEditingId(reward.id);
                            setEditName(reward.name);
                            setEditCost(reward.cost_points);
                          }}
                        >
                          編集
                        </button>
                        <button
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 btn-ripple btn-press"
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

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">ご褒美の履歴</h2>
          {redemptions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              交換履歴がまだありません。
            </div>
          ) : (
            <div className="space-y-2">
              {redemptions.map((item) => (
                <div key={item.id} className="rounded-xl bg-white/90 p-4 shadow-sm border border-amber-100">
                  <p className="font-medium">
                    {item.rewards?.[0]?.name ?? "ご褒美"} / {item.points_spent} pt
                  </p>
                  <p className="text-sm text-slate-500">
                    {new Date(item.redeemed_at).toLocaleString()}
                  </p>
                  {item.comment && (
                    <p className="mt-1 text-sm text-slate-700">
                      コメント: {item.comment}
                    </p>
                  )}
                </div>
              ))}
              {hasMoreRedemptions && (
                <button
                  className="w-full rounded-lg border border-slate-300 bg-white/80 px-4 py-2 text-sm btn-ripple btn-press"
                  onClick={handleLoadMoreRedemptions}
                >
                  もっと見る
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
