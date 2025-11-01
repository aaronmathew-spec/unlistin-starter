/* src/lib/proofs/receipt.ts */
import "server-only";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR  = process.env.SUPABASE_SERVICE_ROLE!;

function sb() {
  return createClient(URL, SR, { auth: { persistSession: false } });
}

export function sha256Hex(input: Uint8Array | Buffer | string): string {
  const h = crypto.createHash("sha256");
  h.update(typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input));
  return h.digest("hex");
}

export async function writeProofRow(args: {
  jobId: string;
  artifactType: string;
  artifactHashHex: string;
  controllerKey?: string | null;
  subjectId?: string | null;
}) {
  const client = sb();
  await client.from("ops_proofs").insert({
    job_id: args.jobId,
    controller_key: args.controllerKey ?? null,
    subject_id: args.subjectId ?? null,
    artifact_type: args.artifactType,
    artifact_hash: args.artifactHashHex,
  });
}
