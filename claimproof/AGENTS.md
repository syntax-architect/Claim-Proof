# AGENTS.md — Development Rules & Operating Procedures

This document defines the mandatory rules, development principles, and verification workflows that **every developer and AI agent** must strictly follow when working in the **SABOOT Suite** repository.

---

## 1. Core Operating Principles

| # | Rule | Requirement Summary |
|---|---|---|
| **1** | **Read `SPEC.md` First** | Read [SPEC.md](file:///c:/Users/Pc/OneDrive/Desktop/Read/SPEC.md) and related architectural files before writing or editing code. |
| **2** | **Smallest Possible Change** | Keep diffs surgical and focused; do not perform unrelated refactors or formatting changes. |
| **3** | **Dependency Gate** | No new dependency without documenting **Why**, its bundle **Size**, and its **License**. |
| **4** | **Local-First Privacy** | All user data stays on the device unless a feature explicitly specifies otherwise. |
| **5** | **Feature Completeness** | Every feature must have a **feature flag**, **unit tests**, and an **e2e test**. |
| **6** | **Strict i18n** | All user-facing strings must pass through the i18n layer (no hardcoded UI text). |
| **7** | **IST-First Timestamps** | All dates and timestamps are Indian Standard Time (IST) and displayed with the `"IST"` timezone indicator. |
| **8** | **Integer Paise & ₹ Formatting** | Money is stored as integer paise and displayed with the `₹` symbol and Indian numbering grouping (`en-IN`). |
| **9** | **No Invented Marketplace Rules** | Store dispute rules in config with official `sourceUrl` and `lastVerified` date; mark unverified as `UNVERIFIED`. |
| **10** | **Versioned Dexie Migrations** | Database schema changes require a version bump, migration function, and a migration test with legacy data. |
| **11** | **Never Delete User Videos** | Automated cleanup or quotas must never delete user video evidence; deletion is user-only. |
| **12** | **Actionable Plain-Language Errors** | User-facing errors must use plain language and include an actionable next step. |
| **13** | **Pre-Completion Verification** | Run `typecheck`, `lint`, `test`, and `build` before reporting any task done. |
| **14** | **Explicit Unverified Listing** | Always list anything unverified, simulated, or awaiting confirmation. |
| **15** | **Update `SPEC.md`** | Update [SPEC.md](file:///c:/Users/Pc/OneDrive/Desktop/Read/SPEC.md) immediately after implementing each feature. |

---

## 2. Detailed Rule Specifications

### Rule 1: Read `SPEC.md` and Related Files Before Editing
* **Pre-requisite:** Before proposing changes or touching code, read [SPEC.md](file:///c:/Users/Pc/OneDrive/Desktop/Read/SPEC.md) to understand current capabilities, architectural boundaries, and design decisions.
* **Contextual reading:** Check related documentation where applicable:
  - [TEST_PLAN.md](file:///c:/Users/Pc/OneDrive/Desktop/Read/TEST_PLAN.md) for test matrices and regression baselines.
  - [BUG_BASH.md](file:///c:/Users/Pc/OneDrive/Desktop/Read/BUG_BASH.md) for known edge cases and historical issues.
  - Relevant source files and existing tests in `claimproof/src/` or `site/`.
* Never assume requirements or implement divergent features without checking `SPEC.md`.

### Rule 2: Smallest Possible Change
* Keep edits minimal, atomic, and surgical.
* Change only what is directly required to solve the task or implement the requested feature.
* Avoid refactoring untouched modules, reformatting unrelated files, or altering import orders outside the scope of work.
* Maintain documentation integrity: preserve all existing comments, docstrings, and license headers.

### Rule 3: No New Dependency Without Stating Why, Size, and License
* Do not add dependencies to `package.json` unless absolutely unavoidable.
* Whenever a new package is proposed or installed, explicitly document in the PR / task summary:
  1. **Why:** Why existing dependencies or native Web / Node.js APIs (e.g. `crypto`, `Intl`, `fetch`, standard DOM) cannot achieve the goal.
  2. **Size:** Bundle size and install footprint (minified + gzipped weight, e.g. from Bundlephobia).
  3. **License:** Open-source license (must be permissive and compatible: MIT, Apache-2.0, BSD-3-Clause).

### Rule 4: All User Data Stays on the Device
* **SABOOT is strictly local-first and zero-cloud:**
  - Videos, photo collages, shipping label PDFs, AWBs, order IDs, SKUs, customer names, addresses, and phone numbers must NEVER leave the seller's computer.
  - Data must reside exclusively in local IndexedDB (`Dexie`) and the local filesystem vault via Chromium's File System Access API.
* **Telemetry & Error Reporting:**
  - Telemetry is strictly opt-in (`defaultOptIn: false`).
  - Error reporting must automatically scrub sensitive information (local paths, order IDs, AWBs, customer PII) before sending.
  - Only pre-approved milestone event names (`onboarding_completed`, `first_label_export`, `first_recording_saved`, `paywall_viewed`, `purchase_started`) may ever be logged.
* Any network transmission of user data requires an explicit, documented feature requirement in `SPEC.md`.

### Rule 5: Every Feature Has a Feature Flag, Unit Tests, and an E2E Test
* **Feature Flag:** Every new capability must be gated behind a feature flag (configured in `src/config/` or application settings) to allow safe rollout, instant disabling, and isolated testing.
* **Unit Tests:** Must include Vitest unit and integration tests covering the core logic, failure modes, and edge cases.
* **E2E Test:** Must include a Playwright end-to-end test in `e2e/` or `claimproof/e2e/` verifying user interaction, UI transitions, and persisted state.

### Rule 6: All Strings Go Through the i18n Layer (No Hardcoded UI Text)
* No raw, hardcoded user-facing strings in React components, Astro pages, modals, tooltips, or toast alerts.
* All UI strings must be routed through the internationalization (`i18n`) catalog/dictionary.
* Key names must be structured, descriptive, and categorized by feature domain (e.g., `recorder.status.recording`, `claims.deadline.expired`).

### Rule 7: All Dates Are IST and Shown With Timezone
* All timestamps and dates shown to Indian e-commerce sellers must be computed in **Indian Standard Time (IST, `Asia/Kolkata`, UTC+05:30)**.
* Every formatted date/time string rendered to the user must explicitly display the `"IST"` timezone indicator.
  - Standard timestamp: `DD-MMM-YYYY HH:mm:ss IST` (e.g., `31-Oct-2026 16:35:12 IST`).
  - Short format: `DD MMM, h:mm A IST` (e.g., `31 Oct, 4:35 PM IST`).
* Use the centralized date helpers in `src/lib/dateUtils.ts`.

### Rule 8: Money Stored as Integer Paise and Shown as ₹ With Indian Grouping
* **Storage & Computation:**
  - In state, database rows, and API calculations, monetary values must be stored strictly as **integer paise** (e.g., ₹349 is stored as `34900` paise).
  - Never store or manipulate fractional currency floats.
* **Display Formatting:**
  - Prices and amounts must display the Indian Rupee symbol (`₹`).
  - Numbers must follow Indian numbering system grouping (lakhs/crores format, e.g., `₹1,23,456` via `en-IN` locale, not Western `₹123,456`).
  - Use `new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` or dedicated helpers in `src/lib/utils.ts`.

### Rule 9: No Invented Marketplace Rules — Config With Source URL & Verification Date
* Do not invent, guess, or extrapolate marketplace dispute policies, claim filing deadlines, or SLA terms (Meesho, Flipkart, Amazon, AJIO, Myntra, Snapdeal, GlowRoad).
* All marketplace rules must reside in centralized configuration (`src/config/claimWindows.ts`).
* Each marketplace configuration must define:
  - `marketplace`: Identifier string (e.g. `'Meesho'`).
  - `displayName`: Official program name (e.g. `'Meesho SAFE'`).
  - `hours`: Dispute filing window in hours.
  - `sourceUrl`: Direct link to the official marketplace seller documentation or policy page.
  - `lastVerified`: ISO date string (`YYYY-MM-DD`) when verified against official docs, or `'UNVERIFIED'`.
* Any window marked `'UNVERIFIED'` must display an `"UNVERIFIED - check your seller panel"` warning badge in ClaimRadar and Settings.

### Rule 10: Database Changes Need a Versioned Dexie Migration With Test Using Old Data
* Any changes to the Dexie IndexedDB database (`schema.ts`):
  1. Must increment the schema version (`this.version(N + 1)` in `SabootDB`).
  2. Must define an explicit `.upgrade(tx => { ... })` migration handler that migrates existing records without data loss.
* **Mandatory Migration Test:**
  - Add an automated test that initializes the database with the old schema version, inserts legacy test records, executes the migration, and asserts that all data is intact and properly structured under the new schema.

### Rule 11: Never Delete User Videos
* Recorded packing and unboxing videos are legal and financial evidence for marketplace claims and arbitration.
* Automated background routines, daily quota resets, cache purging, or disk cleanup scripts must **NEVER** delete user video files from the local vault.
* Deletion is strictly reserved for deliberate, explicit manual actions taken by the user with a confirmation prompt. The application must never silently delete, overwrite, or drop video evidence.

### Rule 12: Errors Shown to Users Are Plain Language With a Next Step
* Never display uncaught stack traces, cryptic error codes, or technical exceptions in the user interface.
* Error notifications (toasts, banners, dialogs) must be phrased in simple, empathetic, plain language explaining what happened in terms of the seller's workflow.
* Every user-facing error message **must include an actionable next step**, for example:
  - *"We couldn't detect your barcode scanner. Check the USB connection and scan again."*
  - *"Cannot save video: vault folder not selected. Click Settings to pick your storage folder."*
  - *"Camera disconnected mid-recording. We saved your draft clip locally; please reconnect your webcam to continue."*

### Rule 13: Run Typecheck, Lint, Tests, and Build Before Reporting Done
* Before submitting changes or declaring a task complete, run the complete verification suite from the repository root:
  ```bash
  npm run typecheck   # Typechecks claimproof (tsc) and site (astro check)
  npm run lint        # Lints claimproof src
  npm test            # Runs full Vitest suite for claimproof and site
  npm run build       # Builds production bundles for claimproof and site
  ```
* All verification commands must pass with **0 errors and 0 warnings/failures**.

### Rule 14: List Anything Unverified
* At the conclusion of every turn, PR description, or task summary, explicitly provide a **"Unverified Items"** section.
* Disclose any of the following:
  - Marketplace rules or claim windows awaiting official verification.
  - Hardware interactions tested only via synthetic mocks (e.g. physical HID barcode scanner guns, specific webcams, thermal label printers).
  - External endpoints, webhook configurations, or payment links tested with test credentials.
  - Any edge cases or browser constraints not fully verified on real devices.

### Rule 15: Update `SPEC.md` After Each Feature
* [SPEC.md](file:///c:/Users/Pc/OneDrive/Desktop/Read/SPEC.md) is the living source of truth for SABOOT's architecture and capabilities.
* Immediately after completing a feature, bug fix that changes behavior, or configuration update:
  - Document the feature or change in `SPEC.md`.
  - Detail any new IndexedDB tables/fields, feature flags, configuration constants, or UI states.
  - Keep version references and documentation fully aligned with code.

---

## 3. Standard Verification Checklist

Before reporting any work completed, run through this checklist:

```markdown
- [ ] Read SPEC.md and related files before starting
- [ ] Diff is minimal and surgical (no unrelated formatting/refactoring)
- [ ] No new dependencies, or dependency justified with why, size, and license
- [ ] All user data remains on-device (zero unauthorized network calls)
- [ ] Feature gated behind a feature flag
- [ ] Unit tests added/updated and passing
- [ ] E2E test added/updated
- [ ] No hardcoded UI strings (all text routed through i18n)
- [ ] All dates are in IST and labeled with "IST"
- [ ] Money stored as integer paise and displayed as ₹ with Indian grouping
- [ ] Marketplace rules stored in config with source URL and lastVerified
- [ ] Database changes include versioned Dexie migration and migration test
- [ ] User videos are never deleted by automated routines
- [ ] User errors are in plain language with an actionable next step
- [ ] npm run typecheck passes with 0 errors
- [ ] npm run lint passes with 0 errors
- [ ] npm test passes all test suites
- [ ] npm run build completes successfully
- [ ] Unverified items explicitly listed in summary
- [ ] SPEC.md updated to reflect changes
```
