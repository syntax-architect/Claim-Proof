/* ClaimProof Suite — Razorpay Subscriptions & Lifecycle Configuration
 *
 * Roadmap Milestone:
 * Only after at least 20 manual sales are completed and validated in Phase 1,
 * automated Razorpay recurring Subscriptions are activated.
 *
 * Official Razorpay Documentation Citations:
 * - Subscriptions Webhooks: https://razorpay.com/docs/api/payments/subscriptions/webhooks/
 * - Subscriptions Payload Entities: https://razorpay.com/docs/webhooks/payloads/subscriptions/
 * - Payments Webhooks (payment.failed): https://razorpay.com/docs/webhooks/payloads/payments/
 * - Refunds Webhooks (refund.processed): https://razorpay.com/docs/webhooks/payloads/refunds/
 */

export const MIN_MANUAL_SALES_FOR_SUBSCRIPTIONS = 20;

export const SUBSCRIPTION_GRACE_PERIOD_DAYS = 3;
export const SUBSCRIPTION_GRACE_PERIOD_SECONDS = 3 * 24 * 3600;

export const RAZORPAY_DOC_CITATIONS = {
  subscriptions: 'https://razorpay.com/docs/api/payments/subscriptions/webhooks/',
  subscriptionPayloads: 'https://razorpay.com/docs/webhooks/payloads/subscriptions/',
  paymentsPayloads: 'https://razorpay.com/docs/webhooks/payloads/payments/',
  refundsPayloads: 'https://razorpay.com/docs/webhooks/payloads/refunds/'
} as const;

export function isSubscriptionsUnlocked(manualSalesCount: number): boolean {
  return manualSalesCount >= MIN_MANUAL_SALES_FOR_SUBSCRIPTIONS;
}

