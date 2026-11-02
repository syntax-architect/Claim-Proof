# SABOOT Suite — Release Candidate Bug Bash (BUG_BASH.md)

**Product:** SABOOT Suite (`saboot.in`)  
**Target Build:** 1.0.0-rc  
**Environment:** Desktop Chromium (Chrome 120+, Edge 120+) on Windows 10/11 & macOS  
**Checklist Scope:** 80 Concrete Real-World Warehouse User Actions & Edge-Case Stress Scenarios  
**Execution Instructions:** Execute each action in order. Record results in the blank `Result` column (`[ ] Pass`, `[ ] Fail`, or add notes). Do not skip edge cases.

---

## Quick Reference Summary

| Category | Item IDs | Focus Areas |
| :--- | :---: | :--- |
| **1. Camera Hardware, Webcams & Permissions** | `01 – 09` | Permission denied, unplugging camera, multi-camera switching, camera cover, device busy |
| **2. Barcode Scanning & Scanner Gun Realities** | `10 – 18` | Wrong barcode, retail UPC, partial scan, rapid burst (<50ms), gun suffix, dirty lens |
| **3. Mid-Recording Drops, Tab Close & Crash Guard** | `19 – 26` | Tab close, F5 refresh, navigation away, spacebar bounce, collage crash, emergency save |
| **4. PDF Ingestion: Corrupt, Password & Extreme Files**| `27 – 35` | 0-byte PDF, corrupted xref, encrypted user/owner password, non-PDF file, 50MB PDF |
| **5. 1000-Page PDFs & High-Volume Memory Stress** | `36 – 42` | 1000-page batch, 15 simultaneous PDFs, out-of-order pages, thermal bounding crop |
| **6. Extreme SKUs, Special Symbols & Hindi Text** | `43 – 50` | 150-char SKU, Hindi/Devanagari address, emoji, quotes/slashes, multi-qty stamp |
| **7. Evidence Vault, Slow Disks & Storage Limits** | `51 – 58` | Picker cancelled, slow USB 2.0 thumb drive, disk full (0 bytes), revoked folder permission |
| **8. Clock Manipulation, Timezones & Date Rollovers** | `59 – 64` | Clock forward 1 yr, clock backward, timezone switch to UTC, crossing midnight IST |
| **9. Multi-Tab Concurrency & Parallel Sessions** | `65 – 70` | Two recorder tabs, simultaneous cropping, concurrent license edit, IndexedDB locks |
| **10. Low Battery, Power Throttling & Hardware Sleep** | `71 – 74` | OS battery saver (15fps), system sleep/suspend mid-recording, monitor disconnect |
| **11. Freemium Quota, Paywall & Consumables** | `75 – 78` | 40-label limit block, 10-video limit block, consumables card at 1,500 cumulative |
| **12. Offline Licensing & Soft Device Migration** | `79 – 80` | Device limit migration prompt, invalid token recovery without crash |

---

## Category 1: Camera Hardware, Webcams & Permissions (Items 01–09)

