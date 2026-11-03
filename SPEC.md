# SABOOT Suite — Product & Architecture Specification (SPEC.md)

**SABOOT** is a local-first, zero-server-cost Desktop Progressive Web App (PWA) designed specifically for Indian e-commerce sellers shipping on **Meesho, Flipkart, Amazon India, Myntra, and AJIO**.

The core mission of SABOOT is to stop return fraud, transit pilferage, and wrongful marketplace claim rejections by pairing daily high-speed shipping label workflow with tamper-evident, uncut barcode-verified packing and unboxing video evidence.

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

### 1.2 SABOOT AWB Recorder (Module B)
A rapid, hands-free video recording packing station designed for fast warehouse table operation.
* **Hands-Free Triggering & Barcode Scanner Subsystem:**
  * **Keyboard-Wedge USB / Bluetooth HID Scanner Listener (`src/lib/hidScanner.ts` & `src/config/scannerConfig.ts`):**
    * **Typing Speed Detection:** Analyzes inter-keystroke timing deltas. Hardware laser/CCD barcode guns emit keystroke bursts at <80ms intervals (typically 10–35ms), whereas human typing averages 120–250ms with high variance.
    * **Form Field Isolation:** Transparently distinguishes barcode scanner bursts from normal human typing inside `<input>`, `<textarea>`, and `contentEditable` fields. Normal typing in text inputs is ignored; high-speed scanner bursts are captured, processed, and the form field cleared.
    * **Configurable Suffix & Terminators:** Supports `Enter`, `Tab`, `EnterOrTab`, or `None` (idle timeout fallback).
    * **Prefix & Symbology Cleaning:**
      * Automatically strips ISO/IEC 15424 standard AIM Symbology Identifiers (e.g. `]C1` for Code 128, `]e0` for EAN-13, `]A0` for Code 39, `]Q1` for QR).
      * Strips leading/trailing ASCII control characters (`\x00-\x1F`, `\x7F`), carriage returns, and whitespace.
      * Strips user-configured custom prefix strings (e.g. carrier identifiers).
      * Normalizes case according to configuration (`uppercase`, `lowercase`, `preserve`).
    * **Duplicate Scan Debounce:** Configurable debounce suppression window (default 1,500 ms) preventing double-scans from accidental repeat trigger pulls.
    * **Minimum Length Guard:** Configurable minimum code length (default 4 chars) preventing stray single-key activations.
    * **Acoustic & Visual Feedback:**
      * Valid scan: Web Audio API crisp 1046.5 Hz sine tone (70ms) + green confirmation indicator.
      * Invalid scan: Descending 280 Hz -> 140 Hz sawtooth buzz (180ms) + red visual flash ring and actionable warning toast.
  * **Phone & Web Camera Barcode Scanner (`src/lib/cameraScanner.ts`):**
    * Uses native browser `BarcodeDetector` API for zero-overhead hardware-accelerated scanning, falling back automatically to `@zxing/library` when unsupported.
    * Hardware Torch Control: Detects `torch` capability via `MediaTrackConstraints` and provides an instant toggle (`hasTorch`, `isTorchOn`, `setTorch`).
    * Hardware Zoom Control: Queries camera `zoom` capability (min, max, step) and provides an interactive slider (`hasZoom`, `getZoomRange`, `setZoom`).
    * Shares the identical barcode normalization, noise stripping, duplicate debounce, and audio tone pipeline.
* **Scanner Test Workbench (`src/pages/ScannerTestPage.tsx`, `/scanner-test`):**
  * Dedicated interactive diagnostic laboratory for testing and calibrating any barcode scanner gun or camera.
  * Live Keystroke Inspector displaying every raw key event with exact millisecond intervals.
  * Speed & Burst Analytics calculating key count, total burst duration (ms), average ms/key, and detected terminator.
  * Typing Sandbox comparing slow manual keyboard typing vs high-speed barcode gun bursts inside form fields.
  * Live camera preview with hardware torch toggle and zoom slider.
  * Acoustic sound testing for good scan sine tone and invalid scan buzz.
  * Quick settings controls for prefix, suffix, min length, debounce duration, noise stripping, and case handling.
  * Scan session history table with Indian Standard Time (`IST`) timestamps.
