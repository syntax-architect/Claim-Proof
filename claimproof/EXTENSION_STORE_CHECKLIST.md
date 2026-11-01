# Chrome Web Store Submission & Store Listing Checklist

This checklist documents the exact Chrome Web Store Developer Dashboard entries, privacy certifications, screenshot requirements, and copy guidelines for the **ClaimProof** Manifest V3 extension.

---

## 1. Extension Identity & Trademark Compliance

> [!IMPORTANT]
> **Trademark Safeguard Rule:** Under Chrome Web Store Intellectual Property and Impersonation policies, extension names must never include third-party brand names as the extension title or imply endorsement.

* **Extension Title:** `ClaimProof — Shipping Label & Packing Evidence Studio`
* **Short Name:** `ClaimProof`
* **Extension Version:** `1.0.0`
* **Category:** Productivity / Workflow & Planning
* **Default Language:** English

---

## 2. Store Copy (Fact-Checked & Verified)

### 2.1 Short Description (Max 132 characters)
```text
Local-first thermal shipping label organizer, barcode packing video proof recorder, and dispute evidence preparation studio.
```

### 2.2 Detailed Description
```text
ClaimProof is a local-first workstation studio designed for Indian e-commerce sellers shipping orders across major marketplaces. It combines high-speed shipping label preparation with tamper-evident, uncut barcode-verified packing and unboxing video evidence.

KEY CAPABILITIES:

1. SmartLabel Studio (Shipping Label Organizer)
• Batch drag-and-drop vector processing for shipping label PDFs.
• Vector cropping to standard 4×6 inch thermal printer format.
• Automatic SKU, size, color, and quantity footer stamping along bottom margins.
• Multi-quantity guard highlights orders with Qty > 1 to prevent packing omissions.
• Generates warehouse picklists and carrier handover manifests.

2. ClaimProof AWB Recorder (Forensic Packing Station)
• Hands-free parcel chaining triggered by physical USB/Bluetooth barcode scanner guns or webcams.
• Records uncut MP4/WebM video proof with an indelible live IST forensic timestamp banner burned into the video.
• Automatically captures and stitches 4 timed still frames into a 2×2 forensic photo collage mid-recording.
• Dual modes for outbound order packing (Dispatch) and return parcel unboxing (Return).
• Built-in demo camera allowing full evaluation without physical webcam hardware.

3. ClaimRadar (Dispute Evidence Studio)
• Organize damaged, missing, or swapped returns by marketplace dispute filing windows (e.g. 72-hour / 14-day / 30-day windows).
• Automatically matches outbound Dispatch videos with Return unboxing videos for the same AWB.
• Generates structured dispute claim text and exports photo collages and video files for seller support tickets.

4. 100% Private Local Storage (Evidence Vault)
• Zero-cloud storage: saves high-definition video evidence directly to your local computer drive via Chromium File System Access API.
• Structured chronological local folder hierarchy: <Vault>/YYYY-MM-DD/Dispatch/<AWB>/.
• Works completely offline after initial load.

TRANSPARENT PRICING & PRIVACY:
• Free Forever tier includes 40 label crops/day and 10 video recordings/day.
• Optional paid workstation licenses available for high-volume warehouses.
• Strictly local-first: your customer orders, labels, and warehouse videos are NEVER uploaded to any remote server.
```

---

## 3. Privacy Practices Form (Chrome Web Store Developer Dashboard)

### 3.1 Single Purpose Declaration
* **Single Purpose Statement:**
  > "ClaimProof provides a local-first packing proof video recorder and shipping label organizer that operates completely on the seller's computer without transmitting order data or videos to remote servers."

### 3.2 Host Permissions & Permissions Review
* **Host Permissions:** **NONE** (`host_permissions: []`). The extension does not read, modify, or inject content into any marketplace or external website.
* **Ambient Permissions:** **NONE** (`permissions: []`).
* **Camera Access:** Not requested as an ambient extension privilege. Camera access is requested strictly **at runtime** via standard browser prompts (`navigator.mediaDevices.getUserMedia`) when the seller opens the AWB Recorder station.
* **Local Storage:** Utilizes browser-native IndexedDB and Chromium File System Access API directly within the app tab.