| # | Action / Scenario | Steps to Execute | Expected Result | Result |
| :-: | :--- | :--- | :--- | :-: |
| **01** | **Camera permission explicitly denied by user** | 1. Open browser settings and set Camera to "Block" for `saboot.in`.<br>2. Navigate to `/#recorder`. | Red error banner renders: "Camera access was denied. Please allow camera permissions in your browser settings to record packing proof." A button "Use Synthetic Demo Camera" is visible and operational. | |
| **02** | **Camera permission prompt dismissed / closed without choosing** | 1. Reset camera permissions.<br>2. Open `/#recorder`. When the browser permission dialog appears, press `Escape` or click the dialog close `(X)`. | UI remains stable in "Waiting for camera" state; does not crash with unhandled exception. Clicking "Retry Camera" re-triggers the native permission prompt. | |
| **03** | **Unplugging external USB webcam before app loads** | 1. Unplug all webcams from the PC.<br>2. Open `/#recorder`. | Clear warning: "No camera device found. Please connect a USB webcam or switch to synthetic demo mode." Synthetic mode option functions normally. | |
| **04** | **Unplugging USB webcam during live preview (idle state)** | 1. Connect USB webcam and open `/#recorder`. Verify live feed renders.<br>2. Pull the USB cable out of the PC while idle. | Video stream instantly freezes; pipeline catches track `ended` event; UI updates banner to "Camera disconnected / device unplugged" without freezing or crashing. | |
| **05** | **Unplugging USB webcam mid-recording (actively capturing)** | 1. Start an active recording for `AWB9900112233`.<br>2. At T+4s, pull the USB cable out of the PC. | Emergency crash guard (`triggerEmergencySave`) activates; buffered video footage up to T+4s is finalized and saved to Vault/Downloads; UI displays amber alert: "Emergency save triggered: webcam disconnected." Video file is playable. | |
| **06** | **Switching camera source during active recording** | 1. Attach two webcams (Laptop integrated + External USB).<br>2. Start recording `AWB12345`.<br>3. Open Camera device selector dropdown and switch to Camera 2. | Dropdown is disabled during active recording OR cleanly finalizes current clip before switching devices without corrupting the active MediaRecorder. | |
| **07** | **Camera in-use / locked by another application** | 1. Open Zoom, OBS, or Windows Camera app and lock the webcam.<br>2. Open SABOOT `/#recorder`. | UI detects `NotReadableError` / device busy; displays: "Camera is currently in use by another application. Please close Zoom/OBS and retry." | |
| **08** | **Camera lens physically covered / black screen** | 1. Cover webcam lens completely with opaque tape.<br>2. Scan barcode `AWB111222333`. | Recording starts normally; burnt-in forensic banner is clearly visible across top (white text on dark background); photo thumbnails capture black frames with legible burnt-in text. | |
| **09** | **Rapid toggling between Camera and Synthetic Demo mode** | 1. On `/#recorder`, click "Synthetic Demo" toggle 10 times rapidly (<200ms intervals). | MediaStream tracks cleanly stop and initialize; no orphan canvas loops or memory leak warnings in console; preview stabilizes in chosen mode. | |

---

## Category 2: Barcode Scanning, Scanner Guns & Invalid Barcodes (Items 10–18)

| # | Action / Scenario | Steps to Execute | Expected Result | Result |
| :-: | :--- | :--- | :--- | :-: |
| **10** | **Wrong barcode: scanning retail UPC/EAN instead of AWB** | 1. Open `/#recorder`.<br>2. Scan a retail product UPC barcode (e.g. `8901030865412`). | AWB recorder recognizes the scan as an unindexed parcel; prompts: "AWB not in today's cropped labels — record anyway as unindexed parcel?"; starts recording cleanly without crash. | |
| **11** | **Scanning a non-AWB string (random warehouse serial)** | 1. Scan a serial number barcode containing punctuation: `LOC-BIN-04-B#99`. | String is captured; sanitized for storage path; recording proceeds with barcode burned into forensic banner. | |
| **12** | **Partial / truncated barcode scan** | 1. Scan a partial barcode by pulling the scanner gun away mid-read (e.g. `AWB12` instead of `AWB123456789`). | If length < 4 chars, scanner listener ignores string; if length ≥ 4, starts recording with captured string without app exception. | |
| **13** | **Ultra-rapid scanner gun burst (<50ms between characters)** | 1. Use high-speed laser scanner gun configured for fast baud rate.<br>2. Scan `DELHIVERY987654321`. | HID listener correctly detects burst (<80ms gap), aggregates all characters, strips trailing Enter, and starts recording in <100ms. | |
| **14** | **Scanner gun sending carriage return only (CR vs CRLF vs LF)** | 1. Configure scanner gun suffix to send `\r` (CR) only without `\n`.<br>2. Scan barcode in recorder. | Recorder handles Enter/Return key event uniformly; initiates recording without requiring a mouse click. | |
| **15** | **Scanning barcode while a modal dialog is open** | 1. Open the "Keyboard Shortcuts" modal or "Settings" modal.<br>2. Scan barcode `AWB4455667788` with gun. | Keystrokes do NOT leak into hidden recorder background; modal remains focused; or modal dismisses safely without double-triggering recording. | |
| **16** | **Crinkled, glossy, or damaged barcode scanned via webcam** | 1. Enable camera barcode scanning.<br>2. Hold a crinkled, glossy shipping label under webcam at an angle. | Camera scanner uses offscreen canvas scaling and ZXing fallback loop; detects barcode when properly framed; emits debounce beep; avoids duplicate rapid-fire triggers. | |
| **17** | **Accidental double-scan: scanning same AWB twice in 500ms** | 1. Scan barcode `AWB123456789`.<br>2. Scan the exact same barcode 400ms later. | Debounce filter (`SAME_CODE_DEBOUNCE_MS = 1500ms`) ignores the second scan; existing recording continues uninterrupted. | |
| **18** | **Scanning next AWB while previous recording is saving** | 1. Start recording `AWB111`. Click Stop.<br>2. Within 50ms (while saving spinner is active), scan `AWB222`. | Async queue completes save of `AWB111` to Vault/Downloads, then cleanly transitions to start recording `AWB222` with zero lost footage. | |

