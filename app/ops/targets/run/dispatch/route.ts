export const runtime = "nodejs";

/**
 * GET /ops/targets/run/dispatch?subject=...&keys=a,b,c&region=IN
 *
 * Server-rendered response (HTML) that:
 *  - Reads query params from the Ops form
 *  - Calls the secure-cron dispatch API: POST /api/ops/targets/dispatch
 *    with header x-secure-cron: SECURE_CRON_SECRET
 *  - Renders a simple HTML table with totals and per-controller results
 *
 * This keeps all logic server-only and behind your Ops middleware gate.
 */

import { required } from "@/lib/env";

function html(body: string, init?: ResponseInit) {
  return new Response(body, {
    ...init,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

type DispatchResultItem = {
  key: string;
  name?: string | null;
  status: "queued" | "sent" | "skipped" | "error";
  controllerId?: string | null;
  channel?: string | null;
  requestId?: string | number | null;
  message?: string | null;
  retryAfterSec?: number | null;
};

type DispatchResponse = {
  ok: boolean;
  subject?: string | null;
  results: DispatchResultItem[];
  hint?: string | null;
};

function sumByStatus(rows: DispatchResultItem[]) {
  const acc = { sent: 0, queued: 0, skipped: 0, error: 0 };
  for (const r of rows) {
    if (r.status in acc) (acc as any)[r.status] += 1;
  }
  return acc;
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pageTemplate(title: string, content: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="x-ua-compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 24px; color: #111; }
    h1 { font-size: 20px; margin-bottom: 12px; }
    .meta { color:#555; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #ddd; padding: 8px; font-size: 14px; vertical-align: top; }
    th { background: #f9fafb; text-align: left; }
    .status-sent { color: #065f46; font-weight: 600; }
    .status-queued { color: #1e40af; font-weight: 600; }
    .status-skipped { color: #92400e; font-weight: 600; }
    .status-error { color: #991b1b; font-weight: 600; }
    .totals { margin-top: 8px; font-size: 14px; color:#333; }
    .back { margin-top: 16px; display: inline-block; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
}

function getOrigin(req: Request): string {
  // Derive origin robustly when behind a proxy (Vercel)
  const h = new Headers(req.headers);
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const subject = (url.searchParams.get("subject") || "").trim();
  const keysCsv = (url.searchParams.get("keys") || "").trim();
  const region = (url.searchParams.get("region") || "").trim() || null;

  if (!subject || !keysCsv) {
    const missing = !subject ? "subject" : "keys";
    return html(
      pageTemplate("Dispatch – Missing parameters", `
        <h1>Dispatch</h1>
        <p class="meta">Missing required parameter: <strong>${missing}</strong>.</p>
        <p><a class="back" href="/ops/targets/run">← Back to planner</a></p>
      `),
      { status: 400 }
    );
  }

  const keys = keysCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const SECURE_CRON_SECRET = required("SECURE_CRON_SECRET");

  const origin = getOrigin(req);
  const dispatchUrl = `${origin}/api/ops/targets/dispatch`;

  let data: DispatchResponse = { ok: false, results: [] };

  try {
    const res = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-secure-cron": SECURE_CRON_SECRET,
      },
      body: JSON.stringify({
        subject,
        keys,
        region,
      }),
      // internal call; rely on same-site cookies if the API uses session
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Dispatch API returned ${res.status}: ${text}`);
    }

    data = (await res.json()) as DispatchResponse;
  } catch (e: any) {
    return html(
      pageTemplate("Dispatch – Error", `
        <h1>Dispatch Error</h1>
        <p class="meta">Could not execute dispatch. ${escapeHtml(e?.message ?? "Unknown error")}.</p>
        <p><a class="back" href="/ops/targets/run">← Back to planner</a></p>
      `),
      { status: 500 }
    );
  }

  const totals = sumByStatus(data.results || []);
  const rowsHtml = (data.results || [])
    .map((r) => {
      const statusClass =
        r.status === "sent" ? "status-sent" :
        r.status === "queued" ? "status-queued" :
        r.status === "skipped" ? "status-skipped" :
        "status-error";

      return `<tr>
        <td class="mono">${escapeHtml(r.key)}</td>
        <td>${escapeHtml(r.name ?? "")}</td>
        <td><span class="${statusClass}">${escapeHtml(r.status)}</span></td>
        <td>${escapeHtml(r.channel ?? "")}</td>
        <td class="mono">${escapeHtml(String(r.controllerId ?? ""))}</td>
        <td class="mono">${escapeHtml(String(r.requestId ?? ""))}</td>
        <td>${escapeHtml(r.message ?? "")}</td>
        <td>${r.retryAfterSec ? escapeHtml(r.retryAfterSec.toString()) : ""}</td>
      </tr>`;
    })
    .join("");

  const content = `
    <h1>Dispatch Results</h1>
    <div class="meta">
      <div><strong>Subject:</strong> ${escapeHtml(subject)}</div>
      ${region ? `<div><strong>Region:</strong> ${escapeHtml(region)}</div>` : ""}
      <div><strong>Keys:</strong> <span class="mono">${escapeHtml(keys.join(", "))}</span></div>
    </div>

    <div class="totals">
      <strong>Totals:</strong>
      Sent: ${totals.sent} &nbsp;|&nbsp;
      Queued: ${totals.queued} &nbsp;|&nbsp;
      Skipped: ${totals.skipped} &nbsp;|&nbsp;
      Errors: ${totals.error}
    </div>

    <table>
      <thead>
        <tr>
          <th>Key</th>
          <th>Name</th>
          <th>Status</th>
          <th>Channel</th>
          <th>Controller ID</th>
          <th>Request ID</th>
          <th>Message</th>
          <th>Retry (s)</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="8">No results.</td></tr>`}
      </tbody>
    </table>

    <p class="back"><a href="/ops/targets/run">← Back to planner</a></p>
  `;

  return html(pageTemplate("Dispatch Results", content), { status: 200 });
}