* **Packing Video Stream (`MediaRecorder` & Canvas Compositor):**
  * Records continuous uncut MP4/WebM video at ~1.2 Mbps.
  * Dynamically burns in an live timestamp evidence banner across the top:
    `VERIFIED UNCUT PROOF | AWB | ORDER ID | SKU (QTY) | LIVE IST TIMESTAMP (DD-MMM-YYYY HH:mm:ss.SSS)`
* **Automated Evidence Photo Collage:**
  * Automatically captures 4 timed high-resolution JPEG still frames mid-recording (at T+0.5s, T+3s, T+6s, and T+9s).
  * Stitches the 4 stills into a 2×2 evidence photo collage (`{AWB}_Photo_Collage.jpg`).
* **Sub-100ms Parcel Chaining:** Scanning the next AWB immediately finalizes, saves the previous recording, and starts the next clip with zero mouse or keyboard interaction.
* **Dual Operation Modes:**
  * **Dispatch Mode:** For outbound order packing.
  * **Return Unboxing Mode:** A guided unboxing workflow engineered specifically to produce dispute evidence that satisfies Indian marketplace seller panels (Meesho, Flipkart, Amazon India, Myntra, AJIO, Snapdeal, GlowRoad):
    * **Continuous Uncut Video Rule:** Marketplaces summarily reject spliced or paused return footage. Pausing mid-recording is strictly blocked with an explanatory warning in plain language.
    * **Guided Live Checklist Overlay:** Config-driven checklist (`src/config/evidenceChecklists.ts`) showing required steps with official citations (marked `UNVERIFIED - check your seller panel` until confirmed by seller).
    * **Step Actions & Hotkeys:** Every step is tickable via click or physical keyboard keys (`1`–`6` or `T` to advance). Ticks record completion timestamp and video offset seconds.
    * **Mandatory Package Condition Tag:** Enforces condition selection (`good`, `wrong_item`, `empty`, `damaged`, `used_worn`) before allowing the recording to be finalized.
    * **Automatic ClaimRadar Integration:** Selecting any defective condition (`damaged`, `wrong_item`, `empty`, `used_worn`) automatically creates a pending claim item with marketplace countdown in ClaimRadar.
    * **Burned-in Evidence Banner:** Dynamically watermarks `[RETURN UNBOXING]` vs `[DISPATCH]` alongside AWB, order ID, SKU, and live Indian Standard Time (`DD-MMM-YYYY HH:mm:ss.SSS IST`).
    * **Hardware & Network Resilience:** Mid-recording camera disconnects or interruptions trigger emergency save of in-progress footage flagged as `partial: true` to prevent evidence loss (Rule 11).
    * **Take Indexing:** Repeated scans of the same AWB automatically version files (`Return_Video_{AWB}_Take2.mp4`) preserving all attempts.
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
* **Centralized Marketplace Claim Windows (`src/config/claimWindows.ts`):**
  * Defines official seller help URLs (`sourceUrl`), dispute window duration (`hours`, `defaultHours`), verification status (`lastVerified`), and a strict `verified: boolean` flag.
  * Unverified windows display an explicit `"UNVERIFIED, check your seller panel."` warning badge in ClaimRadar and Settings until verified by the seller.
  * User-customizable: Sellers can edit any marketplace claim window duration and reset back to defaults at any time.
  * Automatic claim recalculation: Whenever a claim window is edited, existing active claims for that marketplace recalculate their deadline and record an explanatory note: `[Window updated from Xh to Yh on DD-MMM-YYYY HH:mm:ss IST]`.
* **Global Urgency Alert Banner (`src/components/claims/ClaimUrgencyAlertBanner.tsx`):**
  * Displays a high-visibility alert banner across every page in the application shell when any active claim is within 24 hours (warning, amber token) or 6 hours (critical, danger token) of expiring.
  * Provides live ticking countdown and 1-click "Prepare Claim" navigation to ClaimRadar.
  * Feature Flag: Controlled via `claimRadarUrgencyBanner` in `src/config/featureFlags.ts`.