---

## Category 3: Mid-Recording Interruptions, Tab Close & Crash Guard (Items 19–26)

| # | Action / Scenario | Steps to Execute | Expected Result | Result |
| :-: | :--- | :--- | :--- | :-: |
| **19** | **Closing browser tab mid-recording** | 1. Start recording `AWB888999`.<br>2. Close the browser tab (Ctrl+W) at T+5s. | `beforeunload` listener triggers `recorderCrashGuard.ts`; active MediaRecorder stops synchronously and flushes final chunks to IndexedDB emergency cache. | |
| **20** | **Hard page reload (F5 / Ctrl+R) mid-recording** | 1. Start recording `AWB777888`.<br>2. Press `F5` at T+4s. | Browser shows unload alert; emergency save executes; on reload, app boots cleanly and past recording metadata exists in Vault/Cache. | |
| **21** | **Navigating to another page via sidebar during recording** | 1. Start recording `AWB555444`.<br>2. Click "SmartLabel Studio" or "Pricing" in sidebar. | App displays confirmation dialog: "Recording in progress. Stop and save before leaving?"; if confirmed, stops and saves before navigating. | |
| **22** | **Rapid Spacebar hammering (Stop/Start bounce)** | 1. Tap `Spacebar` 10 times in 2 seconds on the recorder station. | Keydown handler debounces spacebar; prevents rapid start/stop/start race conditions; UI cleanly completes one cycle. | |
| **23** | **Uncaught JavaScript error thrown in renderer mid-recording** | 1. Trigger an intentional runtime error in React component tree.<br>2. Observe ErrorBoundary. | `ErrorBoundary.tsx` catches error; invokes `triggerEmergencySave()`; saves current video blob to disk/downloads; presents graceful recovery screen with "Reload Station" button. | |
| **24** | **Reaching maximum duration limit (300 seconds / 5 mins)** | 1. Start recording and let it run continuously for 5 minutes. | At T+300s, pipeline automatically triggers `onMaxDurationReached`; stops recording; saves video and collage; resets to "WAITING FOR SCAN". | |
| **25** | **Switching browser tabs (visibilitychange) during recording** | 1. Start recording.<br>2. Switch to another browser tab for 20 seconds.<br>3. Return to SABOOT tab. | Canvas compositor throttle loop keeps timer ticking accurately; recording duration matches wall-clock time; video does not freeze or desync. | |
| **26** | **Flagging return with F2 repeatedly in Return mode** | 1. In Return Unboxing Mode, start recording.<br>2. Press `F2` repeatedly 5 times in 1 second. | Flag status toggles to flagged once; audio cue sounds; does not stack multiple duplicate flag modals upon Stop. | |

