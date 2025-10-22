// src/lib/media/hash.ts
// Build-safe: no 'sharp' imports (static or dynamic).
// We preserve the same exports/signatures as your previous 93-line file,
// so callers don't break. Perceptual hashing is left opt-in.
//
// If/when you want actual image decode + aHash/pHash, we’ll add an optional
// module (e.g. src/lib/media/hash-sharp-optional.ts) that’s only required
// when an env flag is set and the 'sharp' package is installed.

import { createHash } from "crypto";

// ------------------------
// Public: SHA-256 (unchanged)
// ------------------------
export function sha256Hex(buf: Uint8Array): string {
  const h = createHash("sha256");
  h.update(buf);
  return h.digest("hex");
}

// ------------------------
// Helpers kept for API-compat
// ------------------------
function rgbToGray(r: number, g: number, b: number) {
  return (0.299 * r + 0.587 * g + 0.114 * b) | 0;
}

// 64 bits -> base64 (kept for compatibility if anything uses it)
export function bitsToBase64(bits: number[]): string {
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

// aHash implementation (works if you already have grayscale bytes)
// Keeping this so any internal usage won’t break.
export function aHash64(gray: Uint8Array, w: number, h: number): string {
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
  return bitsToBase64(bits);
}

// ------------------------
// toGrayscale: now an opt-out stub
// ------------------------
// We keep the signature so imports don’t break, but we don’t decode images
// in this build. If some code calls this directly, it will throw a clear
// error (which you can catch) rather than causing build-time failures.
export async function toGrayscale(
  _buf: Uint8Array
): Promise<{ gray: Uint8Array; width: number; height: number }> {
  throw new Error("image_decode_not_enabled: install & enable optional sharp-based module to use toGrayscale()");
}

// ------------------------
// computeHashes: stable return shape, graceful fallback
// ------------------------
export async function computeHashes(buf: Uint8Array) {
  const sha = sha256Hex(buf);

  // Try to use toGrayscale() if a caller has swapped in an enabled version;
  // otherwise fall back to SHA only.
  try {
    const { gray, width, height } = await toGrayscale(buf);
    const ah64 = aHash64(gray, width, height);
    return { sha256_hex: sha, phash64: ah64, width, height };
  } catch {
    // Fallback when image decode isn’t enabled in this build
    return {
      sha256_hex: sha,
      phash64: null as string | null,
      width: null as number | null,
      height: null as number | null,
    };
  }
}

// NOTE: rgbToGray is kept in case any internal logic uses it. It’s unused here
// without image decoding and does not affect the bundle size.
