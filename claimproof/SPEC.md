# ClaimProof Suite — Product & Architecture Specification (SPEC.md)

**ClaimProof** is a local-first, zero-server-cost Desktop Progressive Web App (PWA) designed specifically for Indian e-commerce sellers shipping on **Meesho, Flipkart, Amazon India, Myntra, and AJIO**.

The core mission of ClaimProof is to stop return fraud, transit pilferage, and wrongful marketplace claim rejections by pairing daily high-speed shipping label workflow with tamper-evident, uncut barcode-verified packing and unboxing video evidence.

---

## 1. Module Architecture & Capabilities

### 1.1 SmartLabel Studio (Module A)
A high-throughput browser-based shipping label parser, vector cropper, and warehouse organizer.
* **Input:** Accepts drag-and-drop batch upload of up to 15 marketplace shipping-label PDFs at once.
* **Vector Parsing (`pdfjs-dist`):** Extracts textual layers without raster distortion:
  * Air Waybill (AWB) / Tracking Number
  * Order ID
  * Stock Keeping Unit (SKU)
  * Size and Color attributes
  * Quantity (Units)
  * Courier Partner (Valmo, ValmoPlus, Delhivery, Ekart, Shadowfax, Xpressbees, Ecom Express, DTDC)
  * Marketplace Identifier (Meesho, Flipkart, Amazon, Myntra, AJIO)
  * Label Content Bounding Box coordinates
* **Vector Cropping & Formatting (`pdf-lib`):**
  * Presets: 4×6 inch (100×150 mm standard thermal), 4×4 inch, and 4-per-A4 grid cut sheets.
  * Stamping: Automatically injects a high-visibility SKU footer strip (`SKU | Size | Qty | Date`) along the bottom margin.
  * Multi-Quantity Guard: Detects orders where `Qty > 1` and stamps a high-visibility red border and `MULTI-QTY: X UNITS` badge to prevent packing omissions.
  * Courier Grouping: Sorts labels by courier partner and SKU to streamline carrier handovers.
* **Warehouse Manifests:** Automatically prepends an aggregate Warehouse Picklist and Courier Handover Manifest summarizing parcel counts and SKU units per carrier.
* **IndexedDB Order Memory:** Automatically indexes extracted AWBs into Dexie IndexedDB so the video recorder can auto-match parcels in sub-milliseconds without manual data entry.

### 1.2 ClaimProof AWB Recorder (Module B)
A rapid, hands-free video recording packing station designed for fast warehouse table operation.
* **Hands-Free Triggering:**
  * Physical USB / Bluetooth HID barcode scanner gun (<80ms burst key listener with trailing Enter).
  * Web camera barcode scanner (native browser `BarcodeDetector` API with `@zxing/library` fallback).
* **Forensic Video Stream (`MediaRecorder` & Canvas Compositor):**
  * Records continuous uncut MP4/WebM video at ~1.2 Mbps.
  * Dynamically burns in an indelible forensic evidence banner across the top:
    `VERIFIED UNCUT PROOF | AWB | ORDER ID | SKU (QTY) | LIVE IST TIMESTAMP (DD-MMM-YYYY HH:mm:ss.SSS)`
* **Automated Evidence Photo Collage:**
  * Automatically captures 4 timed high-resolution JPEG still frames mid-recording (at T+0.5s, T+3s, T+6s, and T+9s).
  * Stitches the 4 stills into a 2×2 forensic photo collage (`{AWB}_Photo_Collage.jpg`).
* **Sub-100ms Parcel Chaining:** Scanning the next AWB immediately finalizes, saves the previous recording, and starts the next clip with zero mouse or keyboard interaction.
* **Dual Operation Modes:**
  * **Dispatch Mode:** For outbound order packing.
  * **Return Unboxing Mode:** For receiving and opening customer returns or Return to Origin (RTO) parcels. Pressing `F2` flags a defective, damaged, or swapped return immediately.
* **Synthetic Demo Camera:** Allows complete testing of the recording pipeline without requiring a physical webcam.

### 1.3 ClaimRadar (Module C)
A real-time dispute radar and evidence preparation studio for recovering revenue from bad returns.
* **Return Flagging:** Flag bad returns with specific dispute reasons (`Damaged`, `Used/Worn`, `Wrong/Swapped item`, `Missing item`, `Empty package`).
* **Live Deadline Radar:** Countdown timers based on individual marketplace dispute filing windows:
  * Meesho SAFE: 72 hours *[needs verification]*
  * AJIO: 72 hours *[needs verification]*
  * Snapdeal: 72 hours *[needs verification]*
  * Myntra: 72 hours *[needs verification]*
  * Flipkart SPF: 14 days (336 hours) *[needs verification]*
  * Amazon SAFE-T: 30 days (720 hours) *[needs verification]*
* **Side-by-Side Matcher:** Cross-references the original outbound Dispatch recording against the Return Unboxing recording for the same AWB.
* **Dispute Dossier Packaging:** Generates marketplace-tailored dispute claim text and packages side-by-side photo collages and video files for 1-click upload to seller support tickets.