---

## Category 4: PDF Ingestion: Corrupt, Password & Extreme Files (Items 27–35)

| # | Action / Scenario | Steps to Execute | Expected Result | Result |
| :-: | :--- | :--- | :--- | :-: |
| **27** | **Uploading a 0-byte PDF file (`empty.pdf`)** | 1. Create a 0-byte file named `empty.pdf`.<br>2. Drag and drop into SmartLabel Studio. | App catches invalid PDF structure; displays non-blocking toast: "empty.pdf is empty or corrupt. Skipped." Workbench remains interactive. | |
| **28** | **Uploading a corrupted PDF (truncated byte stream)** | 1. Take a valid Meesho PDF, delete the last 50% of bytes in a hex editor.<br>2. Upload to SmartLabel Studio. | Parsing engine catches `pdfjs-dist` corrupted stream error; marks file with red badge "Corrupt PDF"; provides "Remove" button; does not crash other files in batch. | |
| **29** | **Uploading a password-protected PDF (User password)** | 1. Encrypt a shipping label PDF with user password `1234`.<br>2. Upload to SmartLabel Studio. | App intercepts `PasswordException`; shows clear error card: "Password-protected PDF. Please decrypt file before uploading." | |
| **30** | **Uploading a permissions-restricted PDF (Owner password)** | 1. PDF encrypted with owner password preventing editing/copying, but openable without password.<br>2. Upload to SmartLabel. | Vector text layer parses successfully; `pdf-lib` extracts pages without prompt; cropped output generated. | |
| **31** | **Uploading a non-PDF file renamed to `.pdf` (e.g. JPEG or EXE)** | 1. Rename an image file `photo.jpg` to `photo.pdf`.<br>2. Drag into drop zone. | Header magic number check (`%PDF-`) fails; user receives clear error: "Invalid PDF format"; drop zone resets. | |
| **32** | **Uploading a massive 50MB PDF with high-res raster backgrounds** | 1. Drop a 50MB shipping label PDF containing 600 DPI graphic scans into SmartLabel Studio. | Progress indicator shows byte loading; memory does not crash; pages process sequentially; progress bar shows `Page X of Y`. | |
| **33** | **Uploading a PDF containing a mix of valid and corrupted pages** | 1. Create a 10-page PDF where page 5 has broken stream objects.<br>2. Process in SmartLabel. | App skips broken page with warning; extracts 9 valid labels into review grid; manifest indicates 9 parcels found. | |
| **34** | **Uploading duplicate PDF files in the same batch** | 1. Drop `meesho_batch_1.pdf` and an identical copy `meesho_batch_1_copy.pdf` simultaneously. | Extracted AWBs are deduplicated in IndexedDB or flagged with "Duplicate AWB detected" badge in review grid. | |
| **35** | **Cancelling / clearing file list during active parsing** | 1. Drop 10 large PDFs.<br>2. While stage indicator reads "Parsing text layer 35%...", click "Clear All" / "Reset". | Async parser cancels cleanly; worker aborts; UI returns to empty drop zone without background console errors. | |

---

## Category 5: 1000-Page PDFs & High-Volume Memory Stress (Items 36–42)

