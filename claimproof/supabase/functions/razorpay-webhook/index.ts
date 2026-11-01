// ═══════════════════════════════════════════════════════════════════════
// ClaimProof.in — Razorpay webhook → license & subscription management
// (Supabase Edge Function)
//
// Handles:
//   - subscription.activated
//   - subscription.charged (recurring renewal)
//   - subscription.halted (grace period & retry exhaustion)
//   - subscription.cancelled
//   - payment.failed
//   - refund.processed / refund.created (revoking license row)
//   - payment.captured (one-off / manual sales)
//
// Official Razorpay Documentation Citations:
//   - Subscriptions Webhooks: https://razorpay.com/docs/api/payments/subscriptions/webhooks/
//   - Payments Webhooks: https://razorpay.com/docs/webhooks/payloads/payments/
//   - Refunds Webhooks: https://razorpay.com/docs/webhooks/payloads/refunds/
// ═══════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  processRazorpayWebhook,
  type WebhookDatabaseAdapter
} from './pure.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  let eventId = 'unknown';
  try {
    const raw = await req.text();
    const signature = req.headers.get('x-razorpay-signature') ?? '';
    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') ?? '';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const dbAdapter: WebhookDatabaseAdapter = {
      async isEventProcessed(id: string): Promise<boolean> {
        const { data, error } = await supabase
          .from('cp_webhook_events')
          .select('event_id')
          .eq('event_id', id)
          .maybeSingle();
        if (error) throw error;
        return Boolean(data);
      },

      async recordEvent(id: string, eventType: string, payload: unknown): Promise<void> {
        const { error } = await supabase.from('cp_webhook_events').upsert(
          { event_id: id, event_type: eventType, payload },
          { onConflict: 'event_id', ignoreDuplicates: true }
        );
        if (error && error.code !== '23505' && !error.message?.includes('duplicate key')) {
          throw error;
        }
      },

      async getManualSalesCount(): Promise<number> {
        const { count, error } = await supabase
          .from('cp_licenses')
          .select('*', { count: 'exact', head: true })
          .is('subscription_id', null)
          .eq('status', 'active');
        if (error) {
          console.warn('[webhook] Could not count manual sales:', error.message);
          return 20; // fallback to allow if counter unavailable
        }
        return count ?? 0;
      },

      async upsertDevice(fingerprint: string, label?: string) {
        const { data, error } = await supabase
          .from('cp_devices')
          .upsert(
            {
              fingerprint_sha: fingerprint,
              label: label ?? null,
              last_seen_at: new Date().toISOString()
            },
            { onConflict: 'fingerprint_sha' }
          )
          .select()
          .single();
        if (error) throw error;
        return data;
      },

      async upsertLicense(license) {
        if (license.subscription_id) {
          const { data, error } = await supabase
            .from('cp_licenses')
            .upsert(license, { onConflict: 'subscription_id' })
            .select()
            .single();
          if (error) throw error;
          return data;
        }
        const { data, error } = await supabase
          .from('cp_licenses')
          .insert(license)
          .select()
          .single();
        if (error) throw error;
        return data;
      },

      async getLicenseBySubscriptionId(subId: string) {
        const { data, error } = await supabase
          .from('cp_licenses')
          .select('*')
          .eq('subscription_id', subId)
          .maybeSingle();
        if (error) throw error;
        return data;
      },

      async getLicenseByPaymentId(paymentId: string) {
        const { data, error } = await supabase
          .from('cp_licenses')
          .select('*')
          .eq('razorpay_payment_id', paymentId)
          .maybeSingle();
        if (error) throw error;
        return data;
      },

      async updateLicense(id: string, updates: Record<string, unknown>) {
        const { error } = await supabase.from('cp_licenses').update(updates).eq('id', id);
        if (error) throw error;
      },

      async revokeLicenseByPaymentId(paymentId: string, reason?: string) {
        const { error } = await supabase
          .from('cp_licenses')
          .update({
            status: 'revoked',
            expires_at: new Date().toISOString(),
            revocation_reason: reason ?? 'Refund processed'
          })
          .eq('razorpay_payment_id', paymentId);
        if (error) throw error;
      },

      async recordPayment(payment) {
        const { error } = await supabase.from('cp_payments').upsert({
          razorpay_payment_id: payment.razorpay_payment_id,
          razorpay_order_id: payment.razorpay_order_id ?? null,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          plan: payment.plan,
          error_code: payment.error_code ?? null,
          error_description: payment.error_description ?? null,
          license_id: payment.license_id,
          subscription_id: payment.subscription_id,
          notes: payment.notes ?? {}
        });
        if (error) throw error;
      }
    };

    let privateJwk: JsonWebKey | undefined;
    const keyB64 = Deno.env.get('LICENSE_SIGNING_KEY_JWK_B64');
    if (keyB64) {
      try {
        privateJwk = JSON.parse(atob(keyB64)) as JsonWebKey;
      } catch {
        // key missing or invalid
      }
    }

    const kid = Deno.env.get('LICENSE_JWT_KID') ?? 'cp-dev-1';
    eventId = req.headers.get('x-razorpay-event-id') ?? `event-${Date.now()}`;

    const result = await processRazorpayWebhook(raw, signature, secret, dbAdapter, {
      signingKey: privateJwk,
      kid,
      eventIdHeader: eventId
    });

    return json(result, result.status);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error(`[razorpay-webhook] Error processing event ${eventId}: ${message}`);
    return json({ ok: false, error: 'Internal server error' }, 500);
  }
});
