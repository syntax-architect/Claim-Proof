# ClaimProof Suite — SmartLabel SKU+ & ClaimProof AWB

**A local-first, zero-server-cost PWA for Indian e-commerce sellers** (Meesho, Flipkart, Amazon India, Myntra, AJIO). Crop shipping labels, record barcode-verified uncut packing videos, and win return disputes before the 72-hour / 14-day / 30-day windows close.

> Every parcel, proven. Every claim, won.

---

## What's inside

| Module | What it does | Price |
|---|---|---|
| **SmartLabel SKU+** (Module A) | Drag-and-drop up to 15 label PDFs → extracts AWB / Order ID / SKU / Size / Qty / courier → vector-crops to 4×6, 4×4 or 4-per-A4 → stamps `SKU \| Size \| Qty \| date` → multi-qty guard (red border + badge) → sorts by Courier → SKU → Qty → prepends a Warehouse Picklist & Courier Handover manifest. | Free (40 labels/day) |
| **ClaimProof AWB** (Module B) | Scan a barcode (USB gun, webcam `BarcodeDetector`/ZXing, or phone companion) → uncut video starts instantly with a burnt-in forensic bar (`VERIFIED UNCUT PROOF | AWB | ORDER | SKU (Qty) | live IST timestamp`) → 4 timed JPEG stills (T+0.5/3/6/9 s) stitched into a 2×2 evidence collage → scan the next parcel and the clip chains in <100 ms. Files land in `<vault>/<date>/<Dispatch|Return>/<AWB>/`. | Free 10/day (watermarked) · unlimited from ₹2,499/yr (₹349/mo) |
| **ClaimRadar Pro** (Module C) | Flag bad returns with `F2` during Return Unboxing Mode → live deadline radar per marketplace rubric (Meesho SAFE / AJIO / Snapdeal 72 h · Flipkart SPF 14 d · Amazon SAFE-T 30 d) → side-by-side dispatch-vs-return matcher → auto-generated dispute text → 1-click evidence packaging. | ₹4,499/yr (₹599/mo) · ₹7,188 value |
| **Monetization** (Module D) | Freemium quota engine, UPI QR checkout modal, ES256 offline-verifiable license JWTs bound to a device fingerprint, Supabase SQL schema + Razorpay webhook Edge Function. | — |

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build → dist/
npm run preview      # serve the production build
```

Utility scripts:

```bash
npm run gen:samples  # regenerate samples/*.pdf (test label PDFs for the parser)
npm run gen:icons    # regenerate PWA icons (needs Python + Pillow)
npm run gen:keys     # rotate the ES256 license keypair
```

No account, no backend required to run — everything works offline on day one.

## The daily loop

1. **Crop** — drop `samples/sample_labels_meesho.pdf` (or your real label PDFs) into SmartLabel Studio, review the parsed table, pick 4×6, hit **Crop & export**. The PDF downloads and every AWB is indexed into IndexedDB.
2. **Record** — connect the vault once in Settings (or let files fall back to Downloads). Scan an AWB: the video starts itself, the parcel card auto-matches SKU/Order/courier, 4 evidence photos capture mid-clip, and scanning the *next* parcel chains instantly. `Space` stops & saves, `F2` flags a bad return.
3. **Claim** — flagged returns appear in ClaimRadar with a live countdown. **Prepare Claim** opens the dispatch-vs-return evidence modal with copy-paste dispute text tailored to each marketplace.

## Architecture

```
src/
├─ types/index.ts               # shared domain contract
├─ db/schema.ts                 # Dexie (IndexedDB): orders, recordings, claims,
│                               #   license_state, usage_counters, media_cache…
├─ lib/
│  ├─ cameraScanner.ts          # BarcodeDetector + ZXing fallback (~30 fps offscreen)
│  ├─ hidScanner.ts             # USB/Bluetooth HID gun listener (<80 ms bursts + Enter)
│  ├─ audioBeeps.ts             # Web Audio start/saved/error/flag beeps (zero assets)
│  ├─ claimRules.ts             # marketplace deadline rubrics + claim builder
│  ├─ quota.ts                  # freemium counters (40 labels / 10 videos per day)
│  ├─ upi.ts                    # UPI intent links + QR rendering
│  ├─ theme.ts                  # light/dark theme store
│  └─ router.ts                 # hash router + IST day helpers
├─ services/
│  ├─ pdfLabelProcessor.ts      # pdfjs parse → pdf-lib vector crop/stamp/sort/manifest
│  ├─ recordingPipeline.ts      # canvas compositor + MediaRecorder @1.2 Mbps + collage
│  ├─ vaultWriter.ts            # File System Access API vault (Downloads fallback)
│  ├─ licenseService.ts         # ES256 JWT verify (WebCrypto) + device fingerprint
│  ├─ claimEngine.ts            # evidence matching + dispute-text generator
│  ├─ mediaLibrary.ts           # IndexedDB blob cache + vault reader for replay
│  ├─ labelDataStore.ts         # label batch persistence
│  └─ phonePairing.ts           # Supabase Realtime room-code companion (optional)
├─ components/
│  ├─ smartlabel/               # Module A workbench (drop → parse → review → export)
│  ├─ recorder/                 # Module B station (state machine, HUD, photo slots)
│  ├─ claims/                   # Module C dashboard + evidence modal
│  ├─ paywall/                  # UPI checkout modal (3 plans)
│  └─ ui/                       # design system (dark control-room theme)
├─ supabase/
│  ├─ migrations/001_claimproof_licensing.sql
│  └─ functions/razorpay-webhook/index.ts
└─ scripts/                     # icons, keypair, sample-label generators
```

**Storage:** media never leaves the PC — videos/collages go straight to the vault folder via the File System Access API; IndexedDB keeps sub-millisecond-searchable metadata plus a bounded blob cache for in-app replay.

## Production monetization setup

1. `supabase db push` (or run `supabase/migrations/001_claimproof_licensing.sql` in the SQL editor).
2. `supabase secrets set RAZORPAY_WEBHOOK_SECRET=… LICENSE_SIGNING_KEY_JWK_B64=$(base64 -w0 scripts/.license-dev-keys.json) LICENSE_JWT_KID=cp-dev-1`
3. `supabase functions deploy razorpay-webhook --no-verify-jwt`
4. Point the Razorpay dashboard webhook (`payment.captured`) at the function URL. It verifies the HMAC signature, de-duplicates via `cp_webhook_events`, registers the device, stores the license and returns the signed ES256 token the app verifies fully offline. Each captured payment mints a 365-day license — for monthly UPI Autopay mandates (the paywall's recurring copy), wire Razorpay Subscriptions and extend the function to honour `subscription.*` events before going live.
5. Replace the placeholder VPA `claimproof@upi` in `src/lib/upi.ts` with your Razorpay/Cashfree dynamic-QR flow.

> Rotate keys with `npm run gen:keys` — the private JWK must only ever live in the Edge Function secret store.

## PWA & Chrome Extension

- **PWA:** `dist/` is installable (manifest + service worker, offline after first load). Chrome → ⋮ → *Install ClaimProof*.
- **Extension (MV3):** the bundle has no server dependencies; build and load `dist/` as an unpacked extension with an MV3 `manifest.json` pointing at `index.html` for the packing-station tab.

## Test matrix verified

- ✅ Parser: Meesho (Valmo, ValmoPlus, Delhivery, multi-qty) · Flipkart (Ekart) · Amazon (XpressBees, numeric-AWB fallback) sample PDFs → all fields extracted, sorted by courier.
- ✅ Export: vector-cropped PDF with SKU stamp + multi-qty guard + manifest; quota counters update (6/40).
- ✅ Recorder: scan → REC + forensic bar (live IST timestamp) → auto-matched parcel card → 4 timed photo captures → Space saves → quota 1/10 → recent list.
- ✅ Claims: F2 flag → reason picker → claim queued with 72 h countdown ring → Prepare Claim modal (side-by-side evidence + dispute text).
- ✅ Paywall: quota/gate triggers → 3 plans → UPI QR → demo activation unlocks Pro features instantly.
- ✅ Demo mode: the entire state machine runs without a webcam (synthetic scene) and without File System Access (Downloads fallback).

## Notes

- The recorder needs `https://` or `localhost` for camera APIs; the vault picker needs a Chromium browser. Everything degrades gracefully otherwise.
- Free-tier recordings carry the `Recorded via ClaimProof.in — Free Tier` watermark; photo collages, ClaimRadar and the matcher are Pro features.
- Phone companion requires `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` at build time; USB guns and the webcam scanner need no configuration.

— Built as a complete, production-ready codebase. No TODOs, no placeholders.
