// app/ops/webform/pulse/page.tsx
// Manual one-click pulse for the webform worker (runs server-to-server).
// Sends the SECURE_CRON_SECRET header, calls /api/ops/webform/worker, and renders the result.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WorkerResult =
  | {
      ok: true;
      processed: number;
      lastId: string | null;
      note?: string | null;
    }
  | {
      ok: false;
      error: string;
      processed?: number;
      lastId?: string | null;
    }
  | { ok: true; message: "no_jobs" };

function Box({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "error";
}) {
  const styles: Record<string, React.CSSProperties> = {
    neutral: {
      border: "1px solid #e5e7eb",
      background: "#fff",
      color: "#111827",
    },
    success: {
      border: "1px solid #10b981",
      background: "#ecfdf5",
      color: "#065f46",
    },
    error: {
      border: "1px solid #ef4444",
      background: "#fef2f2",
      color: "#991b1b",
    },
  };
  return (
    <div
      style={{
        ...styles[tone],
        borderRadius: 12,
        padding: 16,
      }}
    >
      {children}
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 12,
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        padding: "2px 6px",
        borderRadius: 6,
      }}
    >
      {children}
    </code>
  );
}

async function pulseWorker(): Promise<WorkerResult> {
  const secret = (process.env.SECURE_CRON_SECRET || "").trim();
  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "";
  const url = `${base}/api/ops/webform/worker`;

  if (!secret) {
    return {
      ok: false,
      error: "SECURE_CRON_SECRET not configured",
    };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-secure-cron": secret,
      },
      // we want fresh execution every time
      cache: "no-store",
    });

    // Worker returns JSON on both success and failure paths
    const json = (await res.json()) as WorkerResult;

    // If the API responded non-200, surface as error while preserving payload
    if (!res.ok) {
      return {
        ok: false,
        error:
          (json as any)?.error ||
          `worker_http_${res.status}_${res.statusText.toLowerCase().replace(/\s+/g, "_")}`,
        processed: (json as any)?.processed,
        lastId: (json as any)?.lastId,
      };
    }

    return json;
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export default async function Page() {
  const result = await pulseWorker();

  const backHref = "/ops/webform/queue";

  return (
    <div style={{ padding: 24, maxWidth: 820, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Ops · Webform Pulse</h1>
          <p style={{ marginTop: 6, color: "#6b7280" }}>
            Triggers a single pass of the Playwright webform worker and shows the outcome.
          </p>
        </div>
        <a
          href={backHref}
          style={{
            textDecoration: "none",
            border: "1px solid #e5e7eb",
            padding: "8px 12px",
            borderRadius: 8,
            fontWeight: 600,
            background: "#fff",
          }}
        >
          ← Back to Queue
        </a>
      </div>

      <div style={{ height: 12 }} />

      {/* Result card */}
      {result.ok && (result as any).message === "no_jobs" ? (
        <Box tone="neutral">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>No jobs</div>
          <div style={{ color: "#6b7280" }}>
            The queue appears empty or nothing matched the worker’s claim criteria.
          </div>
        </Box>
      ) : result.ok ? (
        <Box tone="success">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Pulse completed successfully
          </div>
          <div>
            Processed: <Mono>{String((result as any).processed ?? 0)}</Mono>
          </div>
          <div style={{ marginTop: 4 }}>
            Last Job ID:{" "}
            <Mono>{String((result as any).lastId ?? "—")}</Mono>
          </div>
          {(result as any).note ? (
            <div style={{ marginTop: 6, color: "#065f46" }}>
              {(result as any).note}
            </div>
          ) : null}
          <div style={{ marginTop: 12 }}>
            <a
              href={backHref}
              style={{
                textDecoration: "none",
                border: "1px solid #111827",
                padding: "8px 12px",
                borderRadius: 8,
                fontWeight: 600,
                background: "#111827",
                color: "white",
              }}
            >
              View Queue
            </a>
          </div>
        </Box>
      ) : (
        <Box tone="error">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Pulse failed</div>
          <div>
            Error: <Mono>{(result as any).error || "unknown_error"}</Mono>
          </div>
          {"processed" in result && (
            <div style={{ marginTop: 4 }}>
              Processed (partial):{" "}
              <Mono>{String((result as any).processed ?? 0)}</Mono>
            </div>
          )}
          {"lastId" in result && (
            <div style={{ marginTop: 4 }}>
              Last Job ID:{" "}
              <Mono>{String((result as any).lastId ?? "—")}</Mono>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <a
              href={backHref}
              style={{
                textDecoration: "none",
                border: "1px solid #e5e7eb",
                padding: "8px 12px",
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              Back to Queue
            </a>
          </div>
        </Box>
      )}

      {/* Tips */}
      <div style={{ marginTop: 16, color: "#6b7280", fontSize: 12 }}>
        Ensure <Mono>SECURE_CRON_SECRET</Mono> is set in your environment. The worker endpoint is{" "}
        <Mono>/api/ops/webform/worker</Mono>.
      </div>
    </div>
  );
}
