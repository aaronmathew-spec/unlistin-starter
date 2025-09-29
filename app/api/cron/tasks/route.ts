import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_BATCH = Number(process.env.TASK_RUN_BATCH ?? 5);

// Optional allowlist for http_get tool
const allowHostsEnv = (process.env.ALLOW_HTTP_GET_HOSTS ?? "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

function hostAllowed(url: string) {
  if (allowHostsEnv.length === 0) return false;
  try {
    const u = new URL(url);
    return allowHostsEnv.some(h => u.hostname.toLowerCase() === h || u.hostname.toLowerCase().endsWith(`.${h}`));
  } catch {
    return false;
  }
}

async function runTask(t: any, admin: ReturnType<typeof getSupabaseAdmin>) {
  const id = t.id as number;
  const type = (t.type as string) ?? "unknown";
  const payload = (t.payload as any) ?? {};

  // mark running
  await admin.from("background_tasks").update({ status: "running" }).eq("id", id);

  const log = async (status: "running"|"succeeded"|"failed", message: string, data: any = {}) => {
    await admin.from("background_task_events").insert({
      task_id: id, status, message, data
    });
  };

  try {
    if (type === "http_get") {
      const url = String(payload.url ?? "");
      if (!hostAllowed(url)) {
        await log("failed", "URL host not allowed", { url });
        await admin.from("background_tasks").update({ status: "failed", error: "host_not_allowed" }).eq("id", id);
        return;
      }
      const res = await fetch(url, { method: "GET", redirect: "follow", headers: payload.headers ?? {} });
      const text = await res.text();
      await log("succeeded", `Fetched ${url}`, { status: res.status, len: text.length });
      await admin.from("background_tasks").update({ status: "succeeded" }).eq("id", id);
    } else if (type === "coverage_note") {
      // placeholder "work"
      await log("succeeded", "Coverage note captured", { request_id: t.request_id ?? null });
      await admin.from("background_tasks").update({ status: "succeeded" }).eq("id", id);
    } else {
      await log("failed", `Unknown task type: ${type}`);
      await admin.from("background_tasks").update({ status: "failed", error: "unknown_task_type" }).eq("id", id);
    }
  } catch (e: any) {
    await log("failed", "Exception while running task", { error: String(e?.message ?? e) });
    await admin.from("background_tasks").update({ status: "failed", error: String(e?.message ?? e) }).eq("id", id);
  }
}

export async function GET(req: Request) {
  // Very simple cron auth
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  // pick a small batch of queued tasks
  const { data: tasks, error } = await admin
    .from("background_tasks")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const results: number[] = [];
  for (const t of tasks ?? []) {
    results.push(t.id);
    // run sequentially to keep it simple & DB-friendly
    await runTask(t, admin);
  }

  return NextResponse.json({ ran: results.length, ids: results });
}
