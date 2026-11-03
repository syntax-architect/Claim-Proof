/**
 * SABOOT Suite — Template-Based Dispute Messages Configuration
 *
 * Rules:
 * - Templates live in this centralized config file.
 * - Factual and polite tone.
 * - No legal or policy citations (no statutory acts, court references, or marketplace policy rubrics).
 * - No accusatory words (e.g. fraud, scam, cheat, theft).
 * - Multi-language support: English (en) and Hindi (hi).
 */

export type DisputeTemplateLanguage = 'en' | 'hi';
export type DisputeTemplateCategory = 'general' | 'wrong_item' | 'damaged' | 'empty';

export interface DisputeTemplateData {
  orderId?: string;
  awb?: string;
  sku?: string;
  dispatchDate?: string;
  returnDate?: string;
  whatWasSent?: string;
  whatWasReceived?: string;
  notes?: string;
}

export interface DisputeTemplateDefinition {
  id: string;
  category: DisputeTemplateCategory;
  language: DisputeTemplateLanguage;
  name: string;
  template: string;
}

export const REQUIRED_DISPUTE_FIELDS: (keyof DisputeTemplateData)[] = [
  'orderId',
  'awb',
  'sku',
  'dispatchDate',
  'returnDate',
  'whatWasSent',
  'whatWasReceived'
];

export const FIELD_LABELS_EN: Record<keyof DisputeTemplateData, string> = {
  orderId: 'Order ID',
  awb: 'AWB',
  sku: 'SKU',
  dispatchDate: 'Dispatch Date',
  returnDate: 'Return Date',
  whatWasSent: 'What Was Sent',
  whatWasReceived: 'What Was Received',
  notes: 'Additional Notes'
};

export const FIELD_LABELS_HI: Record<keyof DisputeTemplateData, string> = {
  orderId: 'आर्डर आईडी',
  awb: 'AWB / ट्रैकिंग नंबर',
  sku: 'SKU',
  dispatchDate: 'डिस्पैच तिथि',
  returnDate: 'रिटर्न प्राप्ति तिथि',
  whatWasSent: 'भेजा गया सामान',
  whatWasReceived: 'प्राप्त सामान / स्थिति',
  notes: 'अतिरिक्त विवरण'
};