| # | Action / Scenario | Steps to Execute | Expected Result | Result |
| :-: | :--- | :--- | :--- | :-: |
| **36** | **Bulk batch of 1,000 shipping labels in a single PDF** | 1. Generate or procure a 1,000-page marketplace PDF export.<br>2. Drop into SmartLabel Studio. | Batch parses in chunks without browser "Page Unresponsive" popup; review table paginates smoothly; memory consumption stays under 800 MB. | |
| **37** | **Dropping 15 multi-page PDFs simultaneously (Max batch limit)** | 1. Select 15 separate shipping label PDFs (total 250 pages).<br>2. Drag and drop onto workbench all at once. | UI displays "Processing 15 files..."; parses all 15 sequentially or in limited concurrency pool (2-3 workers); renders aggregate label count. | |
| **38** | **Dropping 16 PDFs (exceeding 15-file limit)** | 1. Select 16 PDF files.<br>2. Drop into SmartLabel Studio. | Drop zone shows warning: "Maximum 15 files allowed per batch. First 15 files accepted." | |
| **39** | **Exporting 1,000 cropped 4×6 labels to a single output PDF** | 1. On review grid with 1,000 labels, click "Crop & export 1,000 labels". | `pdf-lib` merges pages incrementally; download triggers; output PDF opens in Acrobat reader with 1,001 pages (1 manifest + 1,000 labels) without truncation. | |
| **40** | **Review grid sorting and filtering under 1,000 loaded items** | 1. With 1,000 labels loaded in review table, filter by courier "Ekart" and sort by SKU. | Review table filters in <100ms; virtualized list scrolls smoothly at 60 fps without UI freeze. | |
| **41** | **Out-of-order page sequences in marketplace PDF** | 1. Upload a PDF where customer invoices and shipping labels are interleaved (Page 1: Label, Page 2: Tax Invoice, Page 3: Label). | Parser extracts shipping labels from pages with recognized carrier barcodes; ignores standalone tax invoice pages without crashing. | |
| **42** | **IndexedDB storage verification after 1,000 label batch** | 1. Complete export of 1,000 labels.<br>2. Check DevTools > Application > IndexedDB > `saboot` (with legacy fallback to `claimproof`) > `orders`. | 1,000 rows indexed with primary key, AWB, SKU, Courier, and Timestamp; recorder can query any AWB in <5ms. | |

---

## Category 6: Extreme SKUs, Special Symbols & Hindi Text (Items 43–50)

| # | Action / Scenario | Steps to Execute | Expected Result | Result |
| :-: | :--- | :--- | :--- | :-: |
| **43** | **Ultra-long SKU string (150+ characters)** | 1. Upload a label with SKU: `WOMEN-ETHNIC-KURTI-COTTON-FLORAL-PRINTED-ANARKALI-SUIT-SET-WITH-DUPATTA-AND-PANT-COMBO-MAROON-XXL-EXTRA-LARGE-SPECIAL-FESTIVE-EDITION-INDIA-2026-REF9928374`. | SKU footer stamp truncates or scales font size dynamically; does not bleed off 4×6 thermal margin; forensic banner on video truncates with ellipsis. | |
| **44** | **SKU containing punctuation and special symbols** | 1. Upload label with SKU: `TSHIRT_#01 (RED/BLU) [M] 100% COTTON & POLY! $99 <SPECIAL>`. | Characters stamped cleanly; XML/HTML tags `<SPECIAL>` are treated as raw text (no XSS injection); `pdf-lib` renders characters or sanitizes safely. | |
| **45** | **Hindi / Devanagari text in customer name and address** | 1. Upload a Meesho label with buyer address in Hindi: `राकेश शर्मा, मकान नं. ४२, शांति नगर, नई दिल्ली`. | Text-layer parser handles UTF-8 characters without crash; vector crop preserves original PDF vector/bitmap glyphs with 100% fidelity. | |
| **46** | **Hindi / Devanagari text in SKU or Product Title** | 1. Upload label where SKU or Title is in Devanagari: `कुर्ता पायजामा कॉम्बो - लाल (L)`. | `pdf-lib` SKU footer stamp falls back to ASCII/Roman transliteration or omits unsupported glyphs without throwing `WinAnsi cannot encode` exception. | |
| **47** | **SKU containing zero spaces (monolithic alphanumeric string)** | 1. Upload label with SKU: `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ`. | Footer text wraps or auto-scales without breaking PDF layout or overflowing outside printable 4×6 bounding box. | |
| **48** | **Multi-Quantity order (`Qty = 5`) stamped with red border** | 1. Upload label where quantity is 5 units.<br>2. Crop 4×6 thermal label. | Bold red perimeter border surrounds label; top banner stamps `MULTI-QTY: 5 UNITS`; manifest notes 5 units for this order. | |
| **49** | **Order with Quantity = 1 (Single unit verification)** | 1. Upload single-unit order label (`Qty: 1`). | Label crops clean with standard black border; NO red multi-qty warning banner is stamped. | |
| **50** | **Order where Quantity field is unparseable / missing** | 1. Upload label with missing quantity text. | Defaults safely to `Qty: 1`; flags item in review table for user verification; no multi-qty red alert. | |

