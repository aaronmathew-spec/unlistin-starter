// app/api/requests/[id]/comments/[commentId]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; commentId: string } }
) {
  const requestId = Number(params.id);
  const commentId = Number(params.commentId);
  if (!Number.isFinite(requestId) || !Number.isFinite(commentId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  // RLS ensures: only owner & author can delete (via policies)
  const { error } = await supabase
    .from("request_comments")
    .delete()
    .eq("id", commentId)
    .eq("request_id", requestId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