export const DISPUTE_TEMPLATES: DisputeTemplateDefinition[] = [
  // ── ENGLISH TEMPLATES ──────────────────────────────────────────────
  {
    id: 'general_en',
    category: 'general',
    language: 'en',
    name: 'General Discrepancy (English)',
    template: `Subject: Return dispute details for Order {orderId} (AWB: {awb})

Dear Seller Support Team,

We are sharing the verification details for the customer return on Order {orderId}.

Order Information:
- Order ID: {orderId}
- AWB / Tracking: {awb}
- Product Sent: {whatWasSent} (SKU: {sku})
- Dispatch Date: {dispatchDate}
- Return Received Date: {returnDate}
- Condition Observed on Return: {whatWasReceived}

Evidence Details:
We have recorded continuous, uncut video footage covering the dispatch packing process as well as the return unboxing inspection.
- The dispatch clip shows {whatWasSent} packed and sealed in good condition on {dispatchDate}.
- The return unboxing clip recorded on {returnDate} documents the parcel condition upon delivery and the item received: {whatWasReceived}.

We kindly request your team to review the enclosed details and video documentation, and assist with approving the claim for this return.

Thank you for your time and support.

Sincerely,
Seller`
  },
  {
    id: 'wrong_item_en',
    category: 'wrong_item',
    language: 'en',
    name: 'Wrong Item Received (English)',
    template: `Subject: Incorrect item received for Order {orderId} (AWB: {awb})

Dear Seller Support Team,

We are writing to report a discrepancy regarding the return received for Order {orderId}.

Order Information:
- Order ID: {orderId}
- AWB / Tracking: {awb}
- Product Sent: {whatWasSent} (SKU: {sku})
- Dispatch Date: {dispatchDate}
- Return Received Date: {returnDate}
- Item Received in Return: {whatWasReceived}

Evidence Details:
We maintain uncut video recordings for both outbound packing and inbound return inspection.
- Dispatch verification on {dispatchDate} shows the item, {whatWasSent}, verified by barcode and packed securely.
- Return unboxing on {returnDate} shows the parcel opened on camera, where a different item was found: {whatWasReceived}.

We have retained the package and item as received. We kindly ask you to verify the footage and process appropriate compensation for this order.

Thank you for your assistance.

Sincerely,
Seller`
  },
  {
    id: 'damaged_en',
    category: 'damaged',
    language: 'en',
    name: 'Damaged Item (English)',
    template: `Subject: Damaged return received for Order {orderId} (AWB: {awb})

Dear Seller Support Team,

We are submitting details regarding a damaged return parcel for Order {orderId}.

Order Information:
- Order ID: {orderId}
- AWB / Tracking: {awb}
- Product Sent: {whatWasSent} (SKU: {sku})
- Dispatch Date: {dispatchDate}
- Return Received Date: {returnDate}
- Damage Observed: {whatWasReceived}

Evidence Details:
Continuous video was recorded for both outbound packing and inbound unboxing.
- The dispatch recording from {dispatchDate} shows {whatWasSent} was intact, unused, and carefully packed.
- The return unboxing recording from {returnDate} shows the parcel seal opened on camera, revealing the damage: {whatWasReceived}.

We kindly request you to inspect the attached evidence and approve the compensation claim for the damaged item.

Thank you for your understanding and prompt support.

Sincerely,
Seller`
  },
  {
    id: 'empty_en',
    category: 'empty',
    language: 'en',
    name: 'Empty Package (English)',
    template: `Subject: Empty package return received for Order {orderId} (AWB: {awb})

Dear Seller Support Team,

We are writing to share details regarding a return received without its contents for Order {orderId}.

Order Information:
- Order ID: {orderId}
- AWB / Tracking: {awb}
- Product Sent: {whatWasSent} (SKU: {sku})
- Dispatch Date: {dispatchDate}
- Return Received Date: {returnDate}
- Return Package State: {whatWasReceived}

Evidence Details:
Continuous, uncut video recordings document both dispatch and return stages.
- The dispatch recording on {dispatchDate} verifies {whatWasSent} was placed inside the package before sealing.
- The return unboxing recording on {returnDate} documents the outer package condition and confirms the contents inside: {whatWasReceived}.

We kindly ask your team to review the unboxing footage and assist us with approving this dispute claim.

Thank you for your assistance.

Sincerely,
Seller`
  },

  // ── HINDI TEMPLATES ────────────────────────────────────────────────
  {
    id: 'general_hi',
    category: 'general',
    language: 'hi',
    name: 'सामान्य विवरण (Hindi)',
    template: `विषय: आर्डर {orderId} (AWB: {awb}) के रिटर्न संबंध में विवरण

प्रिय सेलर सपोर्ट टीम,

हम आर्डर {orderId} के ग्राहक रिटर्न के सत्यापन का विवरण प्रस्तुत कर रहे हैं।

आर्डर विवरण:
- आर्डर आईडी: {orderId}
- AWB / ट्रैकिंग नंबर: {awb}
- भेजा गया सामान: {whatWasSent} (SKU: {sku})
- डिस्पैच तिथि: {dispatchDate}
- रिटर्न प्राप्ति तिथि: {returnDate}
- रिटर्न में प्राप्त स्थिति: {whatWasReceived}

साक्ष्य विवरण:
हमारे पास पार्सल की डिस्पैच पैकिंग और रिटर्न अनबॉक्सिंग दोनों की लगातार बिना कटी हुई (uncut) वीडियो रिकॉर्डिंग उपलब्ध है।
- डिस्पैच वीडियो में {dispatchDate} को {whatWasSent} सही स्थिति में पैक और सील किया गया दिखाई देता है।
- {returnDate} को रिकॉर्ड किए गए रिटर्न अनबॉक्सिंग वीडियो में पार्सल खोलने पर प्राप्त स्थिति दर्ज है: {whatWasReceived}।

कृपया संलग्न विवरण और वीडियो रिकॉर्डिंग की समीक्षा करें और इस रिटर्न के लिए क्लेम स्वीकृत करने में सहायता प्रदान करें।

आपके सहयोग के लिए धन्यवाद।

सादर,
सेलर`
  },
  {
    id: 'wrong_item_hi',
    category: 'wrong_item',
    language: 'hi',
    name: 'भिन्न सामान प्राप्त हुआ (Hindi)',
    template: `विषय: आर्डर {orderId} (AWB: {awb}) में भिन्न सामान प्राप्त होने के संबंध में

प्रिय सेलर सपोर्ट टीम,

हम आर्डर {orderId} के रिटर्न में प्राप्त सामान में अंतर के संबंध में सूचित कर रहे हैं।

आर्डर विवरण:
- आर्डर आईडी: {orderId}
- AWB / ट्रैकिंग नंबर: {awb}
- भेजा गया सामान: {whatWasSent} (SKU: {sku})
- डिस्पैच तिथि: {dispatchDate}
- रिटर्न प्राप्ति तिथि: {returnDate}
- रिटर्न में प्राप्त सामान: {whatWasReceived}

साक्ष्य विवरण:
हमारे पास डिस्पैच पैकिंग और रिटर्न अनबॉक्सिंग दोनों की बिना कटी हुई वीडियो रिकॉर्डिंग उपलब्ध है।
- {dispatchDate} के डिस्पैच वीडियो में सामान {whatWasSent} बारकोड जांच के साथ पैक किया गया है।
- {returnDate} को रिटर्न पार्सल कैमरे के सामने खोलने पर भिन्न सामान पाया गया: {whatWasReceived}।

हमने प्राप्त पार्सल और सामान को सुरक्षित रखा है। कृपया वीडियो की जांच कर इस आर्डर के लिए उचित क्लेम स्वीकृत करने में सहायता करें।

आपके सहयोग के लिए धन्यवाद।

सादर,
सेलर`
  },
  {
    id: 'damaged_hi',
    category: 'damaged',
    language: 'hi',
    name: 'क्षतिग्रस्त सामान (Hindi)',
    template: `विषय: आर्डर {orderId} (AWB: {awb}) के क्षतिग्रस्त रिटर्न के संबंध में

प्रिय सेलर सपोर्ट टीम,

हम आर्डर {orderId} के क्षतिग्रस्त रिटर्न पार्सल के संबंध में विवरण प्रस्तुत कर रहे हैं।

आर्डर विवरण:
- आर्डर आईडी: {orderId}
- AWB / ट्रैकिंग नंबर: {awb}
- भेजा गया सामान: {whatWasSent} (SKU: {sku})
- डिस्पैच तिथि: {dispatchDate}
- रिटर्न प्राप्ति तिथि: {returnDate}
- क्षति का विवरण: {whatWasReceived}

साक्ष्य विवरण:
हमारे पास डिस्पैच पैकिंग और रिटर्न अनबॉक्सिंग दोनों का निरंतर वीडियो रिकॉर्ड है।
- {dispatchDate} के डिस्पैच वीडियो से स्पष्ट है कि {whatWasSent} सही स्थिति में भेजा गया था।
- {returnDate} के रिटर्न अनबॉक्सिंग वीडियो में पार्सल कैमरे के सामने खोलते ही क्षति दर्ज हुई: {whatWasReceived}।

कृपया संलग्न साक्ष्य की जांच कर क्षतिग्रस्त वस्तु के लिए क्लेम स्वीकृत करने की कृपा करें।

सहयोग के लिए धन्यवाद।

सादर,
सेलर`
  },
  {
    id: 'empty_hi',
    category: 'empty',
    language: 'hi',
    name: 'सामग्री प्राप्त नहीं हुई / खाली पार्सल (Hindi)',
    template: `विषय: आर्डर {orderId} (AWB: {awb}) में सामग्री प्राप्त न होने के संबंध में

प्रिय सेलर सपोर्ट टीम,

हम आर्डर {orderId} के रिटर्न में सामग्री प्राप्त न होने के संबंध में सूचित कर रहे हैं।

आर्डर विवरण:
- आर्डर आईडी: {orderId}
- AWB / ट्रैकिंग नंबर: {awb}
- भेजा गया सामान: {whatWasSent} (SKU: {sku})
- डिस्पैच तिथि: {dispatchDate}
- रिटर्न प्राप्ति तिथि: {returnDate}
- रिटर्न पार्सल की स्थिति: {whatWasReceived}

साक्ष्य विवरण:
डिस्पैच और रिटर्न दोनों चरणों की लगातार बिना कटी हुई वीडियो रिकॉर्डिंग उपलब्ध है।
- {dispatchDate} की डिस्पैच रिकॉर्डिंग से पुष्टि होती है कि {whatWasSent} पार्सल में रखकर सील किया गया था।
- {returnDate} की रिटर्न अनबॉक्सिंग रिकॉर्डिंग में पार्सल खोलने पर स्थिति दर्ज है: {whatWasReceived}।

कृपया अनबॉक्सिंग वीडियो की समीक्षा करें और इस विवाद के समाधान में सहायता प्रदान करें।

आपके सहयोग के लिए धन्यवाद।

सादर,
सेलर`
  }
];