* **IST-First Delivery Date Calculation & Edge Case Guards:**
  * Dispute deadlines are strictly computed in Indian Standard Time (IST, UTC+05:30) from the return delivery date entered by the user.
  * Past dates guard: Flags returns delivered in the past where the dispute window has already expired, prompting manual filing with proof of delay.
  * Clock-skew resilience: Resilient against device clock changes without NaN or infinite loops.
* **Calendar Export & Desktop Reminders:**
  * **RFC 5545 Calendar Export (`src/lib/calendarExport.ts`):** 1-click export of `.ics` calendar files with embedded 24-hour (`-PT24H`) and 6-hour (`-PT6H`) reminders compatible with Google Calendar, Outlook, and Apple Calendar.
  * **Optional Browser Notifications (`src/lib/claimNotifications.ts`):** Requests permission with a plain-language explanation dialog (zero marketing promises, 100% private on-device) and fires desktop alerts at 24h and 6h marks.
  * Feature Flags: `claimCalendarExport` and `claimNotifications` in `src/config/featureFlags.ts`.
* **Side-by-Side Matcher:** Cross-references the original outbound Dispatch recording against the Return Unboxing recording for the same AWB.
* **Dispute Dossier Packaging:** Generates marketplace-tailored dispute claim text and packages side-by-side photo collages and video files for 1-click upload to seller support tickets.
* **Template-Based Dispute Messages (`src/config/disputeTemplates.ts`):**
  * Multi-language support: English (`en`) and Hindi (`hi`).
  * Structured categories: General Discrepancy (`general`), Wrong/Swapped Item (`wrong_item`), Damaged Item (`damaged`), and Empty Package/Missing Item (`empty`).
  * Auto-populated data fields: Order ID, AWB, SKU, dispatch date (IST), return unboxing date (IST), what was sent (with quantity and size), and what was received.
  * Preview & Highlight: Visual preview prominently highlights missing/unverified fields in amber with informative tags (`[MISSING: ...]`).
  * Live Customization: Full user editability before copying, accompanied by a dynamic character counter and one-click copy to clipboard.
  * Polite & Factual Tone: Strictly excludes accusatory words (e.g. fraud, scam, cheat, theft, guarantee) and contains zero legal/policy citations unless explicitly added by the user.
  * Feature Flag: Controlled via `disputeTemplates` in `src/config/featureFlags.ts`.
* **1-Click Claim Kit Generator (`src/services/claimKitBuilder.ts`, `src/components/claims/ClaimKitModal.tsx`):**
  * One-click packaging of dispute evidence into an organized folder (`ClaimKit_{AWB}`) on local disk or downloadable zero-dependency ZIP archive (`ClaimKit_{AWB}.zip`).
  * Contents:
    * Outbound dispatch packing video and inbound return unboxing video (prefers MP4 when supported, announces format used).
    * Extracted key moment still frames saved in `Key_Frames/` subdirectory.
    * Official Claim Summary Sheet PDF (`Claim_Summary_{AWB}.pdf`) generated client-side via `pdf-lib` with shipment table, barcode verification chain, burnt-in IST timestamps, checklist verification rows, dispute dossier letter, and local-first verification footer.
    * Standalone dispute dossier letter (`Dispute_Letter_{AWB}.txt`).
  * Target-size re-encoding setting (default none): re-encodes only when exceeding configured target limit (Meesho 50MB, Amazon 25MB, Flipkart 100MB, custom).
  * Strict legibility quality gate: enforces `MIN_LEGIBLE_BITRATE = 350,000` bps; throws plain-language actionable error if target size would render text or barcodes unreadable (never silently degrades).
  * Optional recipient address privacy blur (off by default): masks buyer name and phone on canvas while preserving AWB barcode.
  * 100% computed locally on device (zero cloud uploads).
  * Real-time progress bar (0–100%) and cancel button with atomic rollback ensuring zero partial/corrupted files remain.
  * Robust edge case handling: folder name collision resolution (`ClaimKit_{AWB} (1)`, `(2)`), missing return video handled gracefully with warning, and storage permission revocation detection with actionable recovery.
  * IndexedDB schema version bump (v4) with automated upgrade migration initializing `claimKitGeneratedAt`.
  * Feature Flag: Controlled via `claimKitBuilder` in `src/config/featureFlags.ts`.

