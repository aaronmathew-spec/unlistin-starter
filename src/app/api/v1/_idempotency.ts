export function getIdempotencyKey(req: Request) {
  const v = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
  return v && v.trim().length > 0 ? v.trim() : null;
}
