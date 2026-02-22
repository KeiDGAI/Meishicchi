import { NextRequest, NextResponse } from "next/server";
import { nextEvolutionAt } from "@/lib/petEvolution";
import { getAuthedSupabase } from "@/lib/serverAuth";

export async function GET(request: NextRequest) {
  const auth = await getAuthedSupabase(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { data, error } = await auth.supabase
    .from("pet_stats")
    .select("lineage, stage, evolution_key, card_count")
    .eq("owner_user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stage = Number(data?.stage ?? 0);
  return NextResponse.json({
    lineage: data?.lineage ?? null,
    stage,
    evolutionKey: data?.evolution_key ?? null,
    cardCount: Number(data?.card_count ?? 0),
    nextEvolutionAt: nextEvolutionAt(stage),
  });
}