### 1.4 Money & Claims Ledger (Module D)
A local-first financial recovery ledger tracking disputes, cash recoveries, and software ROI.
* **Claims Ledger Table:** Tracks AWB, marketplace, status (`not_filed`, `filed`, `won`, `partly_won`, `lost`), `amountClaimedPaise`, `amountRecoveredPaise`, `filedAt`, `resolvedAt`, and seller `notes`.
* **Quick Status & Amount Form:** Modal form for instant updates, auto-populating amounts when claims are won, lost, or partly won.
* **Audit Trail:** Preserves an immutable on-device audit log (`auditTrail`) of all past edits to claim status, amounts, and notes with IST timestamps.
* **CSV Ledger Import & Export:** Full bidirectional RFC 4180 CSV export and import with field validation, negative/huge amount guards (up to ₹1,00,00,000), and IST formatting.
* **Money Dashboard & Date Filter:** Real-time totals and counts for filed, won, lost, pending, and recovered disputes across All Time, Today, Last 7 Days, Last 30 Days, and This Month in IST.
* **Zero Fake Statistics:** Win rate and recovery percentages are strictly suppressed until at least 10 resolved claims exist on the seller's device, then labeled explicitly as "your own results".
* **Plan Breakeven Meter:** Real-time ROI meter comparing total recovered revenue against user-entered software plan cost, celebrating when the software has paid for itself (hidden when no data/cost entered).
* **Feature Flag:** Controlled via `moneyLedger` in `src/config/featureFlags.ts`.

### 1.5 Evidence Vault
A zero-cloud, private local storage engine.
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

### 1.6 Unified Global Evidence Search
A sub-200ms multi-index search engine and accessible modal dialog unifying packing videos, return unboxing footage, photo collages, and marketplace dispute claim status.
* **Global Access & Keyboard Shortcuts:**
  - Accessible via `Ctrl+K` / `⌘K` global keyboard shortcut or the search button in the TopBar and Command Palette.
  - Automatically captures USB/Bluetooth barcode scanner gun bursts anywhere in the application shell.
* **Input Sanitization & Tolerant Matching (`src/services/evidenceSearch.ts`):**
  - Trims leading/trailing whitespace, converts input to lowercase for case-insensitive lookup.
  - Automatically strips laser barcode scanner control characters, non-printable bytes, and suffix delimiters (`\r`, `\n`, `\t`).
  - Supports exact prefix matching via IndexedDB multi-field indexes (`awb`, `orderId`, `sku`) with in-memory substring/partial matching fallback.
* **Performance Benchmark SLA Guard:**
  - Guaranteed sub-200ms latency across 10,000+ local IndexedDB parcel and recording records (measured typically < 60ms).
* **Unified Evidence Dossier Aggregation:**
  - Consolidates multiple takes/attempts for the same AWB, categorizing the latest verified attempt and listing previous takes in a duplicate attempts dropdown.
  - Cross-references outbound Dispatch video, inbound Return Unboxing video, 2×2 photo collages, and active ClaimRadar dispute claim status into a single comprehensive dossier.
* **Actionable Statuses & Plain-Language Next Steps:**
  - **Found:** Direct 1-click video replay and photo collage preview.
  - **Missing Disk File:** Detects when vault files were moved or the drive was disconnected, displaying `"Evidence file not found on disk"` with an actionable `"Relink Vault Folder"` button.
  - **Not Recorded:** Handles return-only parcels or missing dispatch footage, displaying an actionable `"Open Packing Station"` link to begin immediate recording.
* **Large Result Set Pagination:**
  - Paginates search results (10 dossiers per page) with Previous and Next controls, active page indicator, and result count with elapsed latency in milliseconds.
* **Zero-Cloud Privacy (Rule 4):**
  - 100% computed on-device using local IndexedDB tables; zero search queries or parcel identifiers ever leave the seller's computer.
* **Feature Flag:** Controlled via `FEATURES.globalEvidenceSearch` in `src/config/features.ts`.

### 1.7 Pricing & Offline Licensing Engine
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
* **ES256 Offline JWT Tokens:** Licenses are digitally signed using an ECDSA P-256 private key and validated strictly on-device using a public JWK (`src/lib/licenseKeys.ts`). Verification requires zero network calls or server round-trips. Every token includes `plan`, `exp` (expiry), and `cid`/`sub` (customer ID).
* **Soft Device Binding:** Tokens support soft binding to up to 2 workstations per license. If a customer upgrades their PC or hits the limit, the app provides a 1-click "Move license to this device" option rather than a rigid lockout.

