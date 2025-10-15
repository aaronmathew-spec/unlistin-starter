// lib/proofs/ledger.ts
/**
 * Sign-and-store for Merkle roots (or any artifact hash).
 * - Uses getSigner() to produce a detached signature
 * - Persists to Supabase `proof_ledger`
 * - Returns the inserted row (id + signature metadata)
 *
 * You can call this from any place that computes `rootBytes`.
 */
import { createClient } from "@supabase/supabase-js";
import { getSigner } from "@/lib/crypto/signer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

type InsertContext = {
  /** optional linkage back to your pack/manifests */
  packId?: string | null;
  subjectId?: string | null;
  controllerKey?: string | null;
  // put anything else you'd like to track
  metadata?: Record<string, unknown> | null;
};

export type SignedRootRecord = {
  id: string;
  created_at: string;
  root_hex: string;
  algorithm: "ed25519" | "rsa-pss-sha256";
  key_id: string;
  signature_b64: string;
  pack_id: string | null;
  subject_id: string | null;
  controller_key: string | null;
  metadata: Record<string, unknown> | null;
};

function srv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error("Supabase env missing");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

export async function recordSignedRoot(rootBytes: Uint8Array, ctx: InsertContext = {}): Promise<SignedRootRecord> {
  const signer = getSigner();
  const signed = await signer.sign(rootBytes);

  const sb = srv();
  const { data, error } = await sb
    .from("proof_ledger")
    .insert({
      root_hex: toHex(rootBytes),
      algorithm: signed.algorithm,
      key_id: signed.keyId,
      signature_b64: signed.signatureBase64,
      pack_id: ctx.packId ?? null,
      subject_id: ctx.subjectId ?? null,
      controller_key: ctx.controllerKey ?? null,
      metadata: ctx.metadata ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as SignedRootRecord;
}
