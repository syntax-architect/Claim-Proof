-- ═══════════════════════════════════════════════════════════════════════
-- SABOOT.in — licensing, devices, payments & webhook idempotency
-- Supabase PostgreSQL migration 001
--
-- Model:
--   * Sellers pay via Razorpay UPI (webhook → Edge Function).
--   * The Edge Function (service_role) registers the device, inserts the
--     license + payment, and returns a signed offline-verifiable ES256 JWT.
--   * Users can only SELECT their own rows; every write path is
--     service_role-only (webhook), enforced by RLS.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Devices (packing-station workstations bound by hardware fingerprint) ──
create table public.cp_devices (
  id              uuid primary key default gen_random_uuid(),
  owner           uuid references auth.users (id) on delete cascade,
  fingerprint_sha text unique not null,
  label           text,
  platform        jsonb,
  created_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now()
);
comment on table public.cp_devices is
  'Packing-station workstations identified by a stable hardware fingerprint (WebGL + hardware + timezone hash).';

-- ── Licenses (one row per paid activation) ──────────────────────────────
create table public.cp_licenses (
  id                  uuid primary key default gen_random_uuid(),
  owner               uuid references auth.users (id) on delete cascade,
  plan                text not null check (plan in ('starter', 'claimradar', 'warehouse')),
  seats               int  not null default 1 check (seats between 1 and 25),
  status              text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  fingerprint_sha     text,
  device_id           uuid references public.cp_devices (id) on delete set null,
  issued_at           timestamptz not null default now(),
  expires_at          timestamptz,
  razorpay_payment_id text,
  jti                 text unique,
  token               text
);
comment on table public.cp_licenses is
  'Paid plan activations. `token` holds the ES256 license JWT the app verifies offline.';
create index cp_licenses_owner_idx       on public.cp_licenses (owner);
create index cp_licenses_fingerprint_idx on public.cp_licenses (fingerprint_sha);
create index cp_licenses_status_idx      on public.cp_licenses (status);

-- ── Payments (Razorpay capture ledger) ──────────────────────────────────
create table public.cp_payments (
  razorpay_payment_id text primary key,
  razorpay_order_id   text,
  amount              int  not null,             -- paise
  currency            text not null default 'INR',
  status              text not null,
  plan                text,
  notes               jsonb,
  license_id          uuid references public.cp_licenses (id) on delete set null,
  created_at          timestamptz not null default now()
);
comment on table public.cp_payments is 'Razorpay payment.captured ledger — one row per UPI capture.';

-- ── Webhook events (idempotency ledger — Razorpay retries aggressively) ──
create table public.cp_webhook_events (
  event_id     text primary key,
  event_type   text not null,
  payload      jsonb,
  processed_at timestamptz not null default now()
);
comment on table public.cp_webhook_events is
  'Raw webhook receipt ledger. Insert-on-conflict-nothing gives exactly-once processing.';

-- ═══════════════════════════════════════════════════════════════════════
-- Row Level Security — read-only for owners; writes are service_role only.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.cp_devices        enable row level security;
alter table public.cp_licenses       enable row level security;
alter table public.cp_payments       enable row level security;
alter table public.cp_webhook_events enable row level security;

create policy cp_devices_owner_select on public.cp_devices
  for select using (owner = auth.uid());
create policy cp_licenses_owner_select on public.cp_licenses
  for select using (owner = auth.uid());
create policy cp_payments_owner_select on public.cp_payments
  for select using (owner = auth.uid());
-- cp_webhook_events: no user policies at all — service_role bypasses RLS.

-- ═══════════════════════════════════════════════════════════════════════
-- Helper: upsert a device by fingerprint (called by the Edge Function with
-- the service role, hence security definer).
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.cp_register_device(
  p_fingerprint text,
  p_label       text default null,
  p_platform    jsonb default null
)
returns public.cp_devices
language plpgsql
security definer
set search_path = public
as $$
declare
  device public.cp_devices;
begin
  insert into public.cp_devices (fingerprint_sha, label, platform, last_seen_at)
  values (p_fingerprint, p_label, p_platform, now())
  on conflict (fingerprint_sha)
    do update set label        = coalesce(excluded.label, cp_devices.label),
                  platform     = coalesce(excluded.platform, cp_devices.platform),
                  last_seen_at = now()
  returning * into device;
  return device;
end;
$$;
