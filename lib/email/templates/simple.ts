// lib/email/templates/simple.ts
/**
 * Minimal, robust HTML email template with a matching plain-text fall back.
 * - Mobile-friendly single-column, safe system fonts, dark-mode OK.
 * - No external CSS; inlines styles compatible with major providers.
 * - Inputs are escaped by construction; only href is trusted by caller.
 */

type Cta = { label: string; href: string };

export type SimpleEmailInput = {
  title: string;                 // e.g., "UnlistIN — SLA Breach Summary"
  intro?: string;                // short paragraph at top
  bullets?: string[];            // list items
  footer?: string;               // small print at bottom
  cta?: Cta;                     // optional button
  brand?: {                      // optional branding
    product?: string;            // e.g., "UnlistIN"
    url?: string;                // e.g., https://unlistin.xyz
  };
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toText(input: SimpleEmailInput): string {
  const lines: string[] = [];
  lines.push(input.title);
  lines.push("");
  if (input.intro) lines.push(input.intro);
  if (input.bullets?.length) {
    lines.push("");
    for (const b of input.bullets) lines.push(`• ${b}`);
  }
  if (input.cta) {
    lines.push("");
    lines.push(`Action: ${input.cta.label}`);
    lines.push(input.cta.href);
  }
  if (input.footer) {
    lines.push("");
    lines.push(input.footer);
  }
  if (input.brand?.product && input.brand?.url) {
    lines.push("");
    lines.push(`${input.brand.product} • ${input.brand.url}`);
  }
  return lines.join("\n");
}

export function renderSimpleEmail(input: SimpleEmailInput): { html: string; text: string } {
  const title = escapeHtml(input.title);
  const intro = input.intro ? escapeHtml(input.intro) : "";
  const footer = input.footer ? escapeHtml(input.footer) : "";
  const bullets = (input.bullets || []).map(escapeHtml);

  // CTA href is caller-controlled; we only escape the label.
  const cta = input.cta ? { label: escapeHtml(input.cta.label), href: input.cta.href } : undefined;

  const brandName = input.brand?.product ? escapeHtml(input.brand.product) : "UnlistIN";
  const brandUrl = input.brand?.url || "";

  const html = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7f9;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f6f7f9;">
      <tr><td style="padding:24px 12px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e9ebf0;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;border-bottom:1px solid #eef0f4;background:#fafbfe;">
              <div style="font:600 16px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;">
                ${brandUrl ? `<a href="${brandUrl}" style="color:inherit;text-decoration:none;">${brandName}</a>` : brandName}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <h1 style="margin:0 0 10px 0;font:700 20px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;">${title}</h1>
              ${intro ? `<p style="margin:0 0 14px 0;font:400 14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#374151;">${intro}</p>` : ""}
              ${bullets.length ? `
                <ul style="margin:0 0 16px 20px;padding:0;font:400 14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827;">
                  ${bullets.map(b => `<li style="margin:4px 0;">${b}</li>`).join("")}
                </ul>` : ""}
              ${cta ? `
                <div style="margin:18px 0 8px;">
                  <a href="${cta.href}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px;font:600 14px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
                    ${cta.label}
                  </a>
                </div>
              ` : ""}
              ${footer ? `<p style="margin:16px 0 0 0;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#6b7280;">${footer}</p>` : ""}
            </td>
          </tr>
        </table>
        <div style="max-width:640px;margin:8px auto 0;text-align:center;color:#9ca3af;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
          This email was generated automatically by ${brandName}.
        </div>
      </td></tr>
    </table>
  </body>
</html>`;

  return { html, text: toText(input) };
}
