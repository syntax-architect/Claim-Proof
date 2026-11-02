/**
 * SABOOT Brand & Identity Configuration
 * Single source of truth for product branding, database names,
 * storage keys, domains, email addresses, and watermarks.
 * Never hardcode these values across UI or backend services.
 */

export const BRAND = {
  name: 'SABOOT',
  shortName: 'SABOOT',
  legalName: 'SABOOT Suite',
  tagline: 'Every parcel, proven.',
  description:
    'SABOOT.in — local-first SmartLabel SKU+ label cropper & SABOOT AWB barcode-verified packing-video proof studio for Indian e-commerce sellers.',
  appTitle: 'SABOOT Suite — SmartLabel SKU+ & AWB Proof Studio',
  domain: 'saboot.in',
  websiteUrl: 'https://saboot.in',
  supportEmail: 'support@saboot.in',
  whatsapp: '+919876543210',
  whatsappUrl: 'https://wa.me/919876543210',

  // Offline license issuer tokens
  licenseIssuer: 'https://saboot.in',
  legacyLicenseIssuer: 'https://claimproof.in',

  // Local-first persistent storage
  dbName: 'saboot',
  legacyDbName: 'claimproof',
  swCachePrefix: 'saboot',
  legacySwCachePrefix: 'claimproof',

  // Local filesystem vault
  defaultVaultFolder: 'SABOOT_Vault',
  legacyVaultFolder: 'ClaimProof_Vault',

  // Video banner & evidence burn-in strings
  burnedInVideoHeaderPrefix: 'SABOOT VERIFIED UNCUT PROOF',
  videoHeaderPrefix: 'SABOOT VERIFIED UNCUT PROOF',
  videoWatermarkHeader: 'SABOOT VERIFIED UNCUT PROOF',
  videoStationLive: 'SABOOT.in — PACKING STATION LIVE',
  videoFreeWatermark: 'Recorded via SABOOT.in — Free Tier',
  videoVerifiedDispatch: 'VERIFIED DISPATCH · SABOOT.in',

  // Chrome Web Store MV3 extension metadata
  extensionName: 'SABOOT: Shipping Label & Packing Proof Studio',
  extensionShortName: 'SABOOT',
  extensionActionTitle: 'Open SABOOT Studio',
  extensionZipName: 'saboot-extension.zip',
  extensionDescription:
    'Local-first shipping label thermal organizer, barcode-verified packing proof recorder, and dispute evidence studio.',

  // LocalStorage keys for preferences and boot caches
  storageKeys: {
    theme: 'saboot_theme',
    legacyTheme: 'claimproof_theme',
    lastPlan: 'saboot_last_plan',
    legacyLastPlan: 'claimproof_last_plan',
    vaultDirName: 'saboot_vault_dir_name',
    legacyVaultDirName: 'claimproof_vault_dir_name',
    migratedFromClaimproof: 'saboot_migrated_from_claimproof',
    swUpdated: 'saboot_sw_updated',
    claimWindows: 'saboot_claim_windows_hours',
    legacyClaimWindows: 'claimproof_claim_windows_hours',
    telemetryOptIn: 'cp_telemetry_enabled',
    audioMuted: 'cp_beeps_muted'
  }
};

// Named exports per brand configuration contract
export const name = BRAND.name;
export const shortName = BRAND.shortName;
export const domain = BRAND.domain;
export const supportEmail = BRAND.supportEmail;
export const whatsapp = BRAND.whatsapp;
export const tagline = BRAND.tagline;
export const burnedInVideoHeaderPrefix = BRAND.burnedInVideoHeaderPrefix;
export const videoHeaderPrefix = BRAND.videoHeaderPrefix;

export default BRAND;