### 1.8 Opt-In Analytics & Scrubbed Error Monitoring
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

### 1.9 Optional Chrome Web Store Extension (Manifest V3)
Designed strictly for sellers requesting a 1-click browser extension launcher.
* **Architecture:** Manifest V3 (`extension/manifest.json`), opening the full web application in a browser tab upon clicking the extension action icon (`chrome.action.onClicked`).
* **Zero Host Permissions:** `host_permissions: []`. Does not inject scripts, read cookies, or touch marketplace websites (Meesho, Flipkart, Amazon, Myntra, AJIO) in any way.
* **Minimal Privileges:** `permissions: []`. Camera access is requested strictly at runtime via standard browser prompt (`navigator.mediaDevices.getUserMedia`) when opening the AWB Recorder.
* **Trademark Compliance:** Extension title (`**SABOOT** — Shipping Label & Packing Evidence Studio`) strictly avoids marketplace brand names.
* **Packaging & Store Review:** Built via `npm run build:extension` (`scripts/build_extension.mjs`), outputting `dist-extension/saboot-extension.zip`. Accompanied by the submission checklist in `EXTENSION_STORE_CHECKLIST.md`.

### 1.10 Internationalization (i18n) & Typography
Designed for accessibility across Indian seller warehouses and packing stations.
* **Bilingual Support:** 100% typed catalogs for English (`en`) and Hindi (`hi`) in `src/locales/en.ts` and `src/locales/hi.ts`.
* **Zero Hardcoded Strings:** All user-facing labels, empty states, error messages, templates, and buttons are routed through `t(key, params)` via `useI18n()`.
* **Session Persistence:** Selected language is stored in `localStorage['saboot_locale']` and Dexie IndexedDB settings table; dynamically synchronizes `document.documentElement.lang`.
* **Self-Hosted Typography:** Bundles `@fontsource-variable/noto-sans-devanagari` locally (OFL-1.1 license, ~35KB woff2). Strictly zero calls to Google Fonts or external CDNs.
* **Flexible 360px Layouts:** Tested to prevent text clipping, ellipsis truncation, or horizontal scroll at 360px viewport widths across both English and Hindi.
* **AI Translation Review Registry:** All translated strings are registered in `src/locales/translation-metadata.json` with status `"needs-review"` and domain categorization for native speaker sign-off.
* **Pseudo-Localization:** Built-in pseudo-localization helper (`pseudoLocalize`) with accented character expansion (+30%) and bracket delimitation (`[!!! ... !!!]`) accessible via Settings for UI stress-testing.

### 1.11 Restrained Motion System
Subtle, high-performance UI feedback utilizing `framer-motion`:
* **Design Principles:** Restrained durations (160–280ms) and snappy ease-out curve (`cubic-bezier(0.16, 1, 0.3, 1)`).
* **GPU-Friendly:** Animates only `transform` and `opacity` properties; never animates layout dimensions (`width`, `height`, `margin`, `padding`).
* **Active Recording Safety:** All animations (except the live pulsing recording indicator dot) are strictly suppressed during active video capture to prevent frame drops.
* **Reduced Motion Accessibility:** Honors `prefers-reduced-motion` at both Framer Motion level (`<MotionConfig reducedMotion="user">`) and CSS media query level.
* **Motion Tokens (`src/lib/motion.ts`):** Standardized variants for `fadeIn`, `fadeUp`, `scaleIn`, `staggerContainer`, modal springs, and smooth count-up number tickers.

### 1.12 WebRTC Phone Companion (Wireless Packing Camera)
Turns any smartphone into a wireless packing station camera and evidence capture device.
* **Single-Use QR Pairing (120s TTL):**
  - PC generates a high-entropy room identifier and a cryptographic pairing token with a strict 2-minute (120-second) TTL.
  - Seller scans the QR code (`#pair?room=<room>&token=<token>`) using standard mobile camera or scanner app.
  - Expired, re-used, or invalid tokens are immediately rejected with clear actionable alerts.
  - **Single-Phone Mutex:** If a second phone attempts to pair to an active station, it is immediately rejected with a plain-language `"Another device is already connected"` alert.
