// src/lib/proofs/pack.ts
import JSZip from "jszip";
import { getSigner, sha256 } from "../signing";

type Artifact = {
  id: string;
  type: "screenshot" | "dom_tree" | "email_receipt" | "api_response" | "search_index";
  createdAt: string; // ISO
  contentUri: string; // supabase storage path or presigned url
  contentSha256?: string; // optional if precomputed
  meta?: Record<string, any>;
};

type Manifest = {
  schema: "unlistin-proof-pack@v2";
  subjectId: string;
  generatedAt: string;
  artifacts: Array<{
    id: string;
    type: Artifact["type"];
    createdAt: string;
    contentSha256: string;
    meta?: Record<string, any>;
  }>;
  merkle?: {
    root?: string;
  };
};

async function getArtifactsForSubject(subjectId: string): Promise<Artifact[]> {
  // TODO: wire to your DB. Minimal placeholder uses contentUri to fetch bytes.
  return []; // <<< replace with your actual query
}

async function streamArtifact(contentUri: string): Promise<Uint8Array> {
  const res = await fetch(contentUri);
  if (!res.ok) throw new Error(`Fetch failed for ${contentUri}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

export async function buildProofPack(subjectId: string): Promise<Uint8Array> {
  const signer = await getSigner();
  const artifacts = await getArtifactsForSubject(subjectId);

  const normalized = await Promise.all(
    artifacts.map(async (a) => {
      const bytes = await streamArtifact(a.contentUri);
      const digest = sha256(bytes).toString("hex");
      return { ...a, contentSha256: digest };
    })
  );

  const manifest: Manifest = {
    schema: "unlistin-proof-pack@v2",
    subjectId,
    generatedAt: new Date().toISOString(),
    artifacts: normalized.map((n) => ({
      id: n.id,
      type: n.type,
      createdAt: n.createdAt,
      contentSha256: n.contentSha256!,
      meta: n.meta,
    })),
  };

  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  const manifestDigest = sha256(manifestBytes);

  const sig = await signer.signSha256(manifestDigest);
  const pub = await signer.publicKeyPem();

  const zip = new JSZip();
  zip.file("manifest.json", manifestBytes);
  zip.file("signature.bin", sig.signature); // raw bytes
  zip.file("public_key.pem", pub);
  zip.file("signature.alg.txt", `${sig.alg}`);
  zip.file("signature.key_id.txt", `${sig.keyId}`);
  zip.file(
    "README.txt",
    `UnlistIN Proof Pack v2
Subject: ${subjectId}
Signed alg: ${sig.alg}
Key: ${sig.keyId}

Verify:
1) Compute SHA-256 of manifest.json
2) Verify signature.bin against public_key.pem using ${sig.alg}.
`
  );

  // Generate as Uint8Array (web BodyInit-friendly)
  const u8 = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return u8;
}

// Utility HTTP responder (use web Response, not NextResponse, to avoid Buffer typing issues)
export async function proofPackResponse(subjectId: string): Promise<Response> {
  const zip = await buildProofPack(subjectId);
  const filename = `unlistin-proof-pack-${subjectId}.zip`;
  return new Response(zip, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