---

## Category 7: Evidence Vault, Slow Disks & Storage Limits (Items 51–58)

| # | Action / Scenario | Steps to Execute | Expected Result | Result |
| :-: | :--- | :--- | :--- | :-: |
| **51** | **Directory picker cancelled / aborted by user** | 1. In Settings, click "Connect Vault Folder".<br>2. In the OS folder picker dialog, click "Cancel". | UI catches `AbortError`; status remains "Unset" or "Downloads Fallback"; displays gentle toast: "Folder selection cancelled. Videos will save via downloads." | |
| **52** | **Saving recording to a slow USB 2.0 thumb drive** | 1. Connect slow USB 2.0 thumb drive. Select as Vault root.<br>2. Record a 60-second video clip. Click Stop & Save. | Writable stream handles write latency asynchronously; UI shows "Saving to vault..."; does not freeze or drop chunks; completes write and confirms. | |
| **53** | **Disk full (0 bytes remaining on drive during save)** | 1. Select a small virtual drive or USB with <1MB free space.<br>2. Attempt to save a 5MB recording. | File write throws `QuotaExceededError`; catch block intercepts; triggers emergency fallback download OR alerts: "Disk full! Please free space or change vault folder." | |
| **54** | **Vault folder deleted / moved externally while app is open** | 1. Connect `C:\MyVault`.<br>2. While app is open, delete `MyVault` folder in Windows Explorer.<br>3. Save a recording. | App catches missing handle error; marks Vault status as "Vault folder missing"; falls back to browser download; recording is preserved. | |
| **55** | **Permission revoked after browser restart** | 1. Set vault folder. Close browser completely. Reopen `/#vault`.<br>2. Observe permission badge. | Vault shows "Permission required". Clicking "Re-grant" opens 1-click browser confirmation; permission restores without re-picking folder. | |
| **56** | **AWB containing illegal filesystem characters on Windows** | 1. Scan / input barcode `AWB:123/456*TEST?`.<br>2. Stop and save recording. | `vaultPaths.ts` sanitizes illegal characters (`:` -> `_`, `/` -> `-`, `*` -> `_`); files write successfully to disk without OS path exceptions. | |
| **57** | **Vault directory path exceeds Windows MAX_PATH (260 characters)** | 1. Set vault folder in a deeply nested path (`C:\Users\...\VeryDeepFolder\...`).<br>2. Save recording. | Path writing succeeds using relative directory handle navigation; files write without path truncation errors. | |
| **58** | **Replaying large video recording from Vault page** | 1. Navigate to `/#vault`. Locate a 4-minute recording.<br>2. Click row to play in modal. | Video streams smoothly via blob URL; scrubbing timeline works; audio plays; collage preview renders beside video. | |

---

## Category 8: Clock Manipulation, Timezones & Date Rollovers (Items 59–64)