### 3.3 Data Usage Questionnaire
| Data Category | Collected? | Explanation for Reviewer |
| :--- | :---: | :--- |
| **Personally Identifiable Information (PII)** | **NO** | No seller names, customer names, addresses, or phone numbers are collected or transmitted. |
| **Health / Financial / Payment Data** | **NO** | Payments are fulfilled externally via Razorpay Payment Link in a standard browser tab. Token verification is performed 100% offline using a built-in ES256 public key. |
| **Authentication Information** | **NO** | No passwords, session tokens, or external logins required. |
| **Personal Communications** | **NO** | No messaging or email data accessed. |
| **Location Data** | **NO** | No geolocation accessed. |
| **Web Browsing History** | **NO** | Zero host permissions; no URL monitoring or browsing history accessed. |
| **User Activity** | **NO** | App activity remains local. Optional anonymous milestone telemetry (if explicitly enabled in Settings) transmits only 5 generic non-identifying flags and is disabled by default. |
| **Website Content** | **NO** | Does not read DOM or cookies of any third-party website. |

### 3.4 Reviewer Justifications & Certifications
* [x] **Adherence to Limited Use Policy:** The developer certifies that all data processing is strictly for the declared single purpose.
* [x] **No Sale of Data:** The developer certifies that user data is never sold or transferred to data brokers.
* [x] **No Lending or Credit Evaluation:** The developer certifies data is not used for creditworthiness evaluation.

---

## 4. Screenshots & Promotional Assets Checklist

Chrome Web Store requires 1280×800 px or 640×400 px JPEG/PNG screenshots with zero borders and genuine application content.

> [!CAUTION]
> **Privacy Rule for Screenshots:** NEVER capture screenshots containing real seller shipping labels, real customer names, phone numbers, or actual delivery addresses. Always use the synthetic demo labels generated in `public/samples/`.

* [ ] **Screenshot 1 — SmartLabel Studio (1280×800 px):**
  - **Subject:** Batch PDF label upload workbench showing 4×6 vector thermal crop preview with stamped SKU footer strip.
  - **Headline Overlay (optional):** *High-Speed 4×6 Thermal Vector Cropping & SKU Stamping*
* [ ] **Screenshot 2 — AWB Recorder Dispatch Station (1280×800 px):**
  - **Subject:** Video packing station with live feed, green barcode scanner armed indicator, and burnt-in IST timestamp banner.
  - **Headline Overlay (optional):** *Barcode-Verified Packing Proof with Burnt-in IST Timestamps*
* [ ] **Screenshot 3 — Automated 4-Photo Forensic Collage (1280×800 px):**
  - **Subject:** High-resolution 2×2 photo collage generated mid-recording showing parcel packaging stages.
  - **Headline Overlay (optional):** *Automatic 4-Photo Forensic Collage for Fast Dispute Filing*
* [ ] **Screenshot 4 — ClaimRadar Deadline Dashboard (1280×800 px):**
  - **Subject:** Live countdown timers tracking marketplace dispute filing deadlines and 1-click dossier generator.
  - **Headline Overlay (optional):** *Real-Time Dispute Radar & Evidence Packaging*
* [ ] **Screenshot 5 — Evidence Vault & Folder Layout (1280×800 px):**
  - **Subject:** Local directory hierarchy showing zero-cloud hard drive storage organized by Date, Mode, and AWB.
  - **Headline Overlay (optional):** *100% Private, Zero-Cloud Local Hard Drive Storage*
* [ ] **Store Icon (128×128 px PNG):**
  - Located at `public/icons/icon-128.png`.
* [ ] **Small Promo Tile (440×280 px PNG):**
  - Clean ClaimProof mark on dark navy background (`#0B0E14`).

---

## 5. Build & Packaging Instructions

To create the clean submission archive:

```bash
# 1. Run the test and build suite
npm run check

# 2. Package the Chrome Web Store MV3 ZIP archive
npm run build:extension
```

The resulting package will be generated at:
`dist-extension/claimproof-extension.zip`

Upload this ZIP file directly to the **Chrome Web Store Developer Dashboard** under **Package > Upload new package**.