### 1.4 Evidence Vault
A zero-cloud, 100% private local storage engine.
* **Direct File System Access:** Uses the Chromium File System Access API (`showDirectoryPicker`) to write MP4/WebM videos and JPEG collages directly to the seller's hard drive without server bandwidth or cloud storage fees.
* **Directory Layout:**
  ```
  <Vault_Root>/
    └── <YYYY-MM-DD>/
          ├── Dispatch/
          │     └── <AWB>/
          │           ├── <AWB>_Video.mp4
          │           └── <AWB>_Photo_Collage.jpg
          └── Return/
                └── <AWB>/
                      ├── <AWB>_Video.mp4
                      └── <AWB>_Photo_Collage.jpg
  ```
* **Downloads Fallback:** For browsers without File System Access API, files save seamlessly through browser downloads.
* **Media Cache:** Rolling local blob cache stored inside IndexedDB to provide immediate instant replays inside the UI.

### 1.5 Pricing & Offline Licensing Engine
A hardware-bound, offline-verifiable cryptographic licensing system.
* **Single Source of Truth (`src/config/plans.ts`):** Defines all plans in INR (Starter Station ₹349/mo or ₹2,499/yr, ClaimRadar Pro ₹599/mo or ₹4,499/yr, Warehouse ₹1,199/mo or ₹8,999/yr), consumed uniformly across UI and tests.
* **Launch Payment Checkout:** Direct "Buy" button opens a Razorpay Payment Link / Payment Page (`VITE_RAZORPAY_PAYMENT_URL`) in a new tab for frictionless customer payment.
* **Manual Offline Fulfillment:** Phase 1 begins with manual sales: admin issues signed license keys via `scripts/issue_license.mjs` and delivers them directly to customers.
* **Razorpay Subscriptions Milestone Gate:** Automated recurring Razorpay Subscriptions (`src/config/subscriptionConfig.ts`) are introduced **only after achieving at least 20 manual sales**.
* **Subscription Webhooks & 3-Day Grace Period:**
  - Official Razorpay documentation citations:
    - Subscriptions: `https://razorpay.com/docs/api/payments/subscriptions/webhooks/`
    - Subscriptions Payloads: `https://razorpay.com/docs/webhooks/payloads/subscriptions/`
    - Payments: `https://razorpay.com/docs/webhooks/payloads/payments/`
    - Refunds: `https://razorpay.com/docs/webhooks/payloads/refunds/`
  - Handled events:
    - `subscription.activated`: Sets license active, calculates expiry as `current_end + 3 days grace`.
    - `subscription.charged`: Recurring debit success; extends expiry to `current_end + 3 days grace`.
    - `subscription.halted`: Retries exhausted; sets status to `halted` while preserving grace access.
    - `subscription.cancelled`: Sets status to `cancelled`; access continues until `current_end + 3 days`.
    - `payment.failed`: Records failure, marks subscription status `payment_failed`.
    - `refund.processed` / `refund.created`: Revokes license row (`status: 'revoked'`).
  - Idempotency: All webhook deliveries are deduplicated by `event_id` in `cp_webhook_events`.
* **App Subscription States:**
  - `"renews on"`: Rendered when recurring subscription is active with upcoming renewal date.
  - `"payment failed, update your payment method"`: Rendered when payment attempt fails or subscription is halted.
  - `"expired, features limited"`: Rendered when license and 3-day grace have lapsed (pro features revert to Free tier quota).
* **ES256 Offline JWT Tokens:** Licenses are digitally signed using an ECDSA P-256 private key and validated 100% on-device using a public JWK (`src/lib/licenseKeys.ts`). Verification requires zero network calls or server round-trips. Every token includes `plan`, `exp` (expiry), and `cid`/`sub` (customer ID).
* **Soft Device Binding:** Tokens support soft binding to up to 2 workstations per license. If a customer upgrades their PC or hits the limit, the app provides a 1-click "Move license to this device" option rather than a rigid lockout.

### 1.6 Opt-In Analytics & Scrubbed Error Monitoring
* **Strictly Opt-In:** Disabled by default (`defaultOptIn: false`). Can be toggled on/off anytime in Settings.
* **Zero PII / Zero Order Data:** Never collects or transmits AWBs, order IDs, SKUs, customer addresses, videos, or label documents.
* **Allowed Milestone Events:** Only 5 milestone events can ever be tracked:
  1. `onboarding_completed`
  2. `first_label_export`
  3. `first_recording_saved`
  4. `paywall_viewed`
  5. `purchase_started`
* **Client-Side Sensitive Data Scrubber:** Automatic multi-pattern redaction engine scrubs all local file paths (`C:\...`, `/home/...`), document/media filenames, tracking numbers (`AWB*`, `FMPP*`, `MSH*`, etc.), order IDs (`ORD*`, `OD*`, `404-*`), catalog SKUs, mobile numbers, and emails before error messages or stack traces leave the client.
* **Endpoints:** Analytics and Sentry-compatible endpoints in `src/config/telemetryConfig.ts` are marked `[needs verification]`.

