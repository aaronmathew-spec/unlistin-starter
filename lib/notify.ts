export async function notifySlack(text: string) {
  const url = (process.env.SLACK_WEBHOOK_URL || "").trim();
  if (!url) return; // no-op if not configured
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    // best effort only; ignore errors
  }
}