* **WebRTC Peer-to-Peer Live Preview:**
  - Phone establishes direct P2P streaming to the PC via `RTCPeerConnection` and STUN servers.
  - Real-time video preview renders on the PC packing station monitor with zero discernible latency.
* **Zero-Media Signaling Privacy (Rule 4):**
  - WebRTC signaling uses lightweight pub/sub channels strictly for SDP offer/answer exchanges and ICE candidates.
  - Guarded by runtime assertions (`assertNoMediaInSignaling`) verifying that no raw video, binary blobs, base64 media, or data URLs can ever pass through signaling servers.
* **Full-Quality Local Phone Recording & Forensics:**
  - The phone records directly from its high-resolution camera sensor using an offscreen canvas compositor.
  - Burns in legal forensic metadata: live Indian Standard Time (`DD-MMM-YYYY HH:mm:ss IST`), active parcel AWB / tracking number, recording timer, and grid framing guides.
* **64 KB Chunked DataChannel Transfer & SHA-256 Verification (Rule 11):**
  - Upon stopping recording, the phone segments the full-quality MP4/WebM file into 64 KB binary chunks transmitted over an `RTCDataChannel`.
  - Every chunk includes index ordering and a per-chunk SHA-256 hash.
  - The PC reassembles the chunks, computes the complete SHA-256 digest, and cross-references it with the phone's transfer manifest.
  - **Never Delete User Videos:** The phone is strictly forbidden from purging or clearing the local recording until the PC transmits an explicit `ack_verified` receipt.
  - In the event of network disruption, chunk corruption, or checksum mismatch, the phone retains the recording locally and displays a retry prompt.
* **Direct Connection Failure & NAT Fallback:**
  - When restrictive symmetric NAT or corporate firewall policies prevent P2P connectivity (no TURN server), the app provides a plain-language explanation and seamless fallback: records directly onto the phone's local storage with a 1-click option to download or transfer later.
* **Mobile Hardware Resilience:**
  - **Screen WakeLock:** Keeps the mobile display active during recording to prevent device auto-sleep.
  - **Battery & Storage Safeguards:** Detects low battery and storage limits, prompting actionable alerts before starting capture.
  - **Interruption Guard:** Listens to visibility changes (incoming calls, app switching) to gracefully pause or finalize recording without losing captured frames.
* **Automatic Vault Organization:**
  - Received video files on the PC are automatically written to the local vault directory structure (`<Vault_Root>/<YYYY-MM-DD>/<Dispatch|Return>/<AWB>/<AWB>_Video.mp4`) via the File System Access API.
* **Feature Flag:** Controlled via `phoneCompanion` in `src/config/featureFlags.ts`.

---

## 2. Local Data Storage Specification

SABOOT is strictly **offline-first**. No customer videos, photos, or shipping label documents are ever uploaded to any cloud server.

### 2.1 Dexie IndexedDB Schema (`saboot`, with legacy migration from `claimproof`)
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

Database version 2 adds stores for guided return unboxing:
10. `returnVideos`: Return unboxing records indexed by `++id, awb, orderId, condition, startedAt, linkedDispatchRecordingId, partial`.
11. `checklistResults`: Step-by-step checklist ticks indexed by `++id, returnVideoId, awb, stepId, completed, timestamp`.

### 2.2 Local Storage Keys
* `saboot_last_plan (with legacy fallback to claimproof_last_plan)`: Cached plan identifier to prevent UI flashes during startup.

---

## 3. Tier Comparison: Free vs. Paid

