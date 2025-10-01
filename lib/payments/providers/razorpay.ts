// lib/payments/providers/razorpay.ts
import type { CheckoutRequest, CheckoutResponse, PaymentProvider } from "../types";

export function razorpayProvider(): PaymentProvider {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  return {
    name: "razorpay",
    isConfigured: () => !!keyId && !!keySecret,

    async createCheckout(req: CheckoutRequest): Promise<CheckoutResponse> {
      if (!keyId || !keySecret) {
        throw new Error("Razorpay not configured (RAZORPAY_KEY_ID/SECRET missing)");
      }
      if (req.plan === "free") {
        return { url: req.successUrl };
      }

      // Placeholder hosted page URL (when wiring SDK, create order & use Checkout)
      const fakeUrl = `${req.successUrl}?provider=razorpay&plan=${req.plan}`;
      return { url: fakeUrl };
    },

    async verifyWebhook(_sigHeader: string | null, rawBody: string) {
      if (!keyId || !keySecret) return { ok: false, error: "Razorpay not configured" };

      // Placeholder verification — replace with HMAC verification when enabling real webhooks
      const looksJson = rawBody.trim().startsWith("{");
      return {
        ok: looksJson,
        eventType: looksJson ? "payment.captured" : undefined,
        data: looksJson ? JSON.parse(rawBody) : undefined,
        error: looksJson ? undefined : "Invalid payload",
      };
    },
  };
}
