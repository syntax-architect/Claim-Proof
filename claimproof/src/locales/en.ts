/**
 * English dictionary for SABOOT Suite.
 * Living source of truth for all user-facing strings across the application.
 */

export const en = {
  // ==========================================
  // Common Actions & Generic UI
  // ==========================================
  'common.close': 'Close',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.saved': 'Saved successfully',
  'common.copy': 'Copy',
  'common.copied': 'Copied to clipboard',
  'common.download': 'Download',
  'common.create': 'Create',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.retry': 'Retry',
  'common.openFolder': 'Open Folder',
  'common.refresh': 'Refresh',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.done': 'Done',
  'common.confirm': 'Confirm',
  'common.view': 'View',
  'common.open': 'Open',
  'common.status': 'Status',
  'common.date': 'Date',
  'common.actions': 'Actions',
  'common.filter': 'Filter',
  'common.clear': 'Clear',
  'common.all': 'All',
  'common.loading': 'Loading…',
  'common.unverified': 'UNVERIFIED',
  'common.unverifiedBadge': 'UNVERIFIED, check your seller panel.',
  'common.enabled': 'Enabled',
  'common.disabled': 'Disabled',
  'common.search': 'Search',
  'common.active': 'Active',
  'common.inactive': 'Inactive',
  'common.select': 'Select',

  // ==========================================
  // Navigation & Shell
  // ==========================================
  'nav.overview': 'Overview',
  'nav.labels': 'Smart Labels',
  'nav.recorder': 'Pack & Unbox',
  'nav.claims': 'ClaimRadar',
  'nav.vault': 'Evidence Vault',
  'nav.pricing': 'Pricing',
  'nav.settings': 'Settings',
  'nav.privacy': 'Privacy Policy',
  'nav.terms': 'Terms of Service',
  'nav.refund': 'Refund Policy',
  'nav.support': 'Support',
  'nav.brandSubtitle': 'Evidence Station for Sellers',

  // ==========================================
  // TopBar
  // ==========================================
  'topbar.searchPlaceholder': 'Search evidence & claims (Ctrl+K)',
  'topbar.searchTooltip': 'Search evidence & claims (Ctrl+K)',
  'topbar.search': 'Search',
  'topbar.themeDark': 'Switch to light mode',
  'topbar.themeLight': 'Switch to dark mode',
  'topbar.langToggle': 'Switch language (हिंदी / English)',
  'topbar.labelsToday': 'labels today',
  'topbar.videosToday': 'videos today',
  'topbar.vaultConnected': 'Vault',
  'topbar.vaultDownloads': 'Downloads',
  'topbar.vaultOff': 'Vault off',
  'topbar.planFree': 'Free',
  'topbar.planStarter': 'Starter',
  'topbar.planPro': 'Pro',
  'topbar.planWarehouse': 'Warehouse',
  'topbar.demoBadge': 'DEMO',

  // ==========================================
  // Sidebar
  // ==========================================
  'sidebar.vaultConnected': 'Hard drive vault active',
  'sidebar.vaultDisconnected': 'Vault disconnected (fallback to browser downloads)',
  'sidebar.keyboardShortcuts': 'Keyboard shortcuts',
  'sidebar.collapse': 'Collapse sidebar',
  'sidebar.expand': 'Expand sidebar',

  // ==========================================
  // Footer
  // ==========================================
  'footer.zeroCloudNotice':
    'Local-First & Zero-Cloud: Videos, photos, labels, and customer data never leave your PC.',
  'footer.privacy': 'Privacy Policy',
  'footer.terms': 'Terms of Service',
  'footer.refund': 'Refund Policy',
  'footer.support': 'Support & Diagnostics',
  'footer.rights': 'All rights reserved.',
  'footer.madeForSellers': 'Built for Indian e-commerce marketplace sellers.',

  // ==========================================
  // Overview Dashboard
  // ==========================================
  'overview.heading': 'Operations & Evidence Station',
  'overview.subheading':
    'Local-first barcode verification, uncut packing footage, and marketplace dispute recovery in IST.',
  'overview.statLabelsTitle': 'Labels Processed',
  'overview.statLabelsSub': 'Cropped & ready to print',
  'overview.statRecordingsTitle': 'Evidence Recordings',
  'overview.statRecordingsSub': 'Uncut dispatch & return videos',
  'overview.statClaimsTitle': 'Active Disputes',
  'overview.statClaimsSub': 'Tracked inside marketplace deadlines',
  'overview.statProtectedTitle': 'Evidence Value Protected',
  'overview.statProtectedSub': 'Calculated order value saved',
  'overview.quickActions': 'Quick Actions',
  'overview.actionCropLabels': 'Crop Shipping Labels',
  'overview.actionCropSub': 'Extract 4x6 thermal labels with auto-SKU overlay',
  'overview.actionRecordVideo': 'Record Packing Video',
  'overview.actionRecordSub': 'Scan barcode & record uncut video evidence',
  'overview.actionClaimRadar': 'Review Claim Deadlines',
  'overview.actionClaimSub': 'Check dispute windows and generate 1-click kits',
  'overview.recentRecordings': 'Recent Evidence Recordings',
  'overview.noRecordings': 'No video evidence recorded yet today.',
  'overview.startFirstRecording':
    'Scan an AWB barcode or start a recording to protect your shipments.',

  // ==========================================
  // Smart Labels Workbench
  // ==========================================
  'smartlabel.heading': 'Thermal Shipping Label Workbench',
  'smartlabel.subheading':
    'Crop A4 marketplace PDF batches into 4x6 thermal labels with automatic barcode scanning and item overlays.',
  'smartlabel.dropzoneTitle': 'Drag and drop marketplace label PDFs here',
  'smartlabel.dropzoneSub':
    'Supports Meesho, Flipkart, Amazon, and multi-page bulk manifests (up to 100 pages)',
  'smartlabel.chooseFile': 'Select PDF File',
  'smartlabel.processing': 'Analyzing PDF pages & detecting barcodes…',
  'smartlabel.pageCount': '{count} page(s) loaded',
  'smartlabel.labelsDetected': '{count} label(s) cropped successfully',
  'smartlabel.exportPdf': 'Export 4x6 Thermal PDF',
  'smartlabel.printDirect': 'Print to Thermal Printer',
  'smartlabel.cropPreset': 'Label Preset',
  'smartlabel.rotate': 'Rotate 90°',
  'smartlabel.clearAll': 'Clear Batch',
  'smartlabel.emptyTitle': 'No shipping labels loaded',
  'smartlabel.emptySub':
    'Drop a marketplace shipping label PDF to extract high-contrast 4x6 thermal cutouts.',

  // ==========================================
  // Video Recorder Station
  // ==========================================
  'recorder.heading': 'Packing & Return Unboxing Station',
  'recorder.subheading':
    'Uncut 720p/1080p video evidence with real-time barcode detection and tamper-evident IST timestamp watermark.',
  'recorder.tabDispatch': 'Dispatch Packing',
  'recorder.tabReturn': 'Return Unboxing (RTO / DTO)',
  'recorder.scanPrompt': 'Scan AWB or order barcode to start…',
  'recorder.manualAwbPlaceholder': 'Enter tracking number (AWB)…',
  'recorder.cameraSelect': 'Camera Source',
  'recorder.micSelect': 'Microphone Source',
  'recorder.resolution': 'Resolution',
  'recorder.startRecording': 'Start Recording',
  'recorder.stopRecording': 'Stop & Save Evidence',
  'recorder.discardRecording': 'Discard Recording',
  'recorder.recordingActive': 'RECORDING IN PROGRESS',
  'recorder.recWatermark': 'SABOOT UNCUT EVIDENCE · IST',
  'recorder.savedSuccess': 'Recording saved to local vault for AWB: {awb}',
  'recorder.checklistTitle': 'Mandatory Verification Checklist',
  'recorder.checklistOuterBox': '1. Outer packaging condition & courier flyer seal shown to camera',
  'recorder.checklistShippingLabel':
    '2. Clear view of the AWB tracking barcode & return shipping label',
  'recorder.checklistOriginalSeal':
    '3. Brand / manufacturer tamper seal shown intact before cutting',
  'recorder.checklistContents': '4. Clear unboxing showing all box contents and accessories',
  'recorder.checklistWeight': '5. Product placed on scale to document gross return weight',
  'recorder.checklistDamage': '6. Close-up video capture of wrong/damaged/used items',

  // ==========================================
  // ClaimRadar & Dispute Studio
  // ==========================================
  'claims.heading': 'ClaimRadar — Marketplace Dispute Recovery',
  'claims.subheading':
    'Track SLA dispute windows for Meesho, Flipkart, and Amazon with local video proof and 1-click evidence dossiers.',
  'claims.tabAll': 'All Claims',
  'claims.tabUrgent': 'Urgent (< 24h Left)',
  'claims.tabDisputed': 'In Dispute',
  'claims.tabSettled': 'Settled & Approved',
  'claims.filterMarketplace': 'Filter Marketplace',
  'claims.searchPlaceholder': 'Search by AWB, order ID, or reason…',
  'claims.hoursLeft': '{hours}h remaining before SLA expiration',
  'claims.expired': 'Filing deadline expired ({hours}h window)',
  'claims.buttonCreateKit': 'Create Claim Kit',
  'claims.buttonViewEvidence': 'View Video Proof',
  'claims.emptyTitle': 'No marketplace claims found',
  'claims.emptySub':
    'Flag a return unboxing discrepancy or link an AWB to track dispute deadlines.',

  // ==========================================
  // Evidence Vault
  // ==========================================
  'vault.heading': 'Local Evidence Vault',
  'vault.subheading':
    'All uncut recordings and label files stored locally on your computer. User videos are never auto-deleted.',
  'vault.filterAll': 'All Recordings',
  'vault.filterDispatch': 'Dispatch Packing',
  'vault.filterReturn': 'Return Unboxing',
  'vault.searchPlaceholder': 'Search vault by AWB or order ID…',
  'vault.totalVideos': '{count} videos stored',
  'vault.totalStorage': 'Storage location: {path}',
  'vault.play': 'Play Recording',
  'vault.download': 'Save File Copy',
  'vault.deleteConfirm':
    'Are you sure you want to delete this evidence video? This action cannot be undone.',
  'vault.emptyTitle': 'Your vault is empty',
  'vault.emptySub':
    'Start recording packing or return unboxing videos to build your offline legal evidence chain.',

  // ==========================================
  // Pricing Page
  // ==========================================
  'pricing.heading': 'Simple, Transparent Pricing for Sellers',
  'pricing.subheading':
    'Zero cloud server costs. Local-first software you own. Pay once or subscribe for advanced automated dispute tools.',
  'pricing.planFreeTitle': 'Free Tier',
  'pricing.planFreePrice': '₹0 / month',
  'pricing.planFreeDesc':
    'Basic label cropping and 10 video recordings per day. Ideal for new sellers starting out.',
  'pricing.planStarterTitle': 'Starter',
  'pricing.planStarterPrice': '₹349 / month',
  'pricing.planStarterDesc':
    'Unlimited packing videos, 4x6 thermal batch exporter, and local vault organization.',
  'pricing.planProTitle': 'ClaimRadar Pro',
  'pricing.planProPrice': '₹799 / month',
  'pricing.planProDesc':
    'Full automated dispute kit generator, video compression under 25MB, and return checklist watermarking.',
  'pricing.planWarehouseTitle': 'Warehouse Team',
  'pricing.planWarehousePrice': '₹1,499 / month',
  'pricing.planWarehouseDesc':
    'Multi-workstation barcode gun support, audit logs, and priority seller dispute templates.',
  'pricing.currentPlanBadge': 'Your Current Plan',
  'pricing.upgradeButton': 'Upgrade Plan',
  'pricing.moneyBack': '7-day unconditional money-back policy. Cancel anytime with 1 click.',

  // ==========================================
  // Settings Page
  // ==========================================
  'settings.heading': 'System Settings & Preferences',
  'settings.subheading':
    'Configure local vault directories, barcode scanner hardware, display language, and privacy preferences.',
  'settings.languageTitle': 'Display Language / भाषा',
  'settings.languageSub':
    'Choose your preferred language for buttons, instructions, and dispute templates.',
  'settings.langEnglish': 'English',
  'settings.langHindi': 'हिन्दी (Hindi)',
  'settings.storageTitle': 'Local Storage Vault',
  'settings.storageSub':
    'Folder on your hard drive where packing videos and evidence snapshots are saved.',
  'settings.buttonPickFolder': 'Select Vault Folder',
  'settings.scannerTitle': 'Barcode Scanner Gun & Laser Settings',
  'settings.scannerSub':
    'Connect any USB or Bluetooth HID handheld barcode scanner for instant 0.1s scanning.',
  'settings.audioBeeps': 'Audio Beep Sounds',
  'settings.audioBeepsSub':
    'Play confirmation chimes on successful barcode scan and recording stop.',
  'settings.marketplacesTitle': 'Marketplace Dispute Filing Windows (SLA)',
  'settings.marketplacesSub':
    'Dispute deadline hours verified against official seller documentation. Modify if your seller tier differs.',
  'settings.telemetryTitle': 'Opt-in Product Analytics & Error Reporting',
  'settings.telemetrySub':
    'Strictly opt-in. Zero personal data, zero AWBs, zero order IDs, zero SKUs.',
  'settings.legalTitle': 'Legal Policies & Diagnostics',
  'settings.legalSub':
    'Privacy policy, terms of service, refund policy, and support diagnostic reporting.',
  'settings.resetData': 'Wipe Local Application Cache',
  'settings.resetDataSub':
    'Clear IndexedDB cache. Does NOT delete your saved video files in the vault folder.',

  // ==========================================
  // Claim Kit Builder
  // ==========================================
  'claimKit.button.create': 'Create Claim Kit',
  'claimKit.button.creating': 'Building Claim Kit…',
  'claimKit.modal.title': 'Create 1-Click Claim Kit',
  'claimKit.modal.subtitle':
    'Package uncut videos, key frame stills, summary PDF, and dispute text for AWB: {awb}',
  'claimKit.options.heading': 'Claim Kit Options',
  'claimKit.options.targetSize': 'Target Video Size Limit',
  'claimKit.options.targetSizeNone': 'No compression (Original recording quality)',
  'claimKit.options.targetSizePreset': '{sizeMB} MB max ({marketplace} standard limit)',
  'claimKit.options.targetSizeCustom': 'Custom size limit (MB)',
  'claimKit.options.blurAddress': 'Blur shipping label recipient address',
  'claimKit.options.blurAddressHelp':
    'Obscures buyer name and phone number for sharing on public seller forums while keeping AWB and item barcodes legible.',
  'claimKit.options.exportFormat': 'Export Destination',
  'claimKit.options.formatFolder': 'Local Hard Drive Folder (Evidence Vault)',
  'claimKit.options.formatZip': 'Single ZIP File (.zip archive download)',
  'claimKit.status.formatNotice': 'Video format: {format} ({mime})',
  'claimKit.status.sizeNotice': 'Total package size: {size}',
  'claimKit.status.success':
    'Claim Kit successfully created! All evidence files are ready on your disk.',

  // Progress Steps
  'claimKit.progress.idle': 'Ready to generate evidence kit.',
  'claimKit.progress.gathering': 'Gathering dispatch & return video files and order metadata…',
  'claimKit.progress.inspecting': 'Inspecting dispatch & return video files…',
  'claimKit.progress.compressing':
    'Re-encoding video to fit under {targetMB} MB without quality loss…',
  'claimKit.progress.extractingStills': 'Extracting key moment still frames…',
  'claimKit.progress.extractingFrames': 'Extracting key moment still frames…',
  'claimKit.progress.generatingPdf': 'Generating Claim Summary Sheet (PDF)…',
  'claimKit.progress.writing': 'Writing evidence files to disk…',
  'claimKit.progress.writingDispute': 'Generating formatted marketplace dispute letter…',
  'claimKit.progress.savingFolder': 'Saving files into local folder: {folderName}…',
  'claimKit.progress.creatingZip': 'Packaging files into ZIP archive…',
  'claimKit.progress.done': 'Claim Kit complete! All evidence files are prepared on your computer.',
  'claimKit.progress.complete': 'Claim Kit complete!',
  'claimKit.progress.cancelling': 'Cancelling kit generation and cleaning up…',
  'claimKit.noReturnVideoNotice':
    'Note: Return unboxing video was not recorded for this AWB. Kit created with dispatch evidence and dispute sheet.',

  // Error Messages (Plain language with actionable next step)
  'claimKit.error.noEvidence': "We couldn't find any saved videos for this AWB.",
  'claimKit.error.noEvidenceNextStep':
    'Please record or import a packing or return unboxing video before generating a claim kit.',
  'claimKit.error.qualityDegrade':
    'The video cannot be compressed to under {targetMB} MB without making barcodes and timestamps unreadable.',
  'claimKit.error.qualityDegradeNextStep':
    'Increase the target size limit or upload the original video directly to your seller portal.',
  'claimKit.error.permissionRevoked':
    'Storage folder access permission was revoked by your browser.',
  'claimKit.error.permissionRevokedNextStep':
    'Click the button below to re-select your vault folder, or export as a ZIP archive instead.',
  'claimKit.error.cancelled': 'Claim kit creation was cancelled by the user.',
  'claimKit.error.cancelledNextStep':
    'No partial or corrupted files were saved. Click Create Claim Kit to try again.',
  'claimKit.error.writeFailed': 'Failed to save evidence files to your disk.',
  'claimKit.error.writeFailedNextStep':
    'Check available disk space and verify folder write permissions in Settings.',

  // PDF Summary Sheet Strings
  'claimKit.pdf.title': 'SABOOT DISPUTE DOSSIER · LEGAL EVIDENCE KIT',
  'claimKit.pdf.subtitle':
    'Local-first uncut packing and return unboxing verification for Indian marketplace disputes.',
  'claimKit.pdf.sectionShipment': '1. SHIPMENT & DISPUTE DETAILS',
  'claimKit.pdf.sectionEvidence': '2. BARCODE-VERIFIED VIDEO EVIDENCE CHAIN',
  'claimKit.pdf.sectionChecklist': '3. RETURN UNBOXING VERIFICATION CHECKLIST',
  'claimKit.pdf.sectionDisputeText': '4. MARKETPLACE DISPUTE DOSSIER LETTER',
  'claimKit.pdf.dispatchRow': 'Dispatch Packing Video',
  'claimKit.pdf.returnRow': 'Return Unboxing Video',
  'claimKit.pdf.noReturnRecorded':
    'Return unboxing video: Not recorded / Not available on this workstation.',
  'claimKit.pdf.verifiedStatus': 'VERIFIED UNCUT',
  'claimKit.pdf.footerNotice':
    'Generated locally on seller workstation via SABOOT. Zero cloud server uploads. All timestamps computed in Indian Standard Time (IST).',

  // ==========================================
  // Dispute Templates & Message Studio
  // ==========================================
  'dispute.header': 'CLAIM DISPUTE MESSAGE — Template Studio',
  'dispute.languageLabel': 'Message Language',
  'dispute.languageEn': 'English',
  'dispute.languageHi': 'हिंदी (Hindi)',
  'dispute.templateLabel': 'Template Reason',
  'dispute.templateGeneral': 'General Discrepancy',
  'dispute.templateWrongItem': 'Wrong / Swapped Item',
  'dispute.templateDamaged': 'Damaged Item',
  'dispute.templateEmpty': 'Empty Package / Missing Content',
  'dispute.tabEdit': 'Edit Message',
  'dispute.tabPreview': 'Preview & Check Fields',
  'dispute.charCount': '{count} characters',
  'dispute.copy': 'Copy',
  'dispute.copied': 'Dispute message copied to clipboard',
  'dispute.copyFailed': 'Failed to copy to clipboard',
  'dispute.copyFailedNextStep': 'Please select the text manually and press Ctrl+C / Cmd+C.',
  'dispute.regenerate': 'Reset to Template',
  'dispute.missingFieldsAlert': '{count} field(s) require attention: {fields}',
  'dispute.missingFieldsBanner':
    'Some required order fields are missing. They are highlighted below in amber so you can fill them in before copying.',
  'dispute.allFieldsFilled': 'All required fields are filled. Ready to copy.',
  'dispute.disclaimer':
    'Factual, polite dispute message without legal or policy citations. Ready to paste into seller support tickets.',

  // ==========================================
  // System Errors & Plain Language Notifications
  // ==========================================
  'errors.cameraNotFound': 'We could not detect any connected camera.',
  'errors.cameraNotFoundNextStep':
    'Connect a USB webcam or enable camera permissions in your browser bar.',
  'errors.micNotFound': 'No microphone detected.',
  'errors.micNotFoundNextStep':
    'Check your microphone audio cable or select another input in Settings.',
  'errors.folderPermission': 'Disk folder access denied or expired.',
  'errors.folderPermissionNextStep':
    'Click Settings and re-select your vault folder to grant read/write access.',
  'errors.genericActionFailed': 'An unexpected error occurred while completing this action.',
  'errors.genericActionFailedNextStep':
    'Please refresh the page and try again. If this repeats, copy diagnostic info on the Support page.',

  // ==========================================
  // Legal & Support Pages
  // ==========================================
  'legal.privacyHeading': 'Privacy Policy — Local-First & Zero-Cloud',
  'legal.termsHeading': 'Terms of Service',
  'legal.refundHeading': 'Refund & Cancellation Policy',
  'legal.supportHeading': 'Customer Support & Diagnostic Information',

  // ==========================================
  // ClaimRadar & Deadline Urgency Banners
  // ==========================================
  'claims.banner.critical': 'URGENT: {marketplace} claim for AWB {awb} closes in {time}! File now.',
  'claims.banner.warning': 'DEADLINE ALERT: {marketplace} claim for AWB {awb} closes in {time}.',
  'claims.banner.action': 'Prepare Claim',
  'claims.banner.dismiss': 'Dismiss',
  'claims.calendar.export': 'Export Calendar (.ics)',
  'claims.calendar.exported': 'Dispute deadline calendar reminder (.ics) downloaded.',
  'claims.notifications.title': 'Dispute Deadline Notifications',
  'claims.notifications.description':
    'Receive local browser reminders 24 hours and 6 hours before marketplace dispute windows expire. Zero marketing messages.',
  'claims.notifications.enable': 'Enable Notifications',
  'claims.notifications.enabledToast': 'Dispute notifications active (24h & 6h reminders).',
  'claims.notifications.deniedToast':
    'Browser notifications blocked. Please enable them in your browser site settings.',
  'claims.editWindow.title': 'Marketplace Claim Windows',
  'claims.editWindow.subtitle':
    'Customize dispute filing deadlines based on your seller panel agreements.',
  'claims.editDate.title': 'Edit Return Delivery Date',
  'claims.editDate.recalculated': 'Return delivery date updated. Deadline recalculated in IST.',
  'claims.editDate.pastWarning': 'Delivered in the past: Dispute window has already expired.',

  // ==========================================
  // Phone Companion & Pairing
  // ==========================================
  'phone.title': 'Phone Companion',
  'phone.subtitle': 'Use your smartphone camera & barcode scanner over private P2P',
  'phone.connecting': 'Connecting to workstation...',
  'phone.connected': 'Connected to workstation',
  'phone.notConfigured':
    'Phone pairing is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild.',
  'phone.tokenExpired':
    'Pairing QR code has expired (2-minute limit). Please scan a fresh QR code on your workstation.',
  'phone.alreadyPaired': 'Workstation is already paired with another device.',
  'phone.invalidToken': 'Invalid or expired pairing token.',
  'phone.webrtcFailed': 'Direct peer connection could not be established on this network.',
  'phone.webrtcFailedNextStep':
    'You can continue recording on your phone; video evidence is saved locally on this phone to transfer later.',
  'phone.scanBarcode': 'Scan AWB Barcode',
  'phone.scanHint': 'Point camera at AWB or package barcode',
  'phone.barcodeDetected': 'Barcode detected: {code}',
  'phone.startRecording': 'Start Recording',
  'phone.stopRecording': 'Stop & Transfer',
  'phone.recording': 'Recording in progress...',
  'phone.transferring': 'Sending video to workstation ({percent}%)...',
  'phone.transferSuccess': 'Video verified & saved to workstation vault!',
  'phone.transferFailed': 'Transfer interrupted. Video is saved safely on your phone.',
  'phone.retryTransfer': 'Retry Transfer',
  'phone.downloadLocal': 'Download Video to Phone',
  'phone.callInterruption':
    'Recording paused & saved safely because an incoming call or app switch interrupted the camera.',
  'phone.batteryWarning': 'Low Battery: Plug in your phone to avoid frame rate drops.',
  'phone.storageWarning': 'Low Storage: Less than 100 MB available on phone.',
  'phone.cameraPermissionDenied':
    'Camera access denied. Please allow camera permissions in your browser.',
  'phone.switchCamera': 'Switch Camera',
  'phone.offlineMode': 'Offline Mode (Local Save)',
  'phone.enterDetails': 'Enter AWB / Order details to begin recording',
  'phone.awb': 'AWB Number',
  'phone.orderId': 'Order ID',
  'phone.sku': 'SKU',
  'phone.qty': 'Quantity',
  'phone.modeDispatch': 'Dispatch',
  'phone.modeReturn': 'Return Unboxing',
  'phone.takePhoto': 'Snap Evidence Still',
  'phone.photoTaken': 'Evidence photo captured'
};

export type I18nKey = keyof typeof en;
