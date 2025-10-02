// lib/evidence.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export type EvidenceRecord = {
  id: number;
  run_id: number | null;
  key_id: string;
  blob_b64: string;
  alg: "AES-256-GCM";
  created_at: string;
  expires_at: string | null;
};

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

function getKey(): { key: Buffer; keyId: string } {
  const raw = process.env.EVIDENCE_KEY;
  if (!raw || raw.length < 32) {
    const tmp = crypto.createHash("sha256").update("dev-fallback").digest("hex");
    return { key: Buffer.from(tmp.slice(0, 64), "hex"), keyId: "dev-fallback" };
  }
  const hash = crypto.createHash("sha256").update(raw).digest();
  return { key: hash, keyId: crypto.createHash("sha1").update(raw).digest("hex") };
}

export function encryptJson(data: unknown): {
  alg: "AES-256-GCM";
  keyId: string;
  iv_b64: string;
  tag_b64: string;
  blob_b64: string;
} {
  const { key, keyId } = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: "AES-256-GCM",
    keyId,
    iv_b64: iv.toString("base64"),
    tag_b64: tag.toString("base64"),
    blob_b64: enc.toString("base64"),
  };
}

export function decryptJson(input: {
  iv_b64: string;
  tag_b64: string;
  blob_b64: string;
}): any {
  const { key } = getKey();
  const iv = Buffer.from(input.iv_b64, "base64");
  const tag = Buffer.from(input.tag_b64, "base64");
  const blob = Buffer.from(input.blob_b64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(blob), decipher.final()]);
  return JSON.parse(out.toString("utf8"));
}

export async function storeEncryptedArtifact(params: {
  runId: number | null;
  json: unknown;
  ttlSeconds?: number;
}): Promise<number> {
  const db = supa();
  const ttlSeconds = Math.max(60, Math.min(7 * 24 * 3600, params.ttlSeconds ?? 24 * 3600));
  const now = new Date();
  const expires = new Date(now.getTime() + ttlSeconds * 1000);
  const payload = encryptJson(params.json);
  const { data, error } = await db
    .from("evidence_artifacts")
    .insert({
      run_id: params.runId,
      key_id: payload.keyId,
      alg: payload.alg,
      blob_b64: JSON.stringify({
        iv_b64: payload.iv_b64,
        tag_b64: payload.tag_b64,
        blob_b64: payload.blob_b64,
      }),
      expires_at: expires.toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  return data!.id as number;
}

export async function auditReveal(params: {
  artifactId: number;
  reason: string;
}): Promise<void> {
  const db = supa();
  await db.from("evidence_audit").insert({
    artifact_id: params.artifactId,
    reason: params.reason.slice(0, 200),
  });
}
