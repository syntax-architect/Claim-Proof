# SABOOT Suite — Master Test Plan (TEST_PLAN.md)

**Product:** SABOOT Suite (`saboot.in`)  
**Architecture:** Local-first, zero-server-cost Desktop Progressive Web App (PWA)  
**Target Marketplaces:** Meesho, Flipkart, Amazon India, Myntra, AJIO  
**Version:** 1.0.0-rc  
**Last Updated:** November 2026  

---

## 1. Executive Summary & Risk Ranking

**SABOOT** operates directly inside warehouse packing stations where hardware faults, rugged laser barcode guns, erratic USB connections, thermal printers, and high-velocity packing tables operate under tight deadlines. A failure in evidence capture or file integrity results in direct monetary losses for sellers facing customer return fraud or transit pilferage.

Features are risk-ranked below based on **Severity of Failure** (monetary/data loss), **Hardware/Runtime Complexity**, and **Failure Likelihood**:

| Rank | Feature Area | Risk Level | Primary Failure Impact | Real Hardware Needed? | Real PDFs Needed? | Status |
| :---: | :--- | :---: | :--- | :---: | :---: | :---: |
| **1** | [**AWB Recorder**](#2-feature-1-awb-recorder-risk-rank-1---critical) | **CRITICAL** | Lost or corrupted uncut video evidence; unrecoverable packaging proof during dispute | **Yes** (Webcam, HID Gun) | No | |
| **2** | [**Evidence Vault**](#3-feature-2-evidence-vault-risk-rank-2---critical) | **CRITICAL** | Silent file write drops, File System permission revocation, lost customer videos | **Yes** (NTFS/FAT32 Disk) | No | |
| **3** | [**SmartLabel Studio**](#4-feature-3-smartlabel-studio-risk-rank-3---high) | **HIGH** | Misextracted tracking/SKU, thermal margin truncation, unprinted multi-item warnings | **Yes** (Thermal 4×6 Printer, Gun) | **Yes** (Vendor PDFs) | |
| **4** | [**Licensing Engine**](#5-feature-4-cryptographic-licensing-engine-risk-rank-4---medium-high) | **MED-HIGH** | Legitimate paying sellers locked out of packing table; WebCrypto failure on HTTP | **Yes** (Multi-PC hardware) | No | |
| **5** | [**Offline & Storage**](#6-feature-5-offline-architecture--quota-engine-risk-rank-5---medium) | **MEDIUM** | IndexedDB corruption, midnight quota miscount, privacy/telemetry leaks | No | No | |
| **6** | [**ClaimRadar Pro**](#7-feature-6-claimradar-pro-risk-rank-6---medium) | **MEDIUM** | Expired claim filing deadline, unmatched return-to-dispatch video pairs | No | No | |
| **7** | [**Payments & Checkout**](#8-feature-7-payments--checkout-lifecycle-risk-rank-7---low-medium) | **LOW-MED** | Broken Razorpay payment links, UPI QR rendering failure, webhook drop | **Yes** (Smartphone UPI App) | No | |

---

## 2. Feature 1: AWB Recorder (Risk Rank #1 - CRITICAL)

### 2.1 Description & Implementation
The high-speed packing station (`claimproof/src/components/recorder/VideoRecorderStation.tsx`, `claimproof/src/services/recordingPipeline.ts`, `claimproof/src/services/recorderCrashGuard.ts`). Draws live camera video onto a 1280×720 canvas compositor at 30 fps, overlays a burnt-in forensic banner (`VERIFIED UNCUT PROOF | AWB | ORDER ID | SKU (QTY) | LIVE IST TIMESTAMP`), records at 1.2 Mbps via `MediaRecorder`, auto-extracts 4 timed JPEG stills (T+0.5s, 3s, 6s, 9s) into a 2×2 collage, and supports hands-free chaining via USB/Bluetooth HID barcode scanner gun (<80ms burst) and camera barcode detection.

### 2.2 Concrete Failure Modes
1. **Camera Stream Drops / Unplugged**: External USB webcam disconnected or knocked loose mid-recording.
2. **Buffer Flush Loss on Tab Close**: User closes browser tab, reloads (F5), or navigates away while recording is in progress.
3. **Codec / MIME Incompatibility**: Browser lacks `video/mp4;codecs="avc1.42E01E"` support and fails to fallback gracefully to `video/webm`.
4. **Barcode Chaining Collision**: Scanner gun triggers next AWB within <100ms before previous video stream finishes async finalize, collage generation, and disk write.
5. **Canvas Compositor Drift**: CPU thermal throttling drops `requestAnimationFrame` ticks, resulting in stuttered video or desynchronized millisecond timestamps.
6. **Collage Blank/Black Frames**: Camera hardware latency captures black frame at T+0.5s before sensor exposure settles.
7. **Input Focus Stealing**: Keyboard focus inside another element intercepts scanner gun keystrokes, missing the trigger.
8. **AudioContext Autoplay Block**: Browser blocks start/stop audio confirmation beeps (`claimproof/src/lib/audioBeeps.ts`) due to lack of prior user gesture.

### 2.3 Manual Testing Procedure
1. **Camera Connection & Initialization**:
   - Connect USB webcam. Open `/ #recorder`. Verify camera stream renders in 1280×720 preview.
   - Switch camera input from dropdown. Verify stream transitions cleanly without hanging.
2. **Hands-Free HID Gun Scan Packing Loop**:
   - Point physical USB barcode gun at a printed shipping label (e.g. `AWB9876543210`). Pull trigger.
   - Verify recording starts automatically in <100ms with audible high beep.
   - Verify forensic banner shows `VERIFIED UNCUT PROOF`, exact AWB, Order ID, SKU, and live millisecond IST clock.
   - Verify 4 photo thumbnail slots capture stills at T+0.5s, T+3s, T+6s, and T+9s.
   - Scan next barcode (e.g. `AWB1122334455`). Verify previous recording automatically finalizes and saves, and new recording begins instantly.
3. **Mid-Recording Hardware Disconnect**:
   - While actively recording, pull the USB cable of the webcam.
   - Verify emergency save triggers (`triggerEmergencySave`), captured footage up to disconnect is preserved, and error banner "Camera disconnected / device unplugged" appears.
4. **Return Unboxing Mode (F2 Flagging)**:
   - Toggle "Return Unboxing Mode" (`Alt+R` or switch). Scan return parcel AWB.
   - Press `F2` or click "Flag Bad Return". Stop recording.
   - Verify dispute reason modal appears ("Damaged", "Used/Worn", "Wrong item", "Missing item", "Empty package"). Select reason and save.
   - Verify recording is tagged with flag reason and saved into `<Vault>/<Date>/Return/<AWB>/`.

### 2.4 Automated Test Status & Gap Analysis
- **Existing Automated Tests**:
  - `claimproof/src/services/recordingPipeline.test.ts`:
    - `picks supported mime candidate (mp4 / webm)`
    - `handles camera disconnected mid-recording with emergency save and fallback`
    - `runs full recording lifecycle with simulated camera`
    - `extracts photo snapshots according to schedule`
    - `enforces max duration limit`
  - `claimproof/src/services/recorderCrashGuard.test.ts`:
    - `registers and unregisters active emergency save callback`
    - `triggers emergency save when a crash occurs`
    - `does not re-invoke emergency save on multiple concurrent triggers`
    - `swallows errors thrown by emergency save implementation`
  - `claimproof/src/components/recorder/VideoRecorderStation.test.tsx`:
    - `renders waiting for scan state by default and passes axe audit`
    - `toggles between camera and demo mode`
    - `handles barcode scan input, transitions to recording state, and completes session`
    - `supports return unboxing mode and flagging defective returns`
  - `claimproof/e2e/flows.spec.ts`:
    - `Flow 3: scan a barcode (inject via keyboard HID simulation), record, save, and see it in Vault`
    - `Flow 4: flag a return and see it in ClaimRadar`
  - `claimproof/e2e/keyboard-loop.spec.ts`:
    - `Spacebar stop, Return mode shortcuts`
- **Missing Automated Tests**:
  - `[MISSING]` Unit test for `claimproof/src/lib/hidScanner.ts` verifying burst gap (<80ms), stale timer (500ms), input target suppression, and scanner suffix handling (CR/LF).
  - `[MISSING]` Unit test for `claimproof/src/lib/cameraScanner.ts` verifying native `BarcodeDetector` detection loop, ZXing fallback, and canvas scaling.
  - `[MISSING]` Memory leak stress test: running 50 consecutive recording cycles in headless Chromium and measuring detached DOM nodes / Blob leaks.

### 2.5 Data & Fixtures Needed
- Printed barcode sheets (Code 128, Code 39, QR code) with diverse AWB lengths (10 to 24 characters).
- Synthetic test video tracks (`canvas.captureStream(30)`).
- Mock `MediaStreamTrack` triggering `ended` and `mute` events.

### 2.6 Hardware & Real PDF Requirements
- **Hardware Required**: **YES**. Physical USB / Bluetooth HID laser barcode scanner gun, real external USB webcam / document camera.
- **Real Marketplace PDFs Required**: Optional for video recording itself, but required to test end-to-end AWB matching from SmartLabel memory.

| Test Case ID | Test Case Title | Type | Target Component | Real H/W? | Real PDF? | Status |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: |
| `REC-01` | Live webcam initialization & 720p 30fps canvas rendering | Manual | `VideoRecorderStation.tsx` | **Yes** | No | |
| `REC-02` | Hands-free recording trigger via USB HID scanner gun (<80ms burst) | Manual | `hidScanner.ts` | **Yes** | No | |
| `REC-03` | Forensic banner stamp precision (AWB, Order, SKU, live IST ms) | Auto/Man | `recordingPipeline.ts` | No | No | |
| `REC-04` | 4-photo collage capture schedule (T+0.5s, 3s, 6s, 9s) | Auto/Man | `recordingPipeline.ts` | No | No | |
| `REC-05` | Rapid sub-100ms parcel chaining (scan next AWB while recording) | Manual | `VideoRecorderStation.tsx` | **Yes** | No | |
| `REC-06` | Camera cable pull mid-recording emergency save recovery | Manual | `recorderCrashGuard.ts` | **Yes** | No | |
| `REC-07` | Tab close (`beforeunload`) and browser refresh mid-recording recovery | Manual | `recorderCrashGuard.ts` | No | No | |
| `REC-08` | Return Unboxing mode toggle and `F2` defective return flagging | Auto/Man | `VideoRecorderStation.tsx` | No | No | |
| `REC-09` | Web Audio API beep playback verification across user interactions | Manual | `audioBeeps.ts` | **Yes** | No | |
| `REC-10` | 50-parcel continuous recording memory stability (no tab crash) | Manual | `recordingPipeline.ts` | **Yes** | No | |

---

## 3. Feature 2: Evidence Vault (Risk Rank #2 - CRITICAL)

### 3.1 Description & Implementation
The zero-cloud local storage engine (`claimproof/src/services/vaultWriter.ts`, `claimproof/src/lib/vaultPaths.ts`, `claimproof/src/pages/VaultPage.tsx`). Persists video recordings and JPEG collages directly to the seller's local file system using the Chromium File System Access API (`showDirectoryPicker`, `FileSystemDirectoryHandle.getDirectoryHandle()`, `createWritable()`). Fallback to standard browser downloads if the API is unsupported or permissions are denied. Maintains metadata in Dexie IndexedDB (`recordings` and `media_cache` tables).

### 3.2 Concrete Failure Modes
1. **Permission Revocation**: Browser revokes folder access upon restart; write attempt throws `NotAllowedError`.
2. **Disk Full (`QuotaExceededError`)**: Target drive has insufficient disk space mid-write, resulting in a zero-byte or corrupt MP4 file.
3. **Invalid Path Characters**: AWBs or SKUs containing illegal filesystem characters (`: * ? " < > | \ /`) causing filesystem write exceptions on Windows NTFS.
4. **Downloads Fallback Block**: Browser pop-up blocker suppresses multi-file downloads (`.mp4` + `.jpg`) when running in fallback mode.
5. **Slow Disk Backpressure**: Writing video chunks to a slow USB 2.0 drive blocks the UI thread or causes memory bloat.
6. **IndexedDB Media Cache Bloat**: Storing temporary replay blobs in IndexedDB exhausts browser storage quota.

### 3.3 Manual Testing Procedure
1. **Vault Folder Connection**:
   - Go to Settings / Vault. Click "Select Folder". Select a directory (e.g., `D:**SABOOT**Vault`).
   - Grant readwrite permission when prompted by Chrome.
   - Verify Vault status indicates "Connected" with folder name.
2. **Folder Layout Verification**:
   - Record and save an outbound dispatch parcel (`AWB123456789`).
   - Open File Explorer / Finder. Verify file path:
     `<Vault_Root>/<YYYY-MM-DD>/Dispatch/AWB123456789/AWB123456789_Video.mp4`  
     `<Vault_Root>/<YYYY-MM-DD>/Dispatch/AWB123456789/AWB123456789_Photo_Collage.jpg`
   - Record and save a return parcel (`AWB987654321`). Verify path:
     `<Vault_Root>/<YYYY-MM-DD>/Return/AWB987654321/AWB987654321_Video.mp4`
3. **Permission Recovery After Browser Restart**:
   - Completely exit Chrome/browser process. Reopen **SABOOT**.
   - Go to Vault page. If status shows "Permission required", click "Re-grant" and verify single-click restoration.
4. **Downloads Fallback Mode**:
   - Open SABOOT in Firefox or an incognito window where `showDirectoryPicker` is unavailable.
   - Save a recording. Verify video file and photo collage download cleanly to user's standard Downloads folder without error.
5. **Vault Search & Video Playback**:
   - Open `/ #vault`. Type an AWB in search bar.
   - Click recording row. Verify video player opens and plays back recording; verify 4-photo collage preview renders.

### 3.4 Automated Test Status & Gap Analysis
- **Existing Automated Tests**:
  - `claimproof/src/services/vaultWriter.test.ts`:
    - `reports unset when no handle exists`
    - `connectVault sets downloads mode when showDirectoryPicker is unavailable`
    - `saveRecordingFiles writes video and photo to directory handle structure`
    - `falls back to downloads when directory handle throws`
  - `claimproof/src/lib/vaultPaths.test.ts`:
    - `sanitizes AWB for filesystem safety`
    - `formats vaultSubPath correctly for dispatch and return`
    - `produces video and photo filenames`
- **Missing Automated Tests**:
  - `[MISSING]` Component test for `VaultPage.tsx` (date filtering, marketplace filtering, search by SKU, empty state, pagination).
  - `[MISSING]` Media cache LRU cleanup test (purging IndexedDB blobs older than 7 days).
  - `[MISSING]` Disk full simulation test (`QuotaExceededError` handling).

### 3.5 Data & Fixtures Needed
- Mock `FileSystemDirectoryHandle` and `FileSystemFileHandle` with mock `createWritable()`.
- Sample 2MB video blobs and 300KB JPEG collage blobs.

### 3.6 Hardware & Real PDF Requirements
- **Hardware Required**: **YES**. Local NTFS / FAT32 physical hard drive or USB thumb drive to test real OS permissions, write speeds, and path depth limits.
- **Real Marketplace PDFs Required**: No.

| Test Case ID | Test Case Title | Type | Target Component | Real H/W? | Real PDF? | Status |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: |
| `VLT-01` | Connect local directory via `showDirectoryPicker` | Manual | `vaultWriter.ts` | **Yes** | No | |
| `VLT-02` | Verify exact folder directory tree `<Date>/<Type>/<AWB>/` | Auto/Man | `vaultPaths.ts` | **Yes** | No | |
| `VLT-03` | Browser permission re-query and re-grant on session reload | Manual | `vaultWriter.ts` | No | No | |
| `VLT-04` | Non-Chromium / Firefox fallback to browser downloads | Auto/Man | `vaultWriter.ts` | No | No | |
| `VLT-05` | Filename sanitization against Windows forbidden chars (`/\:*"<>\|`) | Auto | `vaultPaths.ts` | No | No | |
| `VLT-06` | Vault UI search, filtering by date/courier, and instant video replay | Manual | `VaultPage.tsx` | No | No | |
| `VLT-07` | Write failure handling on low disk space (`QuotaExceededError`) | Manual | `vaultWriter.ts` | **Yes** | No | |
| `VLT-08` | IndexedDB `media_cache` eviction and storage consumption control | Manual | `mediaLibrary.ts` | No | No | |

---

## 4. Feature 3: SmartLabel Studio (Risk Rank #3 - HIGH)

### 4.1 Description & Implementation
The browser-based shipping label parser, vector cropper, and warehouse manifest engine (`claimproof/src/services/pdfLabelProcessor.ts`, `claimproof/src/components/smartlabel/SmartLabelWorkbench.tsx`, `claimproof/src/services/labelDataStore.ts`). Uses `pdfjs-dist` to parse text layers without raster distortion and `pdf-lib` to crop labels into 4×6 thermal, 4×4, or 4-per-A4 formats. Stamps bold SKU footer strips (`SKU | Size | Qty | Date`), injects high-visibility red `MULTI-QTY: X UNITS` guard borders, sorts labels by courier partner, prepends aggregate picklists & handover manifests, and populates IndexedDB order memory.

### 4.2 Concrete Failure Modes
1. **Scanned / Flat Image PDFs**: Uploading a PDF that contains only a scanned bitmap image (zero textual vector stream) fails text extraction.
2. **Rotated / Landscape Pages**: Marketplace labels oriented at 90° or 270° causing incorrect bounding box calculations or sideways printing.
3. **Multi-Quantity Guard Failure**: Missing `Qty > 1` due to regex variations across marketplace layouts (e.g. `2N`, `Qty: 2`, `Total Qty: 02`), leading to short-shipment penalties.
4. **Marketplace PDF Layout Shift**: Meesho, Flipkart, Amazon, Myntra, or AJIO altering their PDF structure, causing AWB or SKU extraction to return `UNKNOWN`.
5. **Devanagari / Unicode Crash in pdf-lib**: Buyer address or SKU containing Hindi/Devanagari characters crashing `pdf-lib` StandardFonts (`WinAnsi cannot encode glyph`).
6. **Thermal Barcode Truncation**: Bounding box crop cutting off barcode quiet zones or carrier routing codes, rendering labels unreadable by logistics hubs.
7. **Batch Out-of-Memory**: Processing 15 bulk PDFs (500+ pages total) in browser memory causing tab crash.
8. **Courier Sorting & Manifest Math Mismatch**: Handover manifest parcel/unit summary failing to match actual generated pages.

### 4.3 Manual Testing Procedure
1. **Batch Upload & Parsing**:
   - Drag and drop 5 multi-label PDFs from Meesho, Flipkart, and Amazon India into SmartLabel Studio.
   - Verify progress bar advances through parsing stages.
   - Inspect review table: verify accurate extraction of AWB, Order ID, SKU, Courier, and Marketplace.
2. **Crop Preset Formatting**:
   - Select 4×6 inch thermal preset. Click "Crop & export".
   - Open resulting PDF in Adobe Acrobat / PDF viewer. Verify exact page dimensions (100×150 mm / 288×432 pt).
   - Check bottom margin for high-visibility SKU footer stamp (`SKU | Size | Qty | IST Date`).
3. **Multi-Quantity Guard Verification**:
   - Upload a label where order quantity is 2 or more.
   - Inspect output PDF: verify bold red border and prominent `MULTI-QTY: X UNITS` stamp along the top/bottom margin.
4. **Picklist & Handover Manifest Audit**:
   - Verify Page 1 of the exported PDF is the Courier Handover Manifest.
   - Check carrier breakdown (e.g. Ekart: 12 parcels, Delhivery: 8 parcels, Valmo: 15 parcels). Sum counts and verify 100% mathematical consistency with physical labels.
5. **Physical Thermal Print & Scan Test**:
   - Send exported 4×6 PDF to a physical thermal label printer (TSC / TVS / Rollo / Zebra).
   - Verify no barcode clipping, crisp 203 DPI contrast, and scan printed label with a barcode gun.
6. **Free Tier Quota Check**:
   - Under Free Tier, attempt to crop 41 labels in a single day.
   - Verify Paywall Modal appears: "Free plan allows 40 cropped labels per day".

### 4.4 Automated Test Status & Gap Analysis
- **Existing Automated Tests**:
  - `claimproof/src/services/pdfLabelProcessor.test.ts`:
    - `extractAwb detects Meesho, Flipkart, Amazon, Ekart, Delhivery, Valmo formats`
    - `detectMarketplace classifies Meesho, Flipkart, Amazon, Myntra, AJIO`
    - `detectMultiQty identifies multiple units and returns correct count`
    - `parsePdfBuffer accurately extracts labels from sample PDFs`
    - `processes label files into 4x6 cropped vector PDF with manifest`
  - `claimproof/src/test/labelParser.test.ts`:
    - `parses Meesho sample PDF buffer`
  - `claimproof/src/test/goldenFixtures.test.ts`:
    - `discovers and verifies every fixture PDF against its expected.json` (Amazon, Flipkart, Meesho, missing fields, rotated label, scanned image only)
  - `claimproof/src/test/regexHelpers.property.test.ts`:
    - `property-based fuzzing of AWB and SKU extractor patterns`
  - `claimproof/src/components/smartlabel/SmartLabelWorkbench.test.tsx`:
    - `renders initial empty drop zone with accessible file controls`
    - `renders review table when files are loaded and parsed successfully`
    - `enforces quota check and blocks export when daily free quota is reached`
    - `renders parse error state with retry action when processing fails`
- **Missing Automated Tests**:
  - `[MISSING]` Real-world Myntra and AJIO fixture tests (current fixtures cover Amazon, Flipkart, Meesho).
  - `[MISSING]` Password-protected PDF upload test.
  - `[MISSING]` Unicode / Devanagari text sanitization test in `pdf-lib` stamping.
  - `[MISSING]` 500-page bulk PDF memory stress test.

### 4.5 Data & Fixtures Needed
- **Real Marketplace PDFs**: Real raw seller PDF downloads from Meesho, Flipkart, Amazon India, Myntra, AJIO.
- Corrupted PDF fixture (truncated byte stream).
- Password-encrypted PDF fixture (owner and user passwords).
- Scanned raster image label PDF fixture (`tests/fixtures/scanned_image_only/label.pdf`).
- 90-degree rotated label PDF fixture (`tests/fixtures/rotated_label/label.pdf`).

### 4.6 Hardware & Real PDF Requirements
- **Real Marketplace PDFs Required**: **YES (CRITICAL)**. Synthetic test fixtures do not represent live marketplace layout changes, vector shifts, font encodings, or actual multi-courier routing codes.
- **Hardware Required**: **YES**. Physical 4×6 thermal printer (TSC, TVS, Rollo) and handheld barcode gun to verify physical print quality and scannability.

| Test Case ID | Test Case Title | Type | Target Component | Real H/W? | Real PDF? | Status |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: |
| `LBL-01` | Multi-file batch drag-and-drop parsing (15 files) | Auto/Man | `SmartLabelWorkbench.tsx` | No | **Yes** | |
| `LBL-02` | Accurate AWB, Order ID, and SKU extraction on Meesho | Auto/Man | `pdfLabelProcessor.ts` | No | **Yes** | |
| `LBL-03` | Accurate AWB, Order ID, and SKU extraction on Flipkart | Auto/Man | `pdfLabelProcessor.ts` | No | **Yes** | |
| `LBL-04` | Accurate AWB, Order ID, and SKU extraction on Amazon India | Auto/Man | `pdfLabelProcessor.ts` | No | **Yes** | |
| `LBL-05` | Myntra and AJIO PDF layout parsing validation | Manual | `pdfLabelProcessor.ts` | No | **Yes** | |
| `LBL-06` | Rotated page (90° / 270°) detection and upright crop | Auto/Man | `pdfLabelProcessor.ts` | No | **Yes** | |
| `LBL-07` | Scanned raster image PDF detection and user warning | Auto/Man | `pdfLabelProcessor.ts` | No | **Yes** | |
| `LBL-08` | Multi-quantity guard (`Qty > 1`) red border & badge stamping | Auto/Man | `pdfLabelProcessor.ts` | No | **Yes** | |
| `LBL-09` | Courier Handover Manifest generation and mathematical audit | Auto/Man | `pdfLabelProcessor.ts` | No | **Yes** | |
| `LBL-10` | 4×6 thermal print output margin and barcode scan check | Manual | `SmartLabelWorkbench.tsx` | **Yes** | **Yes** | |
| `LBL-11` | Unicode / Hindi address text handling without font crash | Manual | `pdfLabelProcessor.ts` | No | **Yes** | |
| `LBL-12` | 40-label daily free quota enforcement and paywall trigger | Auto/Man | `quota.ts` | No | No | |

---

## 5. Feature 4: Cryptographic Licensing Engine (Risk Rank #4 - MEDIUM-HIGH)

### 5.1 Description & Implementation
The offline-first, zero-server verification licensing engine (`claimproof/src/lib/licenseKeys.ts`, `claimproof/src/services/licenseService.ts`, `claimproof/scripts/issue_license.mjs`). Validates ES256 compact JWTs on-device using WebCrypto and a bundled public JWK (`P-256`, `LICENSE_JWT_KID = 'cp-dev-1'`). Requires zero server round-trips. Enforces plan features (Starter, ClaimRadar Pro, Warehouse 3-Pack), expiry timestamps, and soft device binding allowing up to 2 workstations per license with a 1-click migration path.

### 5.2 Concrete Failure Modes
1. **WebCrypto Insecure Context Failure**: Running over unencrypted HTTP (e.g. `http://192.168.1.50:5173` on warehouse LAN) causes `crypto.subtle` to be `undefined`.
2. **Device Fingerprint Volatility**: Hardware driver update, browser version bump, or plugging into an external monitor altering WebGL renderer/screen resolution, triggering spurious `DEVICE_MISMATCH`.
3. **Clock Rollback Bypass**: Seller intentionally moving system clock back 1 year to bypass token expiration (`exp`).
4. **Hostile Workstation Lockout**: Paying seller upgrading their PC hits 2-device limit without a functional "Move license to this device" option.
5. **Key Tampering / Downgrade**: Malicious user modifying plan payload (`"plan": "warehouse"`) while keeping existing signature, or altering token header to `alg: "none"`.
6. **Expired Subscription Grace Lapse**: UI failing to downgrade to Free tier after license expiry and 3-day grace period lapse.

### 5.3 Manual Testing Procedure
1. **Valid Token Generation & Activation**:
   - Generate valid token: `node scripts/issue_license.mjs --plan claimradar --cid SELLER_101`.
   - In **SABOOT** Settings / Pricing page, paste token into activation box. Click "Activate License".
   - Verify immediate activation toast: "License activated · ClaimRadar Pro".
   - Verify ClaimRadar Pro features unlock immediately (Return unboxing mode, 4-photo collage, ClaimRadar tab).
2. **Offline Verification Check**:
   - Turn off Wi-Fi / disconnect ethernet.
   - Enter another valid token (`--plan warehouse`).
   - Verify activation succeeds completely offline with 0 network calls.
3. **Invalid Token Rejection**:
   - Paste malformed token, expired token, or token with modified signature.
   - Verify specific error messages: "Invalid license token", "Expired license token", or "Invalid signature".
4. **Soft Device Binding & License Migration**:
   - Generate token bound to a specific foreign fingerprint (`--fp mock-foreign-hw-id`).
   - Paste token into app. Verify error: "This token is bound to a different workstation".
   - Verify "Move license to this device" button is visible and accessible. Click it.
   - Verify token activates successfully, binding current machine fingerprint.
5. **Deactivation & Plan Reversion**:
   - Click "Deactivate License" in Settings. Confirm modal.
   - Verify app immediately reverts to Free Tier quotas (40 labels/day, 10 recordings/day).

### 5.4 Automated Test Status & Gap Analysis
- **Existing Automated Tests**:
  - `claimproof/src/services/licenseService.test.ts` (17 tests):
    - `validates valid ES256 token and returns ok: true`
    - `rejects token with invalid signature`
    - `rejects expired token`
    - `rejects token with missing or empty customer ID`
    - `rejects token with wrong issuer or unknown plan`
    - `enforces soft device binding and respects maxDevices limit`
    - `allows moving license to current device when moveDevice is true`
    - `computes stable device fingerprint`
    - `falls back to FNV-1a hash when crypto.subtle is unavailable`
    - `planHasFeature correctly gates features for free, starter, claimradar, warehouse`
  - `claimproof/src/components/paywall/PaywallModal.test.tsx`:
    - `handles license key entry and successful activation`
    - `displays validation and error messages for empty, invalid, and device-mismatch tokens`
  - `claimproof/e2e/flows.spec.ts`:
    - `Flow 5: enter a valid and an invalid license key`
- **Missing Automated Tests**:
  - `[MISSING]` System clock rollback detection test (preventing license bypass by setting system time back).
  - `[MISSING]` Multi-seat Warehouse pack concurrent device activation test.

### 5.5 Data & Fixtures Needed
- Cryptographic keypair generated via `scripts/gen_license_keys.mjs`.
- Test JWT tokens for Starter, ClaimRadar, Warehouse plans.
- Expired tokens, corrupted tokens, tampered signature tokens.

### 5.6 Hardware & Real PDF Requirements
- **Hardware Required**: **YES**. At least 2 distinct physical PCs with different hardware (GPU/display/platform) to test real WebGL fingerprint stability and device migration.
- **Real Marketplace PDFs Required**: No.

| Test Case ID | Test Case Title | Type | Target Component | Real H/W? | Real PDF? | Status |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: |
| `LIC-01` | Valid ES256 offline JWT token verification & activation | Auto/Man | `licenseService.ts` | No | No | |
| `LIC-02` | Offline activation verification with zero network connectivity | Manual | `licenseService.ts` | No | No | |
| `LIC-03` | Tampered token / invalid signature rejection | Auto/Man | `licenseService.ts` | No | No | |
| `LIC-04` | Expired token rejection with explicit user feedback | Auto/Man | `licenseService.ts` | No | No | |
| `LIC-05` | Soft device binding limit enforcement (max 2 workstations) | Auto/Man | `licenseService.ts` | **Yes** | No | |
| `LIC-06` | "Move license to this device" 1-click migration execution | Auto/Man | `licenseService.ts` | **Yes** | No | |
| `LIC-07` | Fallback fingerprint hash generation on non-secure HTTP LAN | Auto | `licenseService.ts` | No | No | |
| `LIC-08` | License deactivation and immediate fallback to Free Tier | Auto/Man | `licenseService.ts` | No | No | |

---

## 6. Feature 5: Offline Architecture & Quota Engine (Risk Rank #5 - MEDIUM)

### 6.1 Description & Implementation
The offline-first operational foundation (`claimproof/src/db/schema.ts`, `claimproof/src/lib/quota.ts`, `claimproof/src/lib/dateUtils.ts`, `claimproof/src/services/telemetry.ts`). Powered by Dexie IndexedDB across 9 local stores. Tracks daily consumables and enforces Free Tier limits (40 labels/day, 10 recordings/day) reset daily at midnight IST (`Asia/Kolkata`). Guarantees zero sensitive data leakage and zero network calls during core operations.

### 6.2 Concrete Failure Modes
1. **Network Leakage During Processing**: PDF parsing, cropping, or recording making unexpected external network calls (violating privacy guarantee).
2. **Midnight IST Timezone Glitch**: Daily quota reset miscalculating IST offset (`UTC+05:30`), resetting at midnight UTC or double-counting usage.
3. **IndexedDB Concurrent Lock**: Opening **SABOOT** in two browser tabs causing IndexedDB transaction lock or schema contention.
4. **Telemetry Leak of PII**: Un-scrubbed local file paths (`C:\Users\...`), AWBs, or customer phone numbers leaking into error logs.
5. **Consumables Alert Loop**: Reorder alert card (`cumulative_labels >= 1500`) appearing on every single label export.

### 6.3 Manual Testing Procedure
1. **Zero-Network Audit**:
   - Open Chrome DevTools Network tab. Clear all entries.
   - Perform complete daily loop: drag-and-drop label PDF, crop 4×6, record AWB packing clip, save to vault, open ClaimRadar.
   - Verify 0 network requests occurred across all actions.
2. **Quota Reset at Midnight IST**:
   - Seed today's usage to 40 labels and 10 recordings. Verify paywall blocks further actions.
   - Advance OS clock past midnight IST (e.g. 00:05 AM IST). Refresh page.
   - Verify usage counters cleanly roll over to 0/40 and 0/10.
3. **Multi-Tab Concurrency**:
   - Open SABOOT in Tab A and Tab B.
   - Crop 10 labels in Tab A. Switch to Tab B; verify quota counter reflects 10 used.
   - Start recording in Tab A; verify Tab B does not corrupt camera feed or crash IndexedDB.
4. **Data Scrubber Audit**:
   - Enable telemetry in Settings (`opt-in`).
   - Trigger an intentional test error containing a file path (`C:\Users\Admin\Desktop\AWB123456.pdf`) and phone number (`+919876543210`).
   - Inspect logged telemetry payload: verify file path is redacted to `[PATH]`, AWB to `[AWB]`, and phone to `[PHONE]`.

### 6.4 Automated Test Status & Gap Analysis
- **Existing Automated Tests**:
  - `claimproof/src/test/brandMigration.test.ts`:
    - `migrates legacy localStorage keys to new saboot_* keys without data loss`
    - `migrates legacy IndexedDB "claimproof" database to "saboot" database`
    - `accepts legacy https://claimproof.in tokens as valid alongside https://saboot.in`
  - `claimproof/src/test/offlinePrivacy.test.ts`:
    - `guarantees label parsing, vector cropping, and manifest generation make 0 network calls and leak 0 user data`
    - `ensures sensitive order data is scrubbed before reaching any error logger`
  - `claimproof/src/lib/quota.test.ts`:
    - `checks label quota for free and paid plans`
    - `consumes recording quota correctly`
    - `tracks cumulative labels and consumables alert threshold`
  - `claimproof/src/lib/dateUtils.test.ts`:
    - `formats IST timestamp accurately`
    - `generates stable IST date keys (YYYY-MM-DD)`
  - `claimproof/src/services/telemetry.test.ts`:
    - `scrubs file paths, AWBs, order IDs, SKUs, phones, and emails`
    - `enforces strictly opt-in telemetry`
  - `claimproof/e2e/flows.spec.ts`:
    - `Flow 7: go offline and confirm the app still loads and works`
- **Missing Automated Tests**:
  - `[MISSING]` Playwright multi-tab concurrency test (2 tabs sharing IndexedDB).
  - `[MISSING]` PWA Service Worker offline cache update prompt test (`UpdatePrompt.test.tsx` exists for unit, but service worker registration loop is unverified in e2e).

### 6.5 Data & Fixtures Needed
- Mock IndexedDB usage records.
- Telemetry test payloads with synthetic PII strings.

### 6.6 Hardware & Real PDF Requirements
- **Hardware Required**: No.
- **Real Marketplace PDFs Required**: No.

| Test Case ID | Test Case Title | Type | Target Component | Real H/W? | Real PDF? | Status |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: |
| `OFF-01` | Zero-network assertion during full label cropping & video recording | Auto/Man | `offlinePrivacy.test.ts` | No | No | |
| `OFF-02` | Daily quota midnight IST rollover calculation | Auto/Man | `quota.ts`, `dateUtils.ts` | No | No | |
| `OFF-03` | Multi-tab IndexedDB concurrent read/write stability | Manual | `schema.ts` | No | No | |
| `OFF-04` | Consumables reorder alert at 1,500 cumulative labels | Auto/Man | `quota.ts` | No | No | |
| `OFF-05` | Client-side sensitive data scrubber (AWB, SKU, Path, PII redaction) | Auto | `telemetry.ts` | No | No | |
| `OFF-06` | PWA offline asset loading and navigation with network severed | Auto/Man | `flows.spec.ts` | No | No | |
| `OFF-07` | Brand migration: legacy `claimproof_*` keys, DB, and token compatibility | Auto | `brandMigration.test.ts` | No | No | |

---

## 7. Feature 6: ClaimRadar Pro (Risk Rank #6 - MEDIUM)

### 7.1 Description & Implementation
Dispute proof management studio (`claimproof/src/services/claimEngine.ts`, `claimproof/src/lib/claimRules.ts`, `claimproof/src/components/claims/ClaimRadarDashboard.tsx`, `claimproof/src/components/claims/ClaimEvidenceModal.tsx`). Tracks marketplace claim filing deadlines with live countdown timers (Meesho SAFE: 72h, Flipkart SPF: 14 days, Amazon SAFE-T: 30 days, AJIO/Snapdeal/Myntra: 72h). Cross-references Return Unboxing recordings against original outbound Dispatch packing clips within a 10-day lookback window, generating 1-click tailored dispute text for seller support tickets.

### 7.2 Concrete Failure Modes
1. **Marketplace Window Drift**: Marketplace updates policy (e.g. Meesho shortens window to 48 hours), but app displays outdated 72h window. *(Note: All windows are marked `[needs verification]` in SPEC.md).*
2. **Evidence Matcher Failure**: Outbound dispatch video exists in vault, but fails to match return claim due to letter case mismatch (`awb123` vs `AWB123`) or order ID missing.
3. **Lookback Window Truncation**: Return delivered after 11 days in transit is excluded by hardcoded 10-day lookback window (`TEN_DAYS_MS`).
4. **Dispute Template Variable Corruption**: Missing recording metadata generates broken dispute text (`undefined`, `NaNs`).
5. **Claim Status State Drop**: Claim status updates (`pending` -> `filed` -> `approved`/`rejected`) lost on page refresh.

### 7.3 Manual Testing Procedure
1. **Flagged Return Intake**:
   - In AWB Recorder, switch to "Return Unboxing Mode". Scan return parcel AWB.
   - Press `F2` to flag. Select "Damaged" with note "Customer returned used item with tear".
   - Save recording. Navigate to `/ #claims`.
2. **Deadline Radar Verification**:
   - Verify claim appears in "Pending Claims" list.
   - Verify countdown timer ticks down in real-time.
   - Verify badge color coding: Green (>48h remaining), Amber (12–48h), Red (<12h urgent).
3. **Dispute Preparation & Side-by-Side Matching**:
   - Click "Prepare Evidence" on the pending claim.
   - Verify modal opens showing outbound Dispatch video alongside Return Unboxing video.
   - Verify 4-photo collage comparison renders.
4. **Marketplace Dispute Text Generation**:
   - Select Meesho / Flipkart / Amazon tab.
   - Verify generated dispute text contains exact AWB, Order ID, burnt-in timestamp citations, and policy-specific arguments.
   - Click "Copy Dispute Text". Paste into text editor; verify complete and clean formatting.
5. **Status Lifecycle**:
   - Click "Mark as Filed". Verify claim moves from "Pending" to "Filed".
   - Reload page; verify updated status persists.

### 7.4 Automated Test Status & Gap Analysis
- **Existing Automated Tests**:
  - `claimproof/src/lib/claimRules.test.ts` (13 tests):
    - `returns correct claim window hours for Meesho (72), Flipkart (336), Amazon (720)`
    - `calculates claim deadlines accurately from timestamp`
    - `builds valid ClaimItem from return flag detail`
  - `claimproof/src/services/claimEngine.test.ts` (7 tests):
    - `finds dispatch evidence within 10-day window by AWB`
    - `falls back to orderId match when AWB does not match`
    - `generates marketplace-tailored dispute text for Meesho, Flipkart, Amazon`
    - `updates claim status and dispute text`
  - `claimproof/src/components/claims/ClaimRadarDashboard.test.tsx`:
    - `renders active claim with countdown, prepare action, and passes axe`
    - `switches status filter and empty states`
  - `claimproof/e2e/flows.spec.ts`:
    - `Flow 4: flag a return and see it in ClaimRadar`
- **Missing Automated Tests**:
  - `[MISSING]` Component test for `ClaimEvidenceModal.tsx` (dual video player controls, copy button event, axe accessibility).
  - `[MISSING]` Lookback boundary test for shipments in transit >10 days.

### 7.5 Data & Fixtures Needed
- Paired Dispatch and Return recording records in Dexie IndexedDB.
- Synthetic claims with expiring deadlines (<1 hour, 24 hours, expired).

### 7.6 Hardware & Real PDF Requirements
- **Hardware Required**: No.
- **Real Marketplace PDFs Required**: No.

| Test Case ID | Test Case Title | Type | Target Component | Real H/W? | Real PDF? | Status |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: |
| `CLM-01` | Return flag ingestion into Dexie `claims` table | Auto/Man | `claimRules.ts` | No | No | |
| `CLM-02` | Deadline countdown precision for Meesho (72h), Flipkart (14d), Amazon (30d) | Auto/Man | `claimRules.ts` | No | No | |
| `CLM-03` | Dispatch-to-return side-by-side evidence matching by AWB | Auto/Man | `claimEngine.ts` | No | No | |
| `CLM-04` | Order ID fallback matching when AWB differs | Auto | `claimEngine.ts` | No | No | |
| `CLM-05` | Tailored dispute dossier text generation across marketplaces | Auto/Man | `claimEngine.ts` | No | No | |
| `CLM-06` | Status updates (`pending` -> `filed` -> `approved`) persistence | Auto/Man | `ClaimRadarDashboard.tsx`| No | No | |

---

## 8. Feature 7: Payments & Checkout Lifecycle (Risk Rank #7 - LOW-MEDIUM)

### 8.1 Description & Implementation
Launch checkout, UPI payments, and webhook lifecycle engine (`claimproof/src/config/plans.ts`, `claimproof/src/config/subscriptionConfig.ts`, `claimproof/src/lib/upi.ts`, `claimproof/supabase/functions/razorpay-webhook/pure.ts`). Phase 1 operates via direct Razorpay Payment Links / Payment Page (`VITE_RAZORPAY_PAYMENT_URL`) and manual offline license issuance (`scripts/issue_license.mjs`). Automated recurring Razorpay Subscriptions are milestone-gated (`MIN_MANUAL_SALES_FOR_SUBSCRIPTIONS = 20`). Webhook handler supports HMAC-SHA256 signature verification, idempotency deduplication, and a 3-day grace period.

### 8.2 Concrete Failure Modes
1. **Broken Payment Links**: Unconfigured or malformed `VITE_RAZORPAY_PAYMENT_URL_*` environment variables causing 404 on checkout click.
2. **UPI Deep Link Encoding Error**: Improperly percent-encoded `upi://pay` strings failing on mobile apps (e.g. PhonePe/Google Pay rejecting `+` instead of `%20`).
3. **Webhook Replay / Idempotency Failure**: Duplicate delivery of `subscription.charged` causing duplicate license rows or expiry miscalculation.
4. **Premature Subscription Activation**: System activating recurring subscriptions before the 20 manual sales milestone is validated.
5. **Webhook Signature Mismatch**: Raw body formatting differences rejecting valid Razorpay webhook deliveries.
6. **Refund Revocation Failure**: Customer issued a refund on Razorpay, but webhook fails to revoke active license token.

### 8.3 Manual Testing Procedure
1. **Direct Buy Button Checkout**:
   - On `/ #pricing` or Paywall Modal, click "Buy Now" on Starter Station (₹349/mo) and ClaimRadar Pro (₹599/mo).
   - Verify Razorpay payment page opens in a new tab with correct pre-filled plan amounts.
2. **UPI QR Code Scan**:
   - Open Paywall UPI payment tab.
   - Scan generated UPI QR code using a real smartphone running Google Pay or PhonePe.
   - Verify payee VPA (`saboot@upi`), payee name, and exact amount display correctly on phone screen.
3. **Manual License Delivery Fulfillment**:
   - Execute admin script: `node scripts/issue_license.mjs --plan claimradar --cid customer@store.in`.
   - Verify signed ES256 token output.
   - Paste token into customer app; verify immediate activation.
4. **Razorpay Webhook Edge Function Verification**:
   - Run Supabase test suite: `npm run test:supabase`.
   - Verify all 28 webhook unit tests pass (HMAC validation, grace period calculation, subscription events).

### 8.4 Automated Test Status & Gap Analysis
- **Existing Automated Tests**:
  - `claimproof/supabase/functions/razorpay-webhook/pure.test.ts` (28 tests):
    - `verifies authentic Razorpay webhook HMAC-SHA256 signatures`
    - `rejects tampered or forged signatures`
    - `calculates expiry with 3-day grace period (subscription.activated, subscription.charged)`
    - `handles subscription.halted, subscription.cancelled, payment.failed`
    - `revokes license on refund.processed / refund.created`
    - `deduplicates events by event_id for idempotency`
  - `claimproof/src/lib/upi.test.ts` (3 tests):
    - `builds NPCI-compliant UPI deep link with %20 encoding`
    - `renders scannable UPI QR code PNG data URL`
  - `claimproof/src/components/paywall/PaywallModal.test.tsx`:
    - `renders modal with pricing and plan toggles`
- **Missing Automated Tests**:
  - `[MISSING]` E2E test verifying external checkout link opening with correct query parameters.
  - `[MISSING]` Milestone gate UI test (`isSubscriptionsUnlocked`).

### 8.5 Data & Fixtures Needed
- Razorpay webhook payload fixtures (from official Razorpay documentation).
- Valid test webhook secret key.

### 8.6 Hardware & Real PDF Requirements
- **Hardware Required**: **YES**. Real smartphone with Indian UPI app (PhonePe / GPay) to verify scannability of UPI QR codes.
- **Real Marketplace PDFs Required**: No.

| Test Case ID | Test Case Title | Type | Target Component | Real H/W? | Real PDF? | Status |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: |
| `PAY-01` | Razorpay payment link redirect per plan | Manual | `plans.ts` | No | No | |
| `PAY-02` | UPI deep link intent NPCI encoding (`%20` spaces) | Auto | `upi.ts` | No | No | |
| `PAY-03` | UPI QR code generation and smartphone camera scanning | Manual | `upi.ts` | **Yes** | No | |
| `PAY-04` | Razorpay webhook HMAC-SHA256 signature verification | Auto | `razorpay-webhook/pure.ts` | No | No | |
| `PAY-05` | 3-day grace period extension on recurring charges | Auto | `razorpay-webhook/pure.ts` | No | No | |
| `PAY-06` | Webhook idempotency deduplication by `event_id` | Auto | `razorpay-webhook/pure.ts` | No | No | |
| `PAY-07` | License revocation on `refund.processed` / `refund.created` | Auto | `razorpay-webhook/pure.ts` | No | No | |
| `PAY-08` | Milestone gate check: recurring subscriptions locked <20 sales | Auto/Man | `subscriptionConfig.ts` | No | No | |

---

## 9. Comprehensive Hardware & PDF Requirements Matrix

To ensure warehouse-grade reliability, testing cannot rely solely on synthetic browser mocks. The table below lists all physical prerequisites:

| Requirement Category | Specific Hardware / Asset Item | Mandatory For | Justification |
| :--- | :--- | :--- | :--- |
| **Real Marketplace PDFs** | **Meesho** shipping label batch PDF (multi-page, Valmo/Shadowfax) | `LBL-01`, `LBL-02`, `LBL-08` | Validates vector layer, AWB/SKU regex, and multi-quantity detection on live layouts. |
| **Real Marketplace PDFs** | **Flipkart** shipping label batch PDF (Ekart Logistics, multi-item) | `LBL-01`, `LBL-03`, `LBL-08` | Tests Ekart barcode quiet zones, order ID formats, and rotation flags. |
| **Real Marketplace PDFs** | **Amazon India** Easy Ship / ATS label PDF | `LBL-01`, `LBL-04`, `LBL-08` | Tests Amazon 4×6 crop bounds, tracking IDs, and SKU footer placement. |
| **Real Marketplace PDFs** | **Myntra & AJIO** logistics vendor label PDFs | `LBL-01`, `LBL-05` | Validates courier parsing and manifest grouping for fashion platforms. |
| **Real Hardware** | **USB / BT Laser Barcode Scanner Gun** (e.g. TVS, Honeywell, Zebra) | `REC-02`, `REC-05`, `LBL-10` | Validates <80ms keyboard burst listener, suffix characters (CR/LF), and crinkled label scans. |
| **Real Hardware** | **External USB Webcam / Document Camera** (720p / 1080p) | `REC-01`, `REC-06`, `REC-10` | Validates autofocus on small barcodes, 30fps canvas compositing, and cable-pull crash guard. |
| **Real Hardware** | **Thermal Shipping Label Printer 4×6** (TSC, TVS, Rollo, Zebra) | `LBL-10` | Confirms printable margins, absence of edge clipping, and thermal barcode scannability. |
| **Real Hardware** | **2+ Distinct Physical PCs / Laptops** (different GPUs & screens) | `LIC-05`, `LIC-06` | Validates WebGL hardware fingerprint uniqueness, stability, and license migration. |
| **Real Hardware** | **Physical Hard Drive / Slow USB 2.0 Thumb Drive** | `VLT-01`, `VLT-07` | Verifies File System Access API write speeds, buffer backpressure, and low-disk handling. |
| **Real Hardware** | **Smartphone with Indian UPI App** (PhonePe / Google Pay / Paytm) | `PAY-03` | Validates NPCI deep link compatibility and QR code scanning in physical warehouse lighting. |

---

## 10. Master Test Execution Tracking Matrix

*(Status column left blank for manual verification by test leads)*

| Area | Test ID | Description | Automated Exists? | Hardware / Real PDF | Status |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **Recorder** | `REC-01` | Live webcam 720p 30fps canvas preview | Component Unit | **Yes** (Webcam) | |
| | `REC-02` | Hands-free recording trigger via USB HID scanner gun | E2E (Simulated) | **Yes** (HID Gun) | |
| | `REC-03` | Forensic watermark banner timestamp & metadata | Unit | No | |
| | `REC-04` | 4-photo collage schedule (T+0.5s, 3s, 6s, 9s) | Unit | No | |
| | `REC-05` | Rapid parcel chaining (<100ms next AWB scan) | **Missing** | **Yes** (HID Gun) | |
| | `REC-06` | Camera cable pull mid-recording emergency save | Unit | **Yes** (Webcam) | |
| | `REC-07` | Tab close (`beforeunload`) mid-recording recovery | Unit | No | |
| | `REC-08` | Return Unboxing mode & `F2` defective flagging | E2E | No | |
| | `REC-09` | Web Audio API beep sound cues | **Missing** | **Yes** (Audio) | |
| | `REC-10` | 50-parcel continuous recording memory stability | **Missing** | **Yes** (Webcam) | |
| **Vault** | `VLT-01` | Connect folder via `showDirectoryPicker` | Unit | **Yes** (Disk) | |
| | `VLT-02` | Verify directory structure `<Date>/<Type>/<AWB>/` | Unit | **Yes** (Disk) | |
| | `VLT-03` | Browser permission re-grant prompt on reload | **Missing** | No | |
| | `VLT-04` | Firefox / non-Chromium downloads fallback | Unit | No | |
| | `VLT-05` | Filename sanitization against Windows forbidden chars | Unit | No | |
| | `VLT-06` | Vault UI search, filtering, and video playback | **Missing** | No | |
| | `VLT-07` | Write failure on low disk space (`QuotaExceededError`)| **Missing** | **Yes** (Disk) | |
| | `VLT-08` | IndexedDB `media_cache` LRU blob eviction | **Missing** | No | |
| **Labels** | `LBL-01` | Multi-file batch drag-and-drop parsing (15 files) | Component Unit | **Yes** (Real PDFs) | |
| | `LBL-02` | Meesho AWB, Order ID, and SKU extraction | Unit + Fixture | **Yes** (Meesho PDF) | |
| | `LBL-03` | Flipkart AWB, Order ID, and SKU extraction | Unit + Fixture | **Yes** (Flipkart PDF)| |
| | `LBL-04` | Amazon India AWB, Order ID, SKU extraction | Unit + Fixture | **Yes** (Amazon PDF) | |
| | `LBL-05` | Myntra and AJIO PDF layout parsing validation | **Missing** | **Yes** (Myntra/AJIO) | |
| | `LBL-06` | Rotated page (90° / 270°) detection and upright crop | Unit + Fixture | **Yes** (Real PDFs) | |
| | `LBL-07` | Scanned raster image PDF detection & user alert | Unit + Fixture | **Yes** (Real PDFs) | |
| | `LBL-08` | Multi-quantity guard (`Qty > 1`) red border & badge | Unit | **Yes** (Real PDFs) | |
| | `LBL-09` | Courier Handover Manifest generation & math audit | Unit | **Yes** (Real PDFs) | |
| | `LBL-10` | 4×6 thermal print margin & barcode scannability | **Missing** | **Yes** (Printer/Gun) | |
| | `LBL-11` | Unicode / Hindi address text handling without crash | **Missing** | **Yes** (Real PDFs) | |
| | `LBL-12` | 40-label daily free quota enforcement | Unit + E2E | No | |
| **License** | `LIC-01` | Valid ES256 offline JWT verification & activation | Unit + E2E | No | |
| | `LIC-02` | 100% offline activation with zero network | E2E | No | |
| | `LIC-03` | Tampered token / invalid signature rejection | Unit + E2E | No | |
| | `LIC-04` | Expired token rejection with explicit user feedback | Unit | No | |
| | `LIC-05` | Soft device binding limit enforcement (max 2 PCs) | Unit | **Yes** (2+ PCs) | |
| | `LIC-06` | "Move license to this device" 1-click migration | Unit | **Yes** (2+ PCs) | |
| | `LIC-07` | Fallback fingerprint hash on insecure HTTP LAN | Unit | No | |
| | `LIC-08` | License deactivation & immediate fallback to Free | Unit + E2E | No | |
| **Offline** | `OFF-01` | Zero-network assertion during full daily loop | Unit | No | |
| | `OFF-02` | Daily quota midnight IST rollover calculation | Unit | No | |
| | `OFF-03` | Multi-tab IndexedDB concurrent read/write stability | **Missing** | No | |
| | `OFF-04` | Consumables reorder alert at 1,500 cumulative labels | Unit | No | |
| | `OFF-05` | Client-side sensitive data scrubber (PII redaction) | Unit | No | |
| | `OFF-06` | PWA offline asset loading and navigation | E2E | No | |
| | `OFF-07` | Brand migration: legacy keys, DB, and token compatibility | Unit | No | |
| **Claims** | `CLM-01` | Return flag ingestion into Dexie `claims` table | Unit | No | |
| | `CLM-02` | Deadline countdown precision across marketplaces | Unit + Component | No | |
| | `CLM-03` | Dispatch-to-return side-by-side evidence matching | Unit | No | |
| | `CLM-04` | Order ID fallback matching when AWB differs | Unit | No | |
| | `CLM-05` | Tailored dispute dossier text generation | Unit | No | |
| | `CLM-06` | Status updates (`pending` -> `filed` -> `approved`) | Unit + Component | No | |
| **Payments**| `PAY-01` | Razorpay payment link redirect per plan | Manual | No | |
| | `PAY-02` | UPI deep link intent NPCI encoding (`%20` spaces) | Unit | No | |
| | `PAY-03` | UPI QR code generation and smartphone camera scan | Unit | **Yes** (Smartphone) | |
| | `PAY-04` | Razorpay webhook HMAC-SHA256 signature verification | Edge Unit | No | |
| | `PAY-05` | 3-day grace period extension on recurring charges | Edge Unit | No | |
| | `PAY-06` | Webhook idempotency deduplication by `event_id` | Edge Unit | No | |
| | `PAY-07` | License revocation on `refund.processed` | Edge Unit | No | |
| | `PAY-08` | Milestone gate check: subscriptions locked <20 sales | Edge Unit | No | |