| Feature | Free Tier | Starter Station | ClaimRadar Pro ★ | Warehouse 3-Pack |
| :--- | :--- | :--- | :--- | :--- |
| **Pricing (Monthly)** | Free Forever | ₹349 / month | ₹599 / month | ₹1,199 / month |
| **Pricing (Annual)** | Free Forever | ₹2,499 / year *(₹208/mo)* | ₹4,499 / year *(₹375/mo)* | ₹8,999 / year *(₹750/mo)* |
| **Label Cropping & Sorting** | 40 labels / day | Unlimited | Unlimited | Unlimited |
| **AWB Video Recording** | 10 videos / day | Unlimited | Unlimited | Unlimited |
| **Live Timestamp Watermark** | Standard | Burnt-in HD | Burnt-in HD | Burnt-in HD |
| **Picklist & Manifests** | Included (SABOOT seal) | Clean / White-label | Clean / White-label | Clean / White-label |
| **Viral Manifest Footer** | Yes *(Phase 3 loop)* | Removed | Removed | Removed |
| **Auto 4-Photo Collage** | No | No | Yes (T+0.5, 3, 6, 9s) | Yes (T+0.5, 3, 6, 9s) |
| **Claim Deadline Radar** | No | No | Yes (72h / 14d / 30d) | Yes (72h / 14d / 30d) |
| **Return Matcher & Dossier** | No | No | Yes (Side-by-side) | Yes (Side-by-side) |
| **Workstation Licenses** | 1 PC | 1 PC | 1 PC | 3 PCs simultaneous |
| **Phone Companion Scanning** | No | No | No | Yes (Wireless sync) |
| **Support** | Community | Email | Priority Email | Dedicated WhatsApp |

---

## 4. Marketplace Rules & Policy Flags

All marketplace-specific dispute filing windows, official seller help URLs, and claim rubrics are centralized in `src/config/claimWindows.ts`. All default windows are marked **`UNVERIFIED`** (`[needs verification]`) with a visible `"UNVERIFIED - check your seller panel"` badge in ClaimRadar until confirmed by the seller, and can be customized at any time in the Settings screen:
* Meesho SAFE claim window: 72 hours (Source: `https://supplier.meesho.com/support`) *[needs verification]*
* AJIO dispute window: 72 hours (Source: `https://supplier.ajio.com/`) *[needs verification]*
* Snapdeal claim window: 72 hours (Source: `https://sellers.snapdeal.com/`) *[needs verification]*
* Myntra claim window: 72 hours (Source: `https://partner.myntra.com/`) *[needs verification]*
* Flipkart SPF claim window: 14 days (336 hours) (Source: `https://seller.flipkart.com/help/protection-fund`) *[needs verification]*
* Amazon India SAFE-T claim window: 30 days (720 hours) (Source: `https://sellercentral.amazon.in/help/hub/reference/G202103440`) *[needs verification]*
* GlowRoad claim window: 72 hours (Source: `https://glowroad.com/`) *[needs verification]*

---

## 5. Brand Identity & Application Shell

### 5.1 The SABOOT Seal (Logo)
The product mark is the **SABOOT Seal**: a champagne-gold postage-stamp silhouette with perforated edges (12 semicircular notches), an inner official-seal keyline, and a bold on-accent verification check. It encodes the product promise (label + verified proof) in one geometry.
* App implementation: `LogoMark` / `Logo` in `claimproof/src/components/ui/index.tsx` (theme-aware via `--cp-accent-solid` / `--cp-on-accent`, unique SVG mask id per instance via `useId`).
* Standalone assets: `claimproof/public/favicon.svg`, the regenerated PWA/extension icon set (`npm run gen:icons`, see `claimproof/scripts/gen_icons.py`), and the marketing lockup `site/public/logo.svg` (mark + `SABOOT.in` wordmark + `PROOF SUITE` sub-label) used by the website header/footer.
* All logo colors are within the Obsidian & Champagne approved palette enforced by `npm run check:palette`.

### 5.2 Application Shell Behavior
* The desktop shell is `Sidebar` (≥768px) + `TopBar` + `MobileNav` tab rail (<768px).
* `TopBar`, `ClaimUrgencyAlertBanner` and `MobileNav` render inside one sticky cluster in `claimproof/src/App.tsx`, so the mobile tab rail can never slide beneath the translucent header while scrolling.

### 5.3 Page Header Pattern
* `PageHeader` renders the module icon plate, the page title (leading), an optional one-line subtitle, and module identification as a quiet mono tag chip (e.g. `MODULE A`) aligned with the actions. Marketing kicker suffixes (e.g. "FREE FOREVER", "THE PROOF ENGINE") are retired; module IDs A/B/C/D remain the canonical taxonomy from this spec.

