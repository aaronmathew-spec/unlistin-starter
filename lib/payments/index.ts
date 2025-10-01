// lib/payments/index.ts
import type { PaymentProvider } from "./types";
import { stripeProvider } from "./providers/stripe";
import { razorpayProvider } from "./providers/razorpay";

export function getPaymentProvider(): PaymentProvider {
  const pref = (process.env.BILLING_PROVIDER || "").toLowerCase();

  const stripe = stripeProvider();
  const razor = razorpayProvider();

  if (pref === "stripe" && stripe.isConfigured()) return stripe;
  if (pref === "razorpay" && razor.isConfigured()) return razor;

  // Auto-pick if one is configured
  if (stripe.isConfigured()) return stripe;
  if (razor.isConfigured()) return razor;

  // Fallback stub (always “configured”, returns successUrl)
  return {
    name: "stub",
    isConfigured: () => true,
    async createCheckout(req) {
      return { url: req.successUrl };
    },
    async verifyWebhook() {
      return { ok: true, eventType: "stub.event", data: {} };
    },
  };
}
