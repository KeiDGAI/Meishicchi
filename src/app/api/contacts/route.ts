import { NextRequest, NextResponse } from "next/server";
import { getAuthedSupabase } from "@/lib/serverAuth";

type ContactPayload = {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  memo?: string | null;
};

function normalizeText(input: unknown) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: NextRequest) {
  const auth = await getAuthedSupabase(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: ContactPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = normalizeText(body.name);
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data: contact, error: insertError } = await auth.supabase
    .from("business_cards")
    .insert({
      owner_user_id: auth.user.id,
      name,
      company: normalizeText(body.company),
      email: normalizeText(body.email),
      phone: normalizeText(body.phone),
      title: normalizeText(body.title),
      memo: normalizeText(body.memo),
    })
    .select(
      "id, owner_user_id, name, company, email, phone, title, memo, created_at, updated_at"
    )
    .single();

  if (insertError || !contact) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create contact" },
      { status: 500 }
    );
  }

  const { data: petRows, error: growthError } = await auth.supabase.rpc(
    "advance_pet_on_card_created",
    {
      card_id_input: contact.id,
    }
  );

  if (growthError) {
    return NextResponse.json(
      {
        error: growthError.message,
        contact,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      contact,
      pet: (petRows ?? [])[0] ?? null,
    },
    { status: 201 }
  );
}

export async function GET(request: NextRequest) {
  const auth = await getAuthedSupabase(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("query")?.trim() ?? "";
  const field = searchParams.get("field") ?? "all";
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "50"), 1), 100);

  let query = auth.supabase
    .from("business_cards")
    .select(
      "id, owner_user_id, name, company, email, phone, title, memo, created_at, updated_at"
    )
    .eq("owner_user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q.length > 0) {
    if (field === "name") {
      query = query.ilike("name", `%${q}%`);
    } else if (field === "company") {
      query = query.ilike("company", `%${q}%`);
    } else if (field === "email") {
      query = query.ilike("email", `%${q}%`);
    } else {
      query = query.or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`);
    }
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    contacts: data ?? [],
  });
}
