/**
 * Hindi (हिन्दी) dictionary for SABOOT Suite.
 * Typed against `I18nKey` from `en.ts` to ensure exact 1:1 key parity at compile time.
 */

import type { I18nKey } from './en';

export const hi: Record<I18nKey, string> = {
  // ==========================================
  // Common Actions & Generic UI
  // ==========================================
  'common.close': 'बंद करें',
  'common.cancel': 'रद्द करें',
  'common.save': 'सहेजें',
  'common.saved': 'सफलतापूर्वक सहेजा गया',
  'common.copy': 'कॉपी करें',
  'common.copied': 'क्लिपबोर्ड पर कॉपी किया गया',
  'common.download': 'डाउनलोड करें',
  'common.create': 'बनाएं',
  'common.delete': 'हटाएं',
  'common.edit': 'संपादित करें',
  'common.retry': 'पुनः प्रयास करें',
  'common.openFolder': 'फ़ोल्डर खोलें',
  'common.refresh': 'ताज़ा करें',
  'common.back': 'वापस',
  'common.next': 'आगे',
  'common.done': 'पूर्ण',
  'common.confirm': 'पुष्टि करें',
  'common.view': 'देखें',
  'common.open': 'खोलें',
  'common.status': 'स्थिति',
  'common.date': 'तारीख',
  'common.actions': 'कार्रवाई',
  'common.filter': 'फ़िल्टर करें',
  'common.clear': 'साफ़ करें',
  'common.all': 'सभी',
  'common.loading': 'लोड हो रहा है…',
  'common.unverified': 'असत्यापित',
  'common.unverifiedBadge': 'असत्यापित - अपने सेलर पैनल में जांचें',
  'common.enabled': 'सक्रिय',
  'common.disabled': 'निष्क्रिय',
  'common.search': 'खोजें',
  'common.active': 'सक्रिय',
  'common.inactive': 'निष्क्रिय',
  'common.select': 'चुनें',

  // ==========================================
  // Navigation & Shell
  // ==========================================
  'nav.overview': 'अवलोकन',
  'nav.labels': 'स्मार्ट लेबल्स',
  'nav.recorder': 'पैकिंग और अनबॉक्सिंग',
  'nav.claims': 'क्लेम रडार',
  'nav.vault': 'सबूत वॉल्ट',
  'nav.pricing': 'मूल्य निर्धारण',
  'nav.settings': 'सेटिंग्स',
  'nav.privacy': 'गोपनीयता नीति',
  'nav.terms': 'सेवा की शर्तें',
  'nav.refund': 'रिफंड नीति',
  'nav.support': 'सहायता',
  'nav.brandSubtitle': 'विक्रेताओं के लिए डिजिटल सबूत स्टेशन',

  // ==========================================
  // TopBar
  // ==========================================
  'topbar.searchPlaceholder': 'सबूत और क्लेम खोजें (Ctrl+K)',
  'topbar.searchTooltip': 'सबूत और क्लेम खोजें (Ctrl+K)',
  'topbar.search': 'खोजें',
  'topbar.themeDark': 'लाइट मोड चालू करें',
  'topbar.themeLight': 'डार्क मोड चालू करें',
  'topbar.langToggle': 'भाषा बदलें (English / हिन्दी)',
  'topbar.labelsToday': 'आज के लेबल्स',
  'topbar.videosToday': 'आज के वीडियो',
  'topbar.vaultConnected': 'वॉल्ट',
  'topbar.vaultDownloads': 'डाउनलोड',
  'topbar.vaultOff': 'वॉल्ट बंद',
  'topbar.planFree': 'निःशुल्क',
  'topbar.planStarter': 'स्टार्टर',
  'topbar.planPro': 'प्रो',
  'topbar.planWarehouse': 'वेयरहाउस',
  'topbar.demoBadge': 'डेमो',

  // ==========================================
  // Sidebar
  // ==========================================
  'sidebar.vaultConnected': 'हार्ड ड्राइव वॉल्ट सक्रिय है',
  'sidebar.vaultDisconnected': 'वॉल्ट डिस्कनेक्ट है (ब्राउज़र डाउनलोड पर निर्भर)',
  'sidebar.keyboardShortcuts': 'कीबोर्ड शॉर्टकट',
  'sidebar.collapse': 'साइडबार समेटें',
  'sidebar.expand': 'साइडबार फैलाएं',

  // ==========================================
  // Footer
  // ==========================================
  'footer.zeroCloudNotice':
    'लोकल-फ़र्स्ट और ज़ीरो-क्लाउड: वीडियो, फ़ोटो, लेबल और ग्राहक डेटा कभी भी आपके कंप्यूटर से बाहर नहीं जाते।',
  'footer.privacy': 'गोपनीयता नीति',
  'footer.terms': 'सेवा की शर्तें',
  'footer.refund': 'रिफंड नीति',
  'footer.support': 'सहायता और डायग्नोस्टिक्स',
  'footer.rights': 'सर्वाधिकार सुरक्षित।',
  'footer.madeForSellers': 'भारतीय ई-कॉमर्स मार्केटप्लेस विक्रेताओं के लिए निर्मित।',

  // ==========================================
  // Overview Dashboard
  // ==========================================
  'overview.heading': 'संचालन एवं साक्ष्य स्टेशन',
  'overview.subheading':
    'लोकल-फ़र्स्ट बारकोड सत्यापन, अनकट पैकिंग वीडियो और IST में मार्केटप्लेस विवाद समाधान।',
  'overview.statLabelsTitle': 'प्रोसेस किए गए लेबल्स',
  'overview.statLabelsSub': 'क्रॉप किए गए और प्रिंट हेतु तैयार',
  'overview.statRecordingsTitle': 'साक्ष्य रिकॉर्डिंग्स',
  'overview.statRecordingsSub': 'अनकट डिस्पैच और रिटर्न वीडियो',
  'overview.statClaimsTitle': 'सक्रिय विवाद',
  'overview.statClaimsSub': 'मार्केटप्लेस समय-सीमा के भीतर ट्रैक किए गए',
  'overview.statProtectedTitle': 'सुरक्षित साक्ष्य मूल्य',
  'overview.statProtectedSub': 'बचाया गया अनुमानित ऑर्डर मूल्य',
  'overview.quickActions': 'त्वरित कार्रवाइयां',
  'overview.actionCropLabels': 'शिपिंग लेबल्स क्रॉप करें',
  'overview.actionCropSub': 'ऑटो-SKU ओवरले के साथ 4x6 थर्मल लेबल्स निकालें',
  'overview.actionRecordVideo': 'पैकिंग वीडियो रिकॉर्ड करें',
  'overview.actionRecordSub': 'बारकोड स्कैन करें और अनकट वीडियो साक्ष्य रिकॉर्ड करें',
  'overview.actionClaimRadar': 'क्लेम समय-सीमा की समीक्षा करें',
  'overview.actionClaimSub': 'विवाद विंडो जांचें और 1-क्लिक साक्ष्य किट तैयार करें',
  'overview.recentRecordings': 'हाल की साक्ष्य रिकॉर्डिंग्स',
  'overview.noRecordings': 'आज अभी तक कोई वीडियो साक्ष्य रिकॉर्ड नहीं किया गया है।',
  'overview.startFirstRecording':
    'अपने शिपमेंट को सुरक्षित करने के लिए AWB बारकोड स्कैन करें या रिकॉर्डिंग शुरू करें।',

  // ==========================================
  // Smart Labels Workbench
  // ==========================================
  'smartlabel.heading': 'थर्मल शिपिंग लेबल वर्कबेंच',
  'smartlabel.subheading':
    'A4 मार्केटप्लेस PDF बैच को स्वचालित बारकोड स्कैनिंग और आइटम ओवरले के साथ 4x6 थर्मल लेबल्स में क्रॉप करें।',
  'smartlabel.dropzoneTitle': 'मार्केटप्लेस लेबल PDF यहां खींचें और छोड़ें',
  'smartlabel.dropzoneSub':
    'Meesho, Flipkart, Amazon और मल्टी-पेज थोक मैनिफ़ेस्ट (100 पृष्ठों तक) समर्थित हैं',
  'smartlabel.chooseFile': 'PDF फ़ाइल चुनें',
  'smartlabel.processing': 'PDF पृष्ठों का विश्लेषण और बारकोड का पता लगाया जा रहा है…',
  'smartlabel.pageCount': '{count} पृष्ठ लोड किए गए',
  'smartlabel.labelsDetected': '{count} लेबल सफलतापूर्वक क्रॉप किए गए',
  'smartlabel.exportPdf': '4x6 थर्मल PDF निर्यात करें',
  'smartlabel.printDirect': 'थर्मल प्रिंटर पर प्रिंट करें',
  'smartlabel.cropPreset': 'लेबल प्रीसेट',
  'smartlabel.rotate': '90° घुमाएं',
  'smartlabel.clearAll': 'बैच साफ़ करें',
  'smartlabel.emptyTitle': 'कोई शिपिंग लेबल लोड नहीं है',
  'smartlabel.emptySub':
    'उच्च कंट्रास्ट वाले 4x6 थर्मल कटआउट निकालने के लिए कोई मार्केटप्लेस शिपिंग लेबल PDF डालें।',

  // ==========================================
  // Video Recorder Station
  // ==========================================
  'recorder.heading': 'पैकिंग और रिटर्न अनबॉक्सिंग स्टेशन',
  'recorder.subheading':
    'रीयल-टाइम बारकोड पहचान और छेड़छाड़-रोधी IST टाइमस्टैम्प वॉटरमार्क के साथ अनकट 720p/1080p वीडियो साक्ष्य।',
  'recorder.tabDispatch': 'डिस्पैच पैकिंग',
  'recorder.tabReturn': 'रिटर्न अनबॉक्सिंग (RTO / DTO)',
  'recorder.scanPrompt': 'शुरू करने के लिए AWB या ऑर्डर बारकोड स्कैन करें…',
  'recorder.manualAwbPlaceholder': 'ट्रैकिंग नंबर (AWB) दर्ज करें…',
  'recorder.cameraSelect': 'कैमरा स्रोत',
  'recorder.micSelect': 'माइक्रोफ़ोन स्रोत',
  'recorder.resolution': 'रिज़ॉल्यूशन',
  'recorder.startRecording': 'रिकॉर्डिंग शुरू करें',
  'recorder.stopRecording': 'रोकें और साक्ष्य सहेजें',
  'recorder.discardRecording': 'रिकॉर्डिंग रद्द करें',
  'recorder.recordingActive': 'रिकॉर्डिंग जारी है',
  'recorder.recWatermark': 'सबूत अनकट साक्ष्य · IST',
  'recorder.savedSuccess': 'AWB के लिए स्थानीय वॉल्ट में रिकॉर्डिंग सहेजी गई: {awb}',
  'recorder.checklistTitle': 'अनिवार्य सत्यापन चेकलिस्ट',
  'recorder.checklistOuterBox':
    '1. बाहरी पैकेजिंग की स्थिति और कूरियर फ़्लायर सील कैमरे को दिखाई गई',
  'recorder.checklistShippingLabel': '2. AWB ट्रैकिंग बारकोड और रिटर्न शिपिंग लेबल का स्पष्ट दृश्य',
  'recorder.checklistOriginalSeal':
    '3. काटने से पहले ब्रांड/निर्माता की छेड़छाड़-रोधी सील साबुत दिखाई गई',
  'recorder.checklistContents':
    '4. बॉक्स की सभी सामग्री और सहायक उपकरण दिखाते हुए स्पष्ट अनबॉक्सिंग',
  'recorder.checklistWeight': '5. कुल रिटर्न वजन दर्ज करने के लिए उत्पाद को तराजू पर रखा गया',
  'recorder.checklistDamage': '6. गलत/क्षतिग्रस्त/इस्तेमाल किए गए सामान का क्लोज़-अप वीडियो',

  // ==========================================
  // ClaimRadar & Dispute Studio
  // ==========================================
  'claims.heading': 'क्लेम रडार — मार्केटप्लेस विवाद समाधान',
  'claims.subheading':
    'लोकल वीडियो साक्ष्य और 1-क्लिक प्रमाण डॉसियर के साथ Meesho, Flipkart और Amazon के SLA विवाद समय-सीमा को ट्रैक करें।',
  'claims.tabAll': 'सभी क्लेम',
  'claims.tabUrgent': 'अति आवश्यक (< 24 घंटे शेष)',
  'claims.tabDisputed': 'विवाद में',
  'claims.tabSettled': 'स्वीकृत व हल किए गए',
  'claims.filterMarketplace': 'मार्केटप्लेस फ़िल्टर',
  'claims.searchPlaceholder': 'AWB, ऑर्डर ID या कारण द्वारा खोजें…',
  'claims.hoursLeft': 'SLA समाप्त होने में {hours} घंटे शेष',
  'claims.expired': 'दाखिल करने की समय-सीमा समाप्त ({hours} घंटे की विंडो)',
  'claims.buttonCreateKit': 'क्लेम किट बनाएं',
  'claims.buttonViewEvidence': 'वीडियो साक्ष्य देखें',
  'claims.emptyTitle': 'कोई मार्केटप्लेस क्लेम नहीं मिला',
  'claims.emptySub':
    'विवाद की समय-सीमा ट्रैक करने के लिए रिटर्न अनबॉक्सिंग विसंगति को फ़्लैग करें या कोई AWB लिंक करें।',

  // ==========================================
  // Evidence Vault
  // ==========================================
  'vault.heading': 'स्थानीय साक्ष्य वॉल्ट',
  'vault.subheading':
    'सभी अनकट रिकॉर्डिंग्स और लेबल फ़ाइलें स्थानीय रूप से आपके कंप्यूटर पर संग्रहीत हैं। उपयोगकर्ता वीडियो कभी स्वतः हटाए नहीं जाते।',
  'vault.filterAll': 'सभी रिकॉर्डिंग्स',
  'vault.filterDispatch': 'डिस्पैच पैकिंग',
  'vault.filterReturn': 'रिटर्न अनबॉक्सिंग',
  'vault.searchPlaceholder': 'AWB या ऑर्डर ID द्वारा वॉल्ट में खोजें…',
  'vault.totalVideos': '{count} वीडियो संग्रहीत',
  'vault.totalStorage': 'संग्रहण स्थान: {path}',
  'vault.play': 'रिकॉर्डिंग चलाएं',
  'vault.download': 'फ़ाइल प्रतिलिपि सहेजें',
  'vault.deleteConfirm':
    'क्या आप वाकई इस साक्ष्य वीडियो को हटाना चाहते हैं? यह कार्रवाई पूर्ववत नहीं की जा सकती।',
  'vault.emptyTitle': 'आपका वॉल्ट खाली है',
  'vault.emptySub':
    'अपनी ऑफ़लाइन कानूनी साक्ष्य शृंखला बनाने के लिए पैकिंग या रिटर्न अनबॉक्सिंग वीडियो रिकॉर्ड करना शुरू करें।',

  // ==========================================
  // Pricing Page
  // ==========================================
  'pricing.heading': 'विक्रेताओं के लिए सरल, पारदर्शी मूल्य',
  'pricing.subheading':
    'शून्य क्लाउड सर्वर लागत। सॉफ़्टवेयर आपका अपना है। एक बार भुगतान करें या उन्नत स्वचालित विवाद टूल के लिए सदस्यता लें।',
  'pricing.planFreeTitle': 'निःशुल्क टियर',
  'pricing.planFreePrice': '₹0 / माह',
  'pricing.planFreeDesc':
    'बुनियादी लेबल क्रॉपिंग और प्रतिदिन 10 वीडियो रिकॉर्डिंग। नए विक्रेताओं के लिए आदर्श।',
  'pricing.planStarterTitle': 'स्टार्टर',
  'pricing.planStarterPrice': '₹349 / माह',
  'pricing.planStarterDesc': 'असीमित पैकिंग वीडियो, 4x6 थर्मल बैच निर्यातक और स्थानीय वॉल्ट संगठन।',
  'pricing.planProTitle': 'क्लेम रडार प्रो',
  'pricing.planProPrice': '₹799 / माह',
  'pricing.planProDesc':
    'पूर्ण स्वचालित विवाद किट जनरेटर, 25MB से कम वीडियो संपीड़न और रिटर्न चेकलिस्ट वॉटरमार्किंग।',
  'pricing.planWarehouseTitle': 'वेयरहाउस टीम',
  'pricing.planWarehousePrice': '₹1,499 / माह',
  'pricing.planWarehouseDesc':
    'मल्टी-वर्कस्टेशन बारकोड गन सहायता, ऑडिट लॉग और प्राथमिकता विक्रेता विवाद टेम्पलेट।',
  'pricing.currentPlanBadge': 'आपकी वर्तमान योजना',
  'pricing.upgradeButton': 'योजना अपग्रेड करें',
  'pricing.moneyBack': '7 दिनों की बिना शर्त पैसे वापसी गारंटी। 1-क्लिक में कभी भी रद्द करें।',

  // ==========================================
  // Settings Page
  // ==========================================
  'settings.heading': 'सिस्टम सेटिंग्स और प्राथमिकताएं',
  'settings.subheading':
    'स्थानीय वॉल्ट निर्देशिकाएं, बारकोड स्कैनर हार्डवेयर, प्रदर्शन भाषा और गोपनीयता प्राथमिकताएं कॉन्फ़िगर करें।',
  'settings.languageTitle': 'प्रदर्शन भाषा / Display Language',
  'settings.languageSub': 'बटन, निर्देशों और विवाद टेम्पलेट्स के लिए अपनी पसंदीदा भाषा चुनें।',
  'settings.langEnglish': 'English (अंग्रेज़ी)',
  'settings.langHindi': 'हिन्दी (Hindi)',
  'settings.storageTitle': 'स्थानीय संग्रहण वॉल्ट',
  'settings.storageSub':
    'आपकी हार्ड ड्राइव का वह फ़ोल्डर जहां पैकिंग वीडियो और साक्ष्य स्नैपशॉट सहेजे जाते हैं।',
  'settings.buttonPickFolder': 'वॉल्ट फ़ोल्डर चुनें',
  'settings.scannerTitle': 'बारकोड स्कैनर गन और लेज़र सेटिंग्स',
  'settings.scannerSub':
    'तुरंत 0.1 सेकंड में स्कैन करने के लिए कोई भी USB या ब्लूटूथ HID हैंडहेल्ड बारकोड स्कैनर कनेक्ट करें।',
  'settings.audioBeeps': 'ऑडियो बीप ध्वनियां',
  'settings.audioBeepsSub': 'सफल बारकोड स्कैन और रिकॉर्डिंग रुकने पर पुष्टिकरण धुन बजाएं।',
  'settings.marketplacesTitle': 'मार्केटप्लेस विवाद दाखिल करने की समय-सीमा (SLA)',
  'settings.marketplacesSub':
    'आधिकारिक विक्रेता दस्तावेज़ों से सत्यापित विवाद की समय-सीमा (घंटे)। यदि आपका विक्रेता टियर भिन्न है तो संशोधित करें।',
  'settings.telemetryTitle': 'वैकल्पिक उत्पाद विश्लेषण और त्रुटि रिपोर्टिंग',
  'settings.telemetrySub':
    'पूरी तरह से वैकल्पिक। शून्य व्यक्तिगत डेटा, शून्य AWB, शून्य ऑर्डर ID, शून्य SKU।',
  'settings.legalTitle': 'कानूनी नीतियां और डायग्नोस्टिक्स',
  'settings.legalSub':
    'गोपनीयता नीति, सेवा की शर्तें, रिफंड नीति और तकनीकी सहायता डायग्नोस्टिक रिपोर्टिंग।',
  'settings.resetData': 'स्थानीय एप्लिकेशन कैश साफ़ करें',
  'settings.resetDataSub':
    'IndexedDB कैश साफ़ करें। यह वॉल्ट फ़ोल्डर में आपकी सहेजी गई वीडियो फ़ाइलों को नहीं हटाता है।',

  // ==========================================
  // Claim Kit Builder
  // ==========================================
  'claimKit.button.create': 'क्लेम किट बनाएं',
  'claimKit.button.creating': 'क्लेम किट बनाई जा रही है…',
  'claimKit.modal.title': '1-क्लिक क्लेम किट बनाएं',
  'claimKit.modal.subtitle':
    'AWB के लिए अनकट वीडियो, मुख्य फ़्रेम चित्र, सारांश PDF और विवाद पत्र पैक करें: {awb}',
  'claimKit.options.heading': 'क्लेम किट विकल्प',
  'claimKit.options.targetSize': 'लक्षित वीडियो आकार सीमा',
  'claimKit.options.targetSizeNone': 'कोई संपीड़न नहीं (मूल रिकॉर्डिंग गुणवत्ता)',
  'claimKit.options.targetSizePreset': 'अधिकतम {sizeMB} MB ({marketplace} मानक सीमा)',
  'claimKit.options.targetSizeCustom': 'कस्टम आकार सीमा (MB)',
  'claimKit.options.blurAddress': 'शिपिंग लेबल पर प्राप्तकर्ता का पता धुंधला करें',
  'claimKit.options.blurAddressHelp':
    'AWB और आइटम बारकोड को सुपाठ्य रखते हुए सार्वजनिक विक्रेता फ़ोरम पर साझा करने के लिए खरीदार का नाम और फ़ोन नंबर छिपाता है।',
  'claimKit.options.exportFormat': 'निर्यात गंतव्य',
  'claimKit.options.formatFolder': 'लोकल हार्ड ड्राइव फ़ोल्डर (सबूत वॉल्ट)',
  'claimKit.options.formatZip': 'एकल ज़िप फ़ाइल (.zip पुरालेख डाउनलोड)',
  'claimKit.status.formatNotice': 'वीडियो प्रारूप: {format} ({mime})',
  'claimKit.status.sizeNotice': 'कुल पैकेज आकार: {size}',
  'claimKit.status.success':
    'क्लेम किट सफलतापूर्वक बन गई! सभी साक्ष्य फ़ाइलें आपकी डिस्क पर तैयार हैं।',

  // Progress Steps
  'claimKit.progress.idle': 'साक्ष्य किट तैयार करने के लिए तैयार।',
  'claimKit.progress.gathering': 'डिस्पैच व रिटर्न वीडियो और ऑर्डर डेटा इकट्ठा किया जा रहा है…',
  'claimKit.progress.inspecting': 'डिस्पैच और रिटर्न वीडियो फ़ाइलों का निरीक्षण किया जा रहा है…',
  'claimKit.progress.compressing':
    'गुणवत्ता खोए बिना {targetMB} MB से कम में वीडियो पुनः एन्कोड किया जा रहा है…',
  'claimKit.progress.extractingStills': 'मुख्य क्षणों के स्थिर फ़्रेम निकाले जा रहे हैं…',
  'claimKit.progress.extractingFrames': 'मुख्य क्षणों के स्थिर फ़्रेम निकाले जा रहे हैं…',
  'claimKit.progress.generatingPdf': 'क्लेम सारांश शीट (PDF) बनाई जा रही है…',
  'claimKit.progress.writing': 'डिस्क पर साक्ष्य फ़ाइलें सहेजी जा रही हैं…',
  'claimKit.progress.writingDispute': 'प्रारूपित मार्केटप्लेस विवाद पत्र तैयार किया जा रहा है…',
  'claimKit.progress.savingFolder': 'स्थानीय फ़ोल्डर में फ़ाइलें सहेजी जा रही हैं: {folderName}…',
  'claimKit.progress.creatingZip': 'फ़ाइलों को ZIP पुरालेख में पैक किया जा रहा है…',
  'claimKit.progress.done': 'क्लेम किट पूर्ण! सभी साक्ष्य फ़ाइलें आपके कंप्यूटर पर तैयार हैं।',
  'claimKit.progress.complete': 'क्लेम किट पूर्ण!',
  'claimKit.progress.cancelling': 'किट निर्माण रद्द किया जा रहा है और सफ़ाई की जा रही है…',
  'claimKit.noReturnVideoNotice':
    'सूचना: इस AWB के लिए रिटर्न अनबॉक्सिंग वीडियो रिकॉर्ड नहीं हुआ था। किट डिस्पैच साक्ष्य और विवाद शीट के साथ तैयार की गई।',

  // Error Messages (Plain language with actionable next step)
  'claimKit.error.noEvidence': 'हमें इस AWB के लिए कोई सहेजा गया वीडियो नहीं मिला।',
  'claimKit.error.noEvidenceNextStep':
    'क्लेम किट बनाने से पहले कृपया पैकिंग या रिटर्न अनबॉक्सिंग वीडियो रिकॉर्ड करें या आयात करें।',
  'claimKit.error.qualityDegrade':
    'बारकोड और टाइमस्टैम्प को अपठनीय बनाए बिना वीडियो को {targetMB} MB से कम में संपीड़ित नहीं किया जा सकता है।',
  'claimKit.error.qualityDegradeNextStep':
    'लक्षित आकार सीमा बढ़ाएं या मूल वीडियो सीधे अपने सेलर पोर्टल पर अपलोड करें।',
  'claimKit.error.permissionRevoked':
    'ब्राउज़र द्वारा संग्रहण फ़ोल्डर पहुंच अनुमति रद्द कर दी गई थी।',
  'claimKit.error.permissionRevokedNextStep':
    'अपने वॉल्ट फ़ोल्डर को फिर से चुनने के लिए नीचे दिए गए बटन पर क्लिक करें, या इसके बजाय ज़िप फ़ाइल के रूप में निर्यात करें।',
  'claimKit.error.cancelled': 'उपयोगकर्ता द्वारा क्लेम किट निर्माण रद्द कर दिया गया था।',
  'claimKit.error.cancelledNextStep':
    'कोई आंशिक या दूषित फ़ाइल सहेजी नहीं गई। पुनः प्रयास करने के लिए क्लेम किट बनाएं पर क्लिक करें।',
  'claimKit.error.writeFailed': 'आपकी डिस्क पर साक्ष्य फ़ाइलें सहेजने में विफल।',
  'claimKit.error.writeFailedNextStep':
    'उपलब्ध डिस्क स्थान की जाँच करें और सेटिंग्स में फ़ोल्डर लिखने की अनुमति सत्यापित करें।',

  // PDF Summary Sheet Strings
  'claimKit.pdf.title': 'सबूत विवाद डॉसियर · कानूनी साक्ष्य किट',
  'claimKit.pdf.subtitle':
    'भारतीय मार्केटप्लेस विवादों के लिए लोकल-फ़र्स्ट अनकट पैकिंग और रिटर्न अनबॉक्सिंग सत्यापन।',
  'claimKit.pdf.sectionShipment': '1. शिपमेंट और विवाद विवरण',
  'claimKit.pdf.sectionEvidence': '2. बारकोड-सत्यापित वीडियो साक्ष्य शृंखला',
  'claimKit.pdf.sectionChecklist': '3. रिटर्न अनबॉक्सिंग सत्यापन चेकलिस्ट',
  'claimKit.pdf.sectionDisputeText': '4. मार्केटप्लेस विवाद पत्र',
  'claimKit.pdf.dispatchRow': 'डिस्पैच पैकिंग वीडियो',
  'claimKit.pdf.returnRow': 'रिटर्न अनबॉक्सिंग वीडियो',
  'claimKit.pdf.noReturnRecorded':
    'रिटर्न अनबॉक्सिंग वीडियो: रिकॉर्ड नहीं किया गया / इस वर्कस्टेशन पर उपलब्ध नहीं।',
  'claimKit.pdf.verifiedStatus': 'सत्यापित अनकट साक्ष्य',
  'claimKit.pdf.footerNotice':
    'सबूत द्वारा विक्रेता वर्कस्टेशन पर स्थानीय रूप से उत्पन्न। शून्य क्लाउड सर्वर अपलोड। सभी टाइमस्टैम्प भारतीय मानक समय (IST) में।',

  // ==========================================
  // Dispute Templates & Message Studio
  // ==========================================
  'dispute.header': 'क्लेम विवाद संदेश — टेम्पलेट स्टूडियो',
  'dispute.languageLabel': 'संदेश की भाषा',
  'dispute.languageEn': 'English (अंग्रेज़ी)',
  'dispute.languageHi': 'हिंदी (Hindi)',
  'dispute.templateLabel': 'विवाद का कारण',
  'dispute.templateGeneral': 'सामान्य विसंगति',
  'dispute.templateWrongItem': 'गलत / बदला हुआ सामान',
  'dispute.templateDamaged': 'क्षतिग्रस्त सामान',
  'dispute.templateEmpty': 'खाली पैकेट / गायब सामान',
  'dispute.tabEdit': 'संदेश संपादित करें',
  'dispute.tabPreview': 'पूर्वावलोकन और फ़ील्ड जांचें',
  'dispute.charCount': '{count} अक्षर',
  'dispute.copy': 'कॉपी करें',
  'dispute.copied': 'विवाद संदेश क्लिपबोर्ड पर कॉपी किया गया',
  'dispute.copyFailed': 'क्लिपबोर्ड पर कॉपी करने में विफल',
  'dispute.copyFailedNextStep': 'कृपया टेक्स्ट को मैन्युअल रूप से चुनें और Ctrl+C / Cmd+C दबाएं।',
  'dispute.regenerate': 'टेम्पलेट पर रीसेट करें',
  'dispute.missingFieldsAlert': '{count} फ़ील्ड पर ध्यान देने की आवश्यकता है: {fields}',
  'dispute.missingFieldsBanner':
    'ऑर्डर के कुछ आवश्यक फ़ील्ड खाली हैं। कॉपी करने से पहले उन्हें भरने के लिए नीचे हाइलाइट किया गया है।',
  'dispute.allFieldsFilled': 'सभी आवश्यक फ़ील्ड भरे गए हैं। कॉपी करने के लिए तैयार।',
  'dispute.disclaimer': 'तथ्यात्मक, विनम्र विवाद संदेश। सेलर सपोर्ट टिकट में चिपकाने के लिए तैयार।',

  // ==========================================
  // System Errors & Plain Language Notifications
  // ==========================================
  'errors.cameraNotFound': 'हम किसी भी जुड़े हुए कैमरे का पता नहीं लगा सके।',
  'errors.cameraNotFoundNextStep':
    'USB वेबकैम कनेक्ट करें या अपने ब्राउज़र बार में कैमरा अनुमति सक्षम करें।',
  'errors.micNotFound': 'कोई माइक्रोफ़ोन नहीं मिला।',
  'errors.micNotFoundNextStep':
    'अपनी माइक्रोफ़ोन केबल जांचें या सेटिंग्स में कोई अन्य इनपुट चुनें।',
  'errors.folderPermission': 'डिस्क फ़ोल्डर पहुंच अस्वीकृत या समाप्त हो गई।',
  'errors.folderPermissionNextStep':
    'रीड/राइट अनुमति देने के लिए सेटिंग्स पर क्लिक करें और अपने वॉल्ट फ़ोल्डर को फिर से चुनें।',
  'errors.genericActionFailed': 'इस कार्रवाई को पूरा करते समय एक अप्रत्याशित त्रुटि हुई।',
  'errors.genericActionFailedNextStep':
    'कृपया पृष्ठ को रीफ़्रेश करें और पुनः प्रयास करें। यदि यह दोबारा होता है, तो सहायता पृष्ठ पर डायग्नोस्टिक जानकारी कॉपी करें।',

  // ==========================================
  // Legal & Support Pages
  // ==========================================
  'legal.privacyHeading': 'गोपनीयता नीति — लोकल-फ़र्स्ट और ज़ीरो-क्लाउड',
  'legal.termsHeading': 'सेवा की शर्तें',
  'legal.refundHeading': 'रिफंड एवं रद्दीकरण नीति',
  'legal.supportHeading': 'ग्राहक सहायता और डायग्नोस्टिक जानकारी',

  // ==========================================
  // ClaimRadar & Deadline Urgency Banners
  // ==========================================
  'claims.banner.critical':
    'अत्यावश्यक: AWB {awb} के लिए {marketplace} दावा {time} में समाप्त हो रहा है!',
  'claims.banner.warning':
    'समय सीमा सूचना: AWB {awb} के लिए {marketplace} दावा {time} में बंद हो जाएगा।',
  'claims.banner.action': 'दावा तैयार करें',
  'claims.banner.dismiss': 'हटाएं',
  'claims.calendar.export': 'कैलेंडर निर्यात (.ics)',
  'claims.calendar.exported': 'विवाद समय सीमा कैलेंडर (.ics) डाउनलोड किया गया।',
  'claims.notifications.title': 'विवाद समय सीमा सूचनाएं',
  'claims.notifications.description':
    'मार्केटप्लेस विवाद खिड़की समाप्त होने से 24 घंटे और 6 घंटे पहले लोकल रिमाइंडर प्राप्त करें। शून्य प्रचार संदेश।',
  'claims.notifications.enable': 'सूचनाएं सक्षम करें',
  'claims.notifications.enabledToast': 'विवाद सूचनाएं सक्रिय हैं (24 घंटे और 6 घंटे के रिमाइंडर)।',
  'claims.notifications.deniedToast':
    'ब्राउज़र सूचनाएं अवरुद्ध हैं। कृपया ब्राउज़र सेटिंग्स में अनुमति दें।',
  'claims.editWindow.title': 'मार्केटप्लेस दावा खिड़कियां',
  'claims.editWindow.subtitle':
    'अपने सेलर पैनल के अनुसार विवाद दाखिल करने की समय सीमा अनुकूलित करें।',
  'claims.editDate.title': 'रिटर्न डिलीवरी तिथि संपादित करें',
  'claims.editDate.recalculated':
    'रिटर्न डिलीवरी तिथि अपडेट की गई। IST में समय सीमा की पुनर्गणना की गई।',
  'claims.editDate.pastWarning': 'अतीत में वितरित: विवाद विंडो पहले ही समाप्त हो चुकी है।',

  // ==========================================
  // Phone Companion & Pairing
  // ==========================================
  'phone.title': 'फ़ोन साथी (Phone Companion)',
  'phone.subtitle': 'अपने स्मार्टफ़ोन को वायरलेस कैमरा और बारकोड स्कैनर की तरह उपयोग करें',
  'phone.connecting': 'वर्कस्टेशन से कनेक्ट हो रहा है...',
  'phone.connected': 'वर्कस्टेशन से कनेक्टेड',
  'phone.notConfigured':
    'फ़ोन पेयरिंग कॉन्फ़िगर नहीं है। VITE_SUPABASE_URL और VITE_SUPABASE_ANON_KEY सेट करें।',
  'phone.tokenExpired':
    'पेयरिंग क्यूआर कोड समाप्त हो गया है (2 मिनट की सीमा)। वर्कस्टेशन पर नया क्यूआर स्कैन करें।',
  'phone.alreadyPaired': 'वर्कस्टेशन पहले से ही किसी अन्य डिवाइस से जुड़ा हुआ है।',
  'phone.invalidToken': 'अमान्य या उपयोग किया गया पेयरिंग टोकन।',
  'phone.webrtcFailed': 'इस नेटवर्क पर सीधा पीयर कनेक्शन स्थापित नहीं हो सका।',
  'phone.webrtcFailedNextStep':
    'आप फ़ोन पर रिकॉर्डिंग जारी रख सकते हैं; वीडियो सबूत बाद में ट्रांसफ़र करने के लिए फ़ोन पर सुरक्षित सहेजा गया है।',
  'phone.scanBarcode': 'AWB बारकोड स्कैन करें',
  'phone.scanHint': 'कैमरे को AWB या पार्सल बारकोड की ओर रखें',
  'phone.barcodeDetected': 'बारकोड मिला: {code}',
  'phone.startRecording': 'रिकॉर्डिंग शुरू करें',
  'phone.stopRecording': 'रोकें और भेजें',
  'phone.recording': 'रिकॉर्डिंग जारी है...',
  'phone.transferring': 'वर्कस्टेशन को वीडियो भेजा जा रहा है ({percent}%)...',
  'phone.transferSuccess': 'वीडियो सत्यापित हुआ और वर्कस्टेशन वॉल्ट में सुरक्षित सहेजा गया!',
  'phone.transferFailed': 'ट्रांसफ़र रुक गया। वीडियो आपके फ़ोन पर सुरक्षित है।',
  'phone.retryTransfer': 'पुनः प्रयास करें (Retry)',
  'phone.downloadLocal': 'फ़ोन में वीडियो डाउनलोड करें',
  'phone.callInterruption': 'इनकमिंग कॉल या ऐप बदलने के कारण रिकॉर्डिंग सुरक्षित सहेज ली गई है।',
  'phone.batteryWarning': 'कम बैटरी: फ़्रेम ड्रॉप से बचने के लिए फ़ोन को चार्जर से जोड़ें।',
  'phone.storageWarning': 'कम मेमोरी: फ़ोन में 100 MB से कम स्टोरेज उपलब्ध है।',
  'phone.cameraPermissionDenied': 'कैमरा अनुमति अस्वीकृत। कृपया ब्राउज़र में कैमरा अनुमति दें।',
  'phone.switchCamera': 'कैमरा बदलें',
  'phone.offlineMode': 'ऑफ़लाइन मोड (स्थानीय सेव)',
  'phone.enterDetails': 'रिकॉर्डिंग शुरू करने के लिए AWB / ऑर्डर विवरण दर्ज करें',
  'phone.awb': 'AWB नंबर',
  'phone.orderId': 'ऑर्डर आईडी',
  'phone.sku': 'SKU',
  'phone.qty': 'मात्रा (Qty)',
  'phone.modeDispatch': 'डिस्पैच (Dispatch)',
  'phone.modeReturn': 'रिटर्न अनबॉक्सिंग (Return)',
  'phone.takePhoto': 'सबूत फोटो लें',
  'phone.photoTaken': 'सबूत फोटो सहेजी गई'
};
