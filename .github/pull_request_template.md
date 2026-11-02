## Summary & Motivation
<!-- Provide a concise description of the changes made and the motivation behind them. -->

---

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] CI / Workflow / Dev tooling improvement
- [ ] Documentation update

---

## Offline-First & Privacy Verification
> [!IMPORTANT]
> **SABOOT Zero-Server-Cost Guarantee**: User videos, labels, and customer details must NEVER leave the user's workstation.
- [ ] **Zero Telemetry**: Confirmed via DevTools Network tab that no video chunks, label images, or customer data are uploaded.
- [ ] **Local Storage**: Files remain in IndexedDB / Origin Private File System / local File System Access directory.
- [ ] **Offline Execution**: Verified core features function with network disabled (`offline` mode).

---

## Manual Test Checklist

### 1. SmartLabel Studio (Module A)
- [ ] Uploaded marketplace label PDF (Meesho, Flipkart, Amazon, Myntra, or AJIO).
- [ ] Extracted text layers without raster distortion (AWB, Order ID, SKU, Courier, Qty).
- [ ] Verified 4×6 inch (100×150 mm standard thermal) vector cropping.
- [ ] Confirmed SKU footer stamp (`SKU | Size | Qty | Date`) on bottom margin.
- [ ] Confirmed multi-quantity warning badge (`MULTI-QTY: X UNITS`) on orders where `Qty > 1`.
- [ ] Confirmed Courier Handover Manifest and Picklist summary generation.
- [ ] Free quota enforced (max 40 cropped labels/day on free tier) and opens paywall upon exhaustion.

### 2. AWB Recorder (Module B)
- [ ] Triggered recording via barcode scanner gun (<80ms burst) or camera barcode detection.
- [ ] Live canvas burn-in stamp active: `VERIFIED UNCUT PROOF | AWB | ORDER ID | LIVE IST TIMESTAMP`.
- [ ] 4-slot automated still frame photo capture verified (T+0.5s, T+3s, T+6s, T+9s).
- [ ] Sub-100ms rapid parcel chaining: scanning next barcode auto-saves previous and starts new clip.
- [ ] Return mode tested: press `F2` to flag damaged/swapped parcel and record reason.
- [ ] Emergency crash guard tested: disconnecting camera mid-recording safely preserves buffered media.
- [ ] Free quota enforced (max 10 recorded AWBs/day on free tier).

### 3. ClaimRadar (Module C)
- [ ] Auto-paired return parcel with corresponding dispatch recording.
- [ ] Dispute countdown timer reflects marketplace SLA (Meesho 72h, Flipkart 14d, Amazon 30d).
- [ ] One-click dispute text generation verified (Meesho SAFE-P, Flipkart SPF, Amazon SAFE-T).
- [ ] Dispute evidence package copied or exported.

### 4. Vault & Storage (Module D)
- [ ] Verified folder structure format: `<Vault>/YYYY-MM-DD/<AWB>/<AWB>_packed.webm`.
- [ ] Photo collage file generated: `<AWB>_Photo_Collage.jpg`.
- [ ] In-browser media player successfully plays recorded evidence with audio/video sync.

### 5. Pricing & Licensing
- [ ] UPI QR code and payment intent link generate properly.
- [ ] Genuine offline ES256 JWT license key activates successfully.
- [ ] Tampered, expired, or wrong-issuer license keys display clean error states.
- [ ] Soft workstation binding enforced (max 2 active devices).

### 6. Accessibility & Keyboard Flow
- [ ] `Tab` and `Shift+Tab` navigate interactive elements in logical order with visible focus indicators.
- [ ] `Escape` dismisses modals (Onboarding, Paywall, Evidence, Command Palette).
- [ ] Dark and Light theme contrast verified.

---

## Automated Verification Checklist
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run lint` passes with zero warnings/errors
- [ ] `npm test` passes 100% of unit tests
- [ ] `npm run build` generates production assets without errors
- [ ] `npm run check` passed locally before opening this PR