### 1.7 Optional Chrome Web Store Extension (Manifest V3)
Designed strictly for sellers requesting a 1-click browser extension launcher.
* **Architecture:** Manifest V3 (`extension/manifest.json`), opening the full web application in a browser tab upon clicking the extension action icon (`chrome.action.onClicked`).
* **Zero Host Permissions:** `host_permissions: []`. Does not inject scripts, read cookies, or touch marketplace websites (Meesho, Flipkart, Amazon, Myntra, AJIO) in any way.
* **Minimal Privileges:** `permissions: []`. Camera access is requested strictly at runtime via standard browser prompt (`navigator.mediaDevices.getUserMedia`) when opening the AWB Recorder.
* **Trademark Compliance:** Extension title (`ClaimProof — Shipping Label & Packing Evidence Studio`) strictly avoids marketplace brand names.
* **Packaging & Store Review:** Built via `npm run build:extension` (`scripts/build_extension.mjs`), outputting `dist-extension/claimproof-extension.zip`. Accompanied by the submission checklist in `EXTENSION_STORE_CHECKLIST.md`.

---

## 2. Local Data Storage Specification

ClaimProof is strictly **offline-first**. No customer videos, photos, or shipping label documents are ever uploaded to any cloud server.

### 2.1 Dexie IndexedDB Schema (`claimproof`)
Database version 1 defines 9 object stores:
1. `orders`: Extracted shipping labels indexed by `++id, awb, orderId, sku, courier, marketplace, batchId, createdAt`.
2. `batches`: Batch processing metadata indexed by `id, createdAt`.
3. `recordings`: Metadata records for each video recording indexed by `++id, awb, orderId, type, startedAt, flagged, courier, sku, marketplace`.
4. `claims`: Marketplace claim items indexed by `++id, awb, status, marketplace, deadlineAt, returnScanAt`.
5. `license_state`: Key-value store holding the verified workstation license (`active`).
6. `usage_counters`: Daily quota usage counters keyed by IST date string `YYYY-MM-DD`.
7. `settings`: Application configuration preferences and directory handles keyed by string identifier.
8. `vault`: Persisted `FileSystemDirectoryHandle` for directory access.
9. `media_cache`: Local temporary blob cache for in-app media playback indexed by `id, savedAt`.

### 2.2 Local Storage Keys
* `claimproof_last_plan`: Cached plan identifier to prevent UI flashes during startup.

---

## 3. Tier Comparison: Free vs. Paid

| Feature | Free Tier | Starter Station | ClaimRadar Pro ★ | Warehouse 3-Pack |
| :--- | :--- | :--- | :--- | :--- |
| **Pricing (Monthly)** | Free Forever | ₹349 / month | ₹599 / month | ₹1,199 / month |
| **Pricing (Annual)** | Free Forever | ₹2,499 / year *(₹208/mo)* | ₹4,499 / year *(₹375/mo)* | ₹8,999 / year *(₹750/mo)* |
| **Label Cropping & Sorting** | 40 labels / day | Unlimited | Unlimited | Unlimited |
| **AWB Video Recording** | 10 videos / day | Unlimited | Unlimited | Unlimited |
| **Forensic Watermark** | Standard | Burnt-in HD | Burnt-in HD | Burnt-in HD |
| **Picklist & Manifests** | Included (ClaimProof seal) | Clean / White-label | Clean / White-label | Clean / White-label |
| **Viral Manifest Footer** | Yes *(Phase 3 loop)* | Removed | Removed | Removed |
| **Auto 4-Photo Collage** | No | No | Yes (T+0.5, 3, 6, 9s) | Yes (T+0.5, 3, 6, 9s) |
| **Claim Deadline Radar** | No | No | Yes (72h / 14d / 30d) | Yes (72h / 14d / 30d) |
| **Return Matcher & Dossier** | No | No | Yes (Side-by-side) | Yes (Side-by-side) |
| **Workstation Licenses** | 1 PC | 1 PC | 1 PC | 3 PCs simultaneous |
| **Phone Companion Scanning** | No | No | No | Yes (Wireless sync) |
| **Support** | Community | Email | Priority Email | Dedicated WhatsApp |

---

## 4. Marketplace Rules & Policy Flags

All marketplace-specific dispute filing windows and claim rubrics are subject to platform policy changes and are formally marked as **`[needs verification]`**:
* Meesho SAFE claim window: 72 hours *[needs verification]*
* AJIO dispute window: 72 hours *[needs verification]*
* Snapdeal claim window: 72 hours *[needs verification]*
* Myntra claim window: 72 hours *[needs verification]*
* Flipkart SPF claim window: 14 days (336 hours) *[needs verification]*
* Amazon India SAFE-T claim window: 30 days (720 hours) *[needs verification]*