| # | Action / Scenario | Steps to Execute | Expected Result | Result |
| :-: | :--- | :--- | :--- | :-: |
| **59** | **System clock set forward 1 year (testing license expiry)** | 1. Activate Starter Station 1-year license.<br>2. Manually advance PC system clock by 400 days in Windows settings.<br>3. Reload SABOOT. | License engine detects `Date.now() > expiresAt`; marks status as `expired`; reverts features to Free Tier (40 labels, 10 recordings); shows banner: "License expired, features limited." | |
| **60** | **System clock set backward to spoof daily quota reset** | 1. Exhaust Free Tier quota (40 labels cropped).<br>2. Move PC clock backward by 1 day.<br>3. Attempt to crop another label. | App checks quota against date key or preserves monotonic usage counter; does not crash; rejects unauthorized tampering if date integrity check triggers. | |
| **61** | **Timezone changed from IST (UTC+5:30) to UTC or US PST** | 1. Change OS timezone setting to `UTC` or `America/Los_Angeles`.<br>2. Open SABOOT and inspect burnt-in timestamp on recorder. | Forensic banner continues to compute and render in **live Indian Standard Time (IST)** via `formatIST()`; does not show UTC or local US time. | |
| **62** | **Active warehouse session crossing midnight IST (23:59 -> 00:01 IST)** | 1. Open app at 23:58 IST. Leave tab open as clock ticks past 00:00 IST.<br>2. Crop a label at 00:02 IST. | Usage counter cleanly increments in the new day's store (`YYYY-MM-DD`); does not crash or corrupt previous day's counters in IndexedDB. | |
| **63** | **Recording started at 23:59:50 IST and ended at 00:00:20 IST** | 1. Start recording a parcel at 23:59:50 IST.<br>2. Stop recording at 00:00:20 IST. | Video file saves into date folder matching session start date (`startedAt`); folder hierarchy remains consistent. | |
| **64** | **ClaimRadar dispute deadline countdown across clock shift** | 1. In ClaimRadar, note a claim with "48 hours remaining".<br>2. Shift system clock forward by 24 hours. | Countdown timer immediately recalculates and reflects "24 hours remaining"; urgent amber/red styling activates accurately. | |

---

## Category 9: Multi-Tab Concurrency & Parallel Sessions (Items 65–70)

| # | Action / Scenario | Steps to Execute | Expected Result | Result |
| :-: | :--- | :--- | :--- | :-: |
| **65** | **Two SABOOT recorder tabs open simultaneously** | 1. Open `/#recorder` in Tab 1 and Tab 2.<br>2. Observe camera feeds. | Browser either shares camera stream cleanly or Tab 2 shows graceful warning: "Camera in use in another tab"; no unhandled WebRTC crash. | |
| **66** | **Simultaneous barcode scan in two tabs** | 1. With two recorder tabs open, scan barcode `AWB123`. | Only the actively focused tab receives and processes the scan; background tab does not double-record or lock database. | |
| **67** | **Tab 1 crops labels while Tab 2 records video** | 1. In Tab 1, export a batch of 50 labels.<br>2. Simultaneously in Tab 2, record an AWB packing clip. | Dexie IndexedDB transactions execute concurrently without `DatabaseClosedError` or transaction deadlock; both actions succeed. | |
| **68** | **Activating license in Tab 1 while Tab 2 is open** | 1. Open Settings in Tab 1; activate a Pro license token.<br>2. Switch to Tab 2 (running on Free tier). | `useLiveQuery` detects IndexedDB update in `license_state`; Tab 2 automatically unlocks Pro features without requiring a manual page refresh. | |
| **69** | **Saving recording with identical AWB in two tabs** | 1. Record `AWB999` in Tab 1 and Tab 2.<br>2. Click Save in both within 1 second. | File system writer handles file overwrite safely or appends timestamp suffix; does not throw unhandled filesystem lock error. | |
| **70** | **Closing Tab 1 while it is performing batch label export** | 1. Start 200-label crop in Tab 1.<br>2. Close Tab 1 mid-process. Check Tab 2. | Tab 2 remains responsive; partial batch in Tab 1 is discarded cleanly; IndexedDB remains uncorrupted. | |

---

## Category 10: Low Battery, Power Throttling & Hardware Sleep (Items 71–74)

