// src/agents/verification/capture.ts
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import crypto from "crypto";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

function sha256Hex(buf: Buffer | string) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export async function captureAndStoreArtifacts(params: {
  subjectId: string;
  actionId: string;
  url: string;
}) {
  const supabase = db();
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const basePath = `${params.subjectId}/${params.actionId}/${ts}`;
  const bucket = "proof-vault";

  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();

  try {
    const resp = await page.goto(params.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const ok = !!resp && resp.ok();
    // best-effort settle
    await page.waitForTimeout(1200);

    const html = await page.content();
    const screenshot = await page.screenshot({ fullPage: true });

    const htmlBuf = Buffer.from(html, "utf8");
    const htmlHash = sha256Hex(htmlBuf);
    const shotHash = sha256Hex(screenshot);

    const htmlPath = `${basePath}/page.html`;
    const shotPath = `${basePath}/screenshot.png`;

    // Upload HTML
    {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(htmlPath, htmlBuf, { contentType: "text/html", upsert: true });
      if (error) throw new Error(`upload html failed: ${error.message}`);
    }
    // Upload screenshot
    {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(shotPath, screenshot, { contentType: "image/png", upsert: true });
      if (error) throw new Error(`upload screenshot failed: ${error.message}`);
    }

    return {
      ok,
      htmlHash,
      screenshotHash: shotHash,
      htmlPath,
      screenshotPath: shotPath,
      status: resp ? resp.status() : 0,
    };
  } finally {
    await ctx.close();
    await browser.close();
  }
}
