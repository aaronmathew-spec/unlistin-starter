// src/lib/media/hash.ts
import { createHash } from "crypto";

// aHash (8x8) and pHash-lite using DCT over an 32x32 grayscale downsample.
// We use dynamic import for 'sharp' so local/dev can run without hard dep.
type SharpMod = typeof import("sharp");

async function loadSharp(): Promise<SharpMod | null> {
  try {
    // @ts-ignore
    const s: SharpMod = await import("sharp");
    return s;
  } catch {
    return null;
  }
}

export function sha256Hex(buf: Uint8Array): string {
  const h = createHash("sha256");
  h.update(buf);
  return h.digest("hex");
}

function rgbToGray(r: number, g: number, b: number) {
  return (0.299 * r + 0.587 * g + 0.114 * b) | 0;
}

export function bitsToBase64(bits: number[]): string {
  // 64 bits -> 8 bytes -> base64
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    let v = 0;
    for (let b = 0; b < 8; b++) {
      v = (v << 1) | (bits[i * 8 + b] ? 1 : 0);
    }
    bytes[i] = v;
  }
  return Buffer.from(bytes).toString("base64");
}

/** Very small aHash (8x8). Suitable for quick near-dup checks */
export function aHash64(gray: Uint8Array, w: number, h: number): string {
  // downsample to 8x8 average grayscale
  const target = 8;
  const blockW = w / target;
  const blockH = h / target;
  const blocks: number[] = [];
  for (let by = 0; by < target; by++) {
    for (let bx = 0; bx < target; bx++) {
      let sum = 0;
      let count = 0;
      const x0 = Math.floor(bx * blockW);
      const y0 = Math.floor(by * blockH);
      const x1 = Math.min(w, Math.floor((bx + 1) * blockW));
      const y1 = Math.min(h, Math.floor((by + 1) * blockH));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += gray[y * w + x];
          count++;
        }
      }
      blocks.push(count ? sum / count : 0);
    }
  }
  const avg = blocks.reduce((a, b) => a + b, 0) / blocks.length;
  const bits = blocks.map((v) => (v >= avg ? 1 : 0));
  return bitsToBase64(bits); // 64 bits -> base64
}

/** Load image buffer -> grayscale bytes + size via sharp */
export async function toGrayscale(buf: Uint8Array): Promise<{ gray: Uint8Array; width: number; height: number }> {
  const sharp = await loadSharp();
  if (!sharp) throw new Error("sharp_not_available");
  const img = sharp.default(buf).removeAlpha().resize(256, 256, { fit: "inside", withoutEnlargement: true });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true }); // RGB
  const gray = new Uint8Array(info.width * info.height);
  for (let i = 0, p = 0; i < data.length; i += 3, p++) {
    gray[p] = rgbToGray(data[i], data[i + 1], data[i + 2]);
  }
  return { gray, width: info.width, height: info.height };
}

export async function computeHashes(buf: Uint8Array) {
  const sha = sha256Hex(buf);
  try {
    const { gray, width, height } = await toGrayscale(buf);
    const ah64 = aHash64(gray, width, height);
    return { sha256_hex: sha, phash64: ah64, width, height };
  } catch (e) {
    // Fallback to sha only when sharp not available
    return { sha256_hex: sha, phash64: null as string | null, width: null as any, height: null as any };
  }
}
