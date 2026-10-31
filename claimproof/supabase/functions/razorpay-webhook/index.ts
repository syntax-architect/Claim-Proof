// ═══════════════════════════════════════════════════════════════════════
// ClaimProof.in — Razorpay webhook → license issuance (Supabase Edge Function)
//
// Setup:
//   supabase secrets set \
//     RAZORPAY_WEBHOOK_SECRET=... \
//     LICENSE_SIGNING_KEY_JWK_B64=$(base64 -w0 scripts/.license-dev-keys.json) \
//     LICENSE_JWT_KID=cp-dev-1
//   supabase functions deploy razorpay-webhook --no-verify-jwt
//
// Point the Razorpay dashboard webhook at:
//   https://<project>.supabase.co/functions/v1/razorpay-webhook
// (event: payment.captured)
// ═══════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const LICENSE_ISSUER = 'https://claimproof.in';
const VALID_PLANS = new Set(['starter', 'claimradar', 'warehouse']);
const LICENSE_DAYS = 365;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });

const b64url = (bytes: Uint8Array): string => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

async function verifyRazorpaySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(expected, signature);
}

interface JwtParts {
  headerB64: string;
  payloadB64: string;
  signingInput: string;
  signatureB64: string;
  payload: Record<string, unknown>;
}

async function signEs256Jwt(parts: JwtParts, privateJwk: JsonWebKey): Promise<string> {
  const key = await crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(parts.signingInput)
  );
  /* WebCrypto ES256 signatures are raw r||s — exactly what the app verifies. */
  return `${parts.headerB64}.${parts.payloadB64}.${b64url(new Uint8Array(sig))}`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  try {
    const raw = await req.text();
    const signature = req.headers.get('x-razorpay-signature') ?? '';
    const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    if (!secret || !(await verifyRazorpaySignature(raw, signature, secret))) {
      return json({ ok: false, error: 'invalid signature' }, 401);
    }

    const event = JSON.parse(raw) as {
      event?: string;
      payload?: { payment?: { entity?: Record<string, unknown> } };
    };
    const eventId = req.headers.get('x-razorpay-event-id') ?? `${event.event}-${Date.now()}`;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    /* Idempotency ledger — Razorpay retries until we 200. */
    const insert = await supabase
      .from('cp_webhook_events')
      .insert({ event_id: eventId, event_type: event.event ?? 'unknown', payload: event })
      .onConflict('event_id')
      .ignore()
      .select();
    if (!insert.data || insert.data.length === 0) {
      return json({ ok: true, deduped: true });
    }

    if (event.event !== 'payment.captured') {
      return json({ ok: true, ignored: event.event });
    }

    const payment = event.payload?.payment?.entity ?? {};
    const paymentId = String(payment.id ?? '');
    const notes = (payment.notes ?? {}) as Record<string, string>;
    const plan = String(notes.plan ?? '');
    const fingerprint = String(notes.fingerprint ?? '');
    const seats = Math.max(1, Math.min(25, parseInt(String(notes.seats ?? '1'), 10) || 1));
    const licenseeName = notes.licensee_name ?? notes.name ?? undefined;
    const deviceLabel = notes.device_label ?? undefined;

    if (!VALID_PLANS.has(plan) || !fingerprint || !paymentId) {
      return json({ ok: false, error: 'missing plan/fingerprint/payment id in notes' }, 422);
    }

    /* Register the workstation. */
    const { data: device, error: deviceErr } = await supabase
      .from('cp_devices')
      .upsert(
        { fingerprint_sha: fingerprint, label: deviceLabel ?? null, last_seen_at: new Date().toISOString() },
        { onConflict: 'fingerprint_sha' }
      )
      .select()
      .single();
    if (deviceErr) throw deviceErr;

    /* Insert the license. */
    const expiresAt = new Date(Date.now() + LICENSE_DAYS * 24 * 3_600_000 * 1000).toISOString();
    const jti = crypto.randomUUID();
    const { data: license, error: licenseErr } = await supabase
      .from('cp_licenses')
      .insert({
        plan,
        seats,
        status: 'active',
        fingerprint_sha: fingerprint,
        device_id: device?.id ?? null,
        expires_at: expiresAt,
        razorpay_payment_id: paymentId,
        jti
      })
      .select()
      .single();
    if (licenseErr) throw licenseErr;

    await supabase.from('cp_payments').upsert({
      razorpay_payment_id: paymentId,
      razorpay_order_id: payment.order_id ? String(payment.order_id) : null,
      amount: Number(payment.amount ?? 0),
      currency: String(payment.currency ?? 'INR'),
      status: String(payment.status ?? 'captured'),
      plan,
      notes: payment.notes ?? {},
      license_id: license.id
    });

    /* Issue the offline-verifiable ES256 license JWT. */
    const keyB64 = Deno.env.get('LICENSE_SIGNING_KEY_JWK_B64') ?? '';
    const privateJwk = JSON.parse(atob(keyB64)) as JsonWebKey;
    const iat = Math.floor(Date.now() / 1000);
    const exp = Math.floor(new Date(expiresAt).getTime() / 1000);
    const headerB64 = b64url(new TextEncoder().encode(
      JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: Deno.env.get('LICENSE_JWT_KID') ?? 'cp-dev-1' })
    ));
    const payloadB64 = b64url(new TextEncoder().encode(
      JSON.stringify({
        iss: LICENSE_ISSUER,
        sub: license.id,
        plan,
        seats,
        fp: fingerprint,
        name: licenseeName,
        iat,
        exp,
        jti
      })
    ));
    const token = await signEs256Jwt(
      { headerB64, payloadB64, signingInput: `${headerB64}.${payloadB64}`, signatureB64: '', payload: {} },
      privateJwk
    );

    await supabase.from('cp_licenses').update({ token }).eq('id', license.id);

    return json({ ok: true, token, license_id: license.id });
  } catch (e) {
    console.error('[razorpay-webhook]', e);
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
