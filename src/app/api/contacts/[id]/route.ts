import { NextRequest, NextResponse } from "next/server";
import { getAuthedSupabase } from "@/lib/serverAuth";

type UpdateContactPayload = {
  name?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  memo?: string | null;
};

function normalizeOptionalText(input: unknown) {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthedSupabase(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await context.params;

  let body: UpdateContactPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, string | null> = {};
  const name = normalizeOptionalText(body.name);
  if (name !== undefined) {
    if (!name) {
      return NextResponse.json(
        { error: "name cannot be empty when provided" },
        { status: 400 }
      );
    }
    patch.name = name;
  }

  const company = normalizeOptionalText(body.company);
  if (company !== undefined) patch.company = company;
  const email = normalizeOptionalText(body.email);
  if (email !== undefined) patch.email = email;
  const phone = normalizeOptionalText(body.phone);
  if (phone !== undefined) patch.phone = phone;
  const title = normalizeOptionalText(body.title);
  if (title !== undefined) patch.title = title;
  const memo = normalizeOptionalText(body.memo);
  if (memo !== undefined) patch.memo = memo;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("business_cards")
    .update(patch)
    .eq("id", id)
    .eq("owner_user_id", auth.user.id)
    .select(
      "id, owner_user_id, name, company, email, phone, title, memo, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  return NextResponse.json({ contact: data });
}