export function getDisputeTemplate(
  category: DisputeTemplateCategory,
  language: DisputeTemplateLanguage
): DisputeTemplateDefinition {
  const found = DISPUTE_TEMPLATES.find((t) => t.category === category && t.language === language);
  if (found) return found;
  // Fallback to general template in requested language or general_en
  return (
    DISPUTE_TEMPLATES.find((t) => t.category === 'general' && t.language === language) ??
    DISPUTE_TEMPLATES[0]
  );
}

export function isFieldMissing(val?: string | null): boolean {
  if (val === undefined || val === null) return true;
  const trimmed = val.trim();
  if (trimmed === '') return true;
  const upper = trimmed.toUpperCase();
  if (upper === 'UNKNOWN' || upper === 'N/A' || upper === 'NONE') return true;
  return false;
}

export interface DisputeRenderToken {
  type: 'text' | 'field';
  key?: keyof DisputeTemplateData;
  label?: string;
  value: string;
  isMissing: boolean;
}

export interface DisputeRenderResult {
  text: string;
  missingFields: (keyof DisputeTemplateData)[];
  tokens: DisputeRenderToken[];
}

/**
 * Renders a dispute template by substituting placeholders with data.
 * Missing fields are tracked and rendered with a highlighted missing tag.
 */
export function renderDisputeTemplate(
  templateString: string,
  data: DisputeTemplateData,
  language: DisputeTemplateLanguage = 'en'
): DisputeRenderResult {
  const labels = language === 'hi' ? FIELD_LABELS_HI : FIELD_LABELS_EN;
  const missingSet = new Set<keyof DisputeTemplateData>();
  const tokens: DisputeRenderToken[] = [];

  const regex = /\{(\w+)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(templateString)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        value: templateString.slice(lastIndex, match.index),
        isMissing: false
      });
    }

    const fieldKey = match[1] as keyof DisputeTemplateData;
    const label = labels[fieldKey] || fieldKey;
    const rawVal = data[fieldKey];

    if (isFieldMissing(rawVal)) {
      missingSet.add(fieldKey);
      tokens.push({
        type: 'field',
        key: fieldKey,
        label,
        value: `[MISSING: ${label}]`,
        isMissing: true
      });
    } else {
      tokens.push({
        type: 'field',
        key: fieldKey,
        label,
        value: String(rawVal).trim(),
        isMissing: false
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < templateString.length) {
    tokens.push({
      type: 'text',
      value: templateString.slice(lastIndex),
      isMissing: false
    });
  }

  // If notes provided, optionally append at bottom if not already in template
  if (data.notes && data.notes.trim() && !templateString.includes('{notes}')) {
    const notesHeading = language === 'hi' ? '\nअतिरिक्त टिप्पणी:' : '\nAdditional Notes:';
    tokens.push({
      type: 'text',
      value: `\n${notesHeading} ${data.notes.trim()}\n`,
      isMissing: false
    });
  }

  const text = tokens.map((t) => t.value).join('');
  return {
    text,
    missingFields: Array.from(missingSet),
    tokens
  };
}
