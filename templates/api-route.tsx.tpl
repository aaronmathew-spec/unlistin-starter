// app/api/{{slice}}/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  return NextResponse.json({ ok: true, route: "/api/{{slice}}" });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ received: body, route: "/api/{{slice}}" }, { status: 201 });
}
