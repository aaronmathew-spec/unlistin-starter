// lib/payments/types.ts
export type Currency = "usd" | "inr";

export type PlanId = "free" | "pro" | "business" | "enterprise";

export interface CheckoutRequest {
  plan: PlanId;
  userId: string; // Supabase auth user id
  email?: string | null;
  successUrl: string;
  cancelUrl: string;
  currency: Currency;
}

export interface CheckoutResponse {
  url: string; // hosted checkout URL
}

export interface PaymentProvider {
  name: "stripe" | "razorpay" | "stub";
  isConfigured(): boolean;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResponse>;
  verifyWebhook(sigHeader: string | null, rawBody: string): Promise<{
    ok: boolean;
    eventType?: string;
    data?: unknown;
    error?: string;
  }>;
}
