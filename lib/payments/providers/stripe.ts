// lib/payments/providers/stripe.ts
import type { CheckoutRequest, CheckoutResponse, PaymentProvider } from "../types";

export function stripeProvider(): PaymentProvider {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  const priceMap: Record<string, string | undefined> = {
    pro: process.env.STRIPE_PRICE_PRO,
    business: process.env.STRIPE_PRICE_BUSINESS,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
  };

  return {
    name: "stripe",
    isConfigured: () => !!key,

    async createCheckout(req: CheckoutRequest): Promise<CheckoutResponse> {
      if (!key) {
        throw new Error("Stripe not configured (STRIPE_SECRET_KEY missing)");
      }
      if (req.plan === "free") {
        return { url: req.successUrl }; // nothing to buy
      }
      const price = priceMap[req.plan];
      if (!price) {
        throw new Error(`Stripe price id not configured for plan=${req.plan}`);
      }

      // No SDK here to avoid adding deps right now—return a placeholder URL.
      // When ready, swap with real Stripe SDK call (checkout.sessions.create).
      const fakeUrl = `${req.successUrl}?provider=stripe&plan=${req.plan}`;
      return { url: fakeUrl };
    },

    async verifyWebhook(sigHeader: string | null, rawBody: string) {
      if (!key) return { ok: false, error: "Stripe not configured" };

      // Placeholder verification — replace with Stripe constructEvent
      const looksJson = rawBody.trim().startsWith("{");
      return {
        ok: !!looksJson && !!sigHeader,
        eventType: looksJson ? "checkout.session.completed" : undefined,
        data: looksJson ? JSON.parse(rawBody) : undefined,
        error: looksJson ? undefined : "Invalid payload",
      };
    },
  };
}