| # | Action / Scenario | Steps to Execute | Expected Result | Result |
| :-: | :--- | :--- | :--- | :-: |
| **71** | **OS entering Battery Saver mode during video recording** | 1. Unplug laptop charger; enable Windows "Battery Saver" mode.<br>2. Record a 60-second video on packing station. | Compositor handles reduced framerate (e.g. 15-20 fps); MediaRecorder does not freeze; final video plays at correct speed without pitch shift. | |
| **72** | **Laptop lid closed / system sleep mid-recording** | 1. Start recording `AWB444`.<br>2. Close laptop lid to trigger sleep.<br>3. Open lid 10 seconds later. | Track `ended` or visibility handler triggers emergency save; upon wake, app recovers gracefully without infinite spinning wheel. | |
| **73** | **High CPU load / background virus scan during label crop** | 1. Run a heavy background CPU task (100% CPU load).<br>2. Crop 50 labels in SmartLabel Studio. | Progress bar continues advancing; UI remains responsive; completed PDF is identical and uncorrupted. | |
| **74** | **External monitor disconnected during recording** | 1. Run recorder on external monitor.<br>2. Pull HDMI/DisplayPort cable, forcing window to jump to laptop screen. | Window resize event does not break 1280×720 canvas aspect ratio; burnt-in forensic banner remains intact. | |

---

## Category 11: Freemium Quota, Paywall & Consumables (Items 75–78)

| # | Action / Scenario | Steps to Execute | Expected Result | Result |
| :-: | :--- | :--- | :--- | :-: |
| **75** | **Hitting daily 40-label limit on Free plan** | 1. On Free tier, crop 40 labels throughout the day.<br>2. Attempt to crop 1 additional label. | Paywall modal opens immediately: "Daily Limit Reached (40 labels/day)"; export is blocked; pricing plans displayed clearly. | |
| **76** | **Hitting daily 10-video limit on Free plan** | 1. On Free tier, record and save 10 AWB parcels.<br>2. Attempt to scan an 11th barcode. | Audio error buzz sounds; recorder displays: "Daily free recording quota reached (10/10 AWBs)"; Paywall modal offers instant upgrade. | |
| **77** | **Consumables reorder card triggers at 1,500 cumulative labels** | 1. Accumulate 1,500 cumulative cropped labels across sessions.<br>2. Observe SmartLabel Studio workbench. | High-visibility packing supplies reorder banner appears ("You've shipped 1,500 parcels! Time to restock thermal rolls & tapes."); dismissable. | |
| **78** | **Dismissing Paywall modal with Escape key and backdrop click** | 1. Trigger Paywall modal.<br>2. Press `Escape`. Re-trigger; click dark backdrop. | Modal closes cleanly in both cases; focus returns to the triggering button (`triggerRef`); no trapped focus state. | |

---

## Category 12: Offline Licensing & Soft Device Migration (Items 79–80)

| # | Action / Scenario | Steps to Execute | Expected Result | Result |
| :-: | :--- | :--- | :--- | :-: |
| **79** | **Activating license on 3rd workstation (Soft Device Binding limit)** | 1. Activate Starter license on PC 1 and PC 2.<br>2. Enter same token on PC 3. | Activation modal displays: "License device limit reached (max 2 workstations)". Option "Move license to this device" is offered. Clicking it deauthorizes oldest PC and activates PC 3 cleanly. | |
| **80** | **Pasting truncated / gibberish license key** | 1. Paste `eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.INVALID_DATA.BROKEN` into activation input.<br>2. Click "Activate". | Input validates token format; displays clear inline error: "Invalid license token: check for missing characters"; does not crash or throw unhandled alert. | |

---

## Bug Bash Completion Sign-Off

- **Test Execution Lead:** __________________________________
- **Date Executed:** ________________________________________
- **Total Tested:** 80 / 80
- **Total Passed:** _____ &nbsp;&nbsp;|&nbsp;&nbsp; **Total Failed:** _____ &nbsp;&nbsp;|&nbsp;&nbsp; **Blocked:** _____
- **Critical Blockers Identified:**
  1. __________________________________________________________________________________
  2. __________________________________________________________________________________
  3. __________________________________________________________________________________
- **Release Decision:** &nbsp;&nbsp; `[ ] GO FOR PRODUCTION` &nbsp;&nbsp;&nbsp;&nbsp; `[ ] NO-GO (BLOCKERS MUST BE RESOLVED)`
