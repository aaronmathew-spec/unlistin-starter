// app/api/ai/search/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Response shape the AI page expects */
type SemanticHit = {
  kind: "request" | "file";
  ref_id: number;
  content: string;
  score: number;
};

type RequestBody = {
  query?: string;
  limit?: number;
  kinds?: Array<"request" | "file">;
};

export async function POST(req: Request) {
  let body: RequestBody = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    // ignore bad/empty JSON
  }

  const query = (body.query ?? "").toString().trim();
  const limit =
    typeof body.limit === "number" && body.limit > 0 && body.limit <= 50
      ? Math.floor(body.limit)
      : 10;

  const kinds =
    Array.isArray(body.kinds) && body.kinds.length
      ? (body.kinds.filter((k): k is "request" | "file" => k === "request" || k === "file"))
      : (["request", "file"] as const);

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  // -----------------------------
  // TEMP: demo results to keep builds green until pgvector wiring is enabled.
  // Using `satisfies` + `as const` so literal types don't widen to `string`.
  // -----------------------------
  const demoReadonly = [
    {
      kind: "request",
      ref_id: 123,
      content: `Demo semantic explanation for "${query}" found in a request.`,
      score: 0.92,
    },
    {
      kind: "file",
      ref_id: 456,
      content: `Demo semantic snippet for "${query}" found in a file.`,
      score: 0.87,
    },
  ] as const satisfies ReadonlyArray<SemanticHit>;

  // materialize to a mutable array typed as SemanticHit[]
  const demo: SemanticHit[] = demoReadonly.map((x) => ({ ...x }));

  const matches = demo.filter((m) => kinds.includes(m.kind)).slice(0, limit);

  return NextResponse.json({ matches });
}

export async function GET() {
  return NextResponse.json(
    { error: "Use POST with JSON body: { query, limit?, kinds? }" },
    { status: 405 }
  );
}
