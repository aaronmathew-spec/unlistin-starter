// src/app/ops/webforms/[id]/page.tsx
import Link from "next/link";

type Job = {
  id: string;
  action_id: string;
  subject_id: string;
  url: string;
  status: "queued" | "running" | "succeeded" | "failed";
  attempt: number;
  scheduled_at?: string | null;
  run_at?: string | null;
  completed_at?: string | null;
  result?: any;
  created_at?: string | null;
  updated_at?: string | null;
};

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/ops/webforms/${params.id}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Webform Job</h1>
        <p className="text-red-600 mt-2">Failed to load: {res.statusText}</p>
        <Link href="/ops/webforms" className="text-sm text-blue-600 hover:underline mt-4 inline-block">
          ← Back to queue
        </Link>
      </div>
    );
  }

  const { job, action, controller } = (await res.json()) as {
    job: Job;
    action: any;
    controller: any;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Webform Job</h1>
        <Link href="/ops/webforms" className="text-sm text-blue-600 hover:underline">
          ← Back to queue
        </Link>
      </div>

      <section className="grid md:grid-cols-3 gap-4">
        <Card>
          <KeyVal k="Status" v={<StatusPill status={job.status} />} />
          <KeyVal k="Attempts" v={String(job.attempt ?? 0)} />
          <KeyVal k="Scheduled" v={fmt(job.scheduled_at)} />
          <KeyVal k="Run at" v={fmt(job.run_at)} />
          <KeyVal k="Completed" v={fmt(job.completed_at)} />
          <KeyVal k="Created" v={fmt(job.created_at)} />
          <KeyVal k="Updated" v={fmt(job.updated_at)} />
        </Card>

        <Card>
          <KeyVal k="Job ID" v={<Mono>{job.id}</Mono>} />
          <KeyVal k="Action ID" v={<Mono>{job.action_id}</Mono>} />
          <KeyVal k="Subject ID" v={<Mono>{job.subject_id}</Mono>} />
          <KeyVal
            k="URL"
            v={
              <a href={job.url} target="_blank" className="text-blue-600 hover:underline break-all" rel="noreferrer">
                {job.url}
              </a>
            }
          />
        </Card>

        <Card>
          <h3 className="text-sm font-medium mb-2">Controller</h3>
          {controller ? (
            <div className="space-y-1 text-sm">
              <div>
                <span className="text-gray-500">Name:</span> {controller.name || "-"}
              </div>
              <div>
                <span className="text-gray-500">Domain:</span> {controller.domain || "-"}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                ID: <Mono>{controller.id}</Mono>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No controller context.</div>
          )}
          {action && (
            <>
              <div className="h-px bg-gray-200 my-3" />
              <h3 className="text-sm font-medium mb-2">Action</h3>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-gray-500">Status:</span> {action.status}
                </div>
                <div>
                  <span className="text-gray-500">To:</span> {action.to || "-"}
                </div>
                <div className="text-xs text-gray-500 mt-2">Verification Info:</div>
                <Pre data={action.verification_info || {}} />
              </div>
            </>
          )}
        </Card>
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-medium mb-3">Confirmation / Response</h3>
          <div className="text-sm whitespace-pre-wrap">
            {job.result?.confirmationText ? (
              job.result.confirmationText
            ) : (
              <span className="text-gray-500">No confirmation text captured.</span>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-medium mb-3">Artifacts</h3>
          <div className="space-y-2 text-sm">
            <KeyVal k="HTML hash" v={<Mono>{job.result?.htmlHash || "-"}</Mono>} />
            <KeyVal k="Screenshot hash" v={<Mono>{job.result?.screenshotHash || "-"}</Mono>} />
            <KeyVal k="HTML path" v={<Mono className="break-all">{job.result?.htmlPath || "-"}</Mono>} />
            <KeyVal k="Screenshot path" v={<Mono className="break-all">{job.result?.screenshotPath || "-"}</Mono>} />
          </div>
        </Card>
      </section>

      <section>
        <Card>
          <h3 className="text-sm font-medium mb-3">Raw Result</h3>
          <Pre data={job.result || {}} />
        </Card>
      </section>
    </div>
  );
}

function fmt(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString();
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="border rounded-2xl p-4">{children}</div>;
}
function KeyVal({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="text-gray-500 text-sm">{k}</div>
      <div className="text-sm text-gray-900">{v}</div>
    </div>
  );
}
function Mono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <code className={`font-mono text-xs ${className}`}>{children}</code>;
}
function Pre({ data }: { data: any }) {
  return (
    <pre className="bg-gray-50 rounded-lg p-3 text-xs overflow-auto max-h-80">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

/** Inline status pill with tasteful colors */
function StatusPill({ status }: { status: Job["status"] }) {
  const styles: Record<Job["status"], string> = {
    queued: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    running: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    succeeded: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    failed: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  };
  const labelMap: Record<Job["status"], string> = {
    queued: "Queued",
    running: "Running",
    succeeded: "Succeeded",
    failed: "Failed",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {labelMap[status]}
    </span>
  );
}
