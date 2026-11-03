import type { Marketplace } from '../types';

export type ReturnCondition = 'good' | 'wrong_item' | 'empty' | 'damaged' | 'used_worn';

export interface ReturnConditionOption {
  value: ReturnCondition;
  label: string;
  description: string;
  tone: 'success' | 'danger' | 'warn';
}

export const RETURN_CONDITIONS: ReturnConditionOption[] = [
  {
    value: 'good',
    label: 'Good / Intact',
    description: 'Original item received in resellable, intact condition with tags.',
    tone: 'success'
  },
  {
    value: 'wrong_item',
    label: 'Wrong / Swapped Item',
    description: 'Different item, stone, dummy, or incorrect variant inside.',
    tone: 'danger'
  },
  {
    value: 'empty',
    label: 'Empty Package',
    description: 'Outer flyer was sealed but zero item was found inside.',
    tone: 'danger'
  },
  {
    value: 'damaged',
    label: 'Damaged Product',
    description: 'Broken, scratched, dented, or leaked product.',
    tone: 'danger'
  },
  {
    value: 'used_worn',
    label: 'Used / Worn',
    description: 'Item shows clear signs of prior use, missing tags, or wash marks.',
    tone: 'warn'
  }
];

export interface EvidenceChecklistStep {
  id: string;
  order: number;
  title: string;
  instruction: string;
  required: boolean;
  hotkey: string;
}

export interface MarketplaceChecklistProfile {
  marketplace: Marketplace;
  displayName: string;
  status: 'UNVERIFIED - check your seller panel' | 'VERIFIED';
  notes: string;
  continuousRecordingMandatory: boolean;
  steps: EvidenceChecklistStep[];
}

export const EVIDENCE_CHECKLIST_PROFILES: Record<Marketplace, MarketplaceChecklistProfile> = {
  Meesho: {
    marketplace: 'Meesho',
    displayName: 'Meesho Return Unboxing',
    status: 'UNVERIFIED - check your seller panel',
    notes:
      'Requires 360-degree view of sealed flyer, clear AWB scan, and uncut opening for Wrong/Defective/Empty dispute tickets.',
    continuousRecordingMandatory: true,
    steps: [
      {
        id: 'show_label',
        order: 1,
        title: 'Show sealed parcel & AWB',
        instruction:
          'Hold the shipping label close to the camera so the AWB barcode, order ID, and courier name are legible.',
        required: true,
        hotkey: '1'
      },
      {
        id: 'show_six_sides',
        order: 2,
        title: 'Show all 6 sides of flyer',
        instruction:
          'Rotate the parcel to prove all six sides and corners are intact without prior tampering or cuts.',
        required: true,
        hotkey: '2'
      },
      {
        id: 'open_uncut',
        order: 3,
        title: 'Cut & open parcel (continuous)',
        instruction:
          'Cut open the tamper-evident flyer on camera without moving it out of frame and without pausing.',
        required: true,
        hotkey: '3'
      },
      {
        id: 'show_item_tags',
        order: 4,
        title: 'Show item & brand tags',
        instruction:
          'Pull out the product and display all attached tags, barcode stickers, and inner polybags.',
        required: true,
        hotkey: '4'
      },
      {
        id: 'show_damage_diff',
        order: 5,
        title: 'Show damage, defect or swap',
        instruction:
          'Show any broken pieces, scratches, different item model, or missing accessories in close-up.',
        required: true,
        hotkey: '5'
      },
      {
        id: 'state_condition',
        order: 6,
        title: 'Declare final condition',
        instruction: 'Select final package condition below before ending the recording.',
        required: true,
        hotkey: '6'
      }
    ]
  },
  Flipkart: {
    marketplace: 'Flipkart',
    displayName: 'Flipkart / SPF Return Unboxing',
    status: 'UNVERIFIED - check your seller panel',
    notes:
      'Seller Protection Fund (SPF) claims demand uncut video starting from sealed courier bag with readable tracking ID.',
    continuousRecordingMandatory: true,
    steps: [
      {
        id: 'show_label',
        order: 1,
        title: 'Show sealed flyer & AWB',
        instruction:
          'Hold the tracking label up to the lens ensuring the tracking ID is razor sharp.',
        required: true,
        hotkey: '1'
      },
      {
        id: 'show_six_sides',
        order: 2,
        title: '360° view of all 6 sides',
        instruction: 'Show all six sides of the polybag or box to establish seal integrity.',
        required: true,
        hotkey: '2'
      },
      {
        id: 'open_uncut',
        order: 3,
        title: 'Continuous unboxing cut',
        instruction: 'Open the parcel with zero cuts, pauses, or camera repositioning.',
        required: true,
        hotkey: '3'
      },
      {
        id: 'show_item_tags',
        order: 4,
        title: 'Inspect product & MRP tag',
        instruction: 'Display the product, MRP label, barcode, and packaging inside.',
        required: true,
        hotkey: '4'
      },
      {
        id: 'show_damage_diff',
        order: 5,
        title: 'Highlight discrepancy / defect',
        instruction: 'Highlight damage, wrong brand, empty container, or used appearance clearly.',
        required: true,
        hotkey: '5'
      },
      {
        id: 'state_condition',
        order: 6,
        title: 'Confirm unboxing outcome',
        instruction: 'Confirm whether this is good, damaged, wrong item, or empty.',
        required: true,
        hotkey: '6'
      }
    ]
  },
  Amazon: {
    marketplace: 'Amazon',
    displayName: 'Amazon SAFE-T Return Unboxing',
    status: 'UNVERIFIED - check your seller panel',
    notes:
      'SAFE-T claims accept continuous unboxing footage proving returned item differs from dispatched SKU.',
    continuousRecordingMandatory: true,
    steps: [
      {
        id: 'show_label',
        order: 1,
        title: 'Show carrier label & tracking',
        instruction: 'Show tracking number and Amazon return RMA / Order ID label.',
        required: true,
        hotkey: '1'
      },
      {
        id: 'show_six_sides',
        order: 2,
        title: 'Display all six sides',
        instruction: 'Show front, back, top, bottom, and side seals clearly.',
        required: true,
        hotkey: '2'
      },
      {
        id: 'open_uncut',
        order: 3,
        title: 'Uncut unboxing',
        instruction: 'Slit seal and open box/bag completely on camera without cuts.',
        required: true,
        hotkey: '3'
      },
      {
        id: 'show_item_tags',
        order: 4,
        title: 'Show received SKU & ASIN',
        instruction: 'Examine serial number, ASIN/FNSKU barcode, and item appearance.',
        required: true,
        hotkey: '4'
      },
      {
        id: 'show_damage_diff',
        order: 5,
        title: 'Show discrepancies',
        instruction: 'Capture missing components, damage, or swapped merchandise.',
        required: true,
        hotkey: '5'
      },
      {
        id: 'state_condition',
        order: 6,
        title: 'Confirm condition tag',
        instruction: 'Select condition tag before submitting to evidence vault.',
        required: true,
        hotkey: '6'
      }
    ]
  },
  Myntra: {
    marketplace: 'Myntra',
    displayName: 'Myntra Return Unboxing',
    status: 'UNVERIFIED - check your seller panel',
    notes:
      'Myntra partner claims require proof of original garment security tag, brand tag, and absence of odor/wear.',
    continuousRecordingMandatory: true,
    steps: [
      {
        id: 'show_label',
        order: 1,
        title: 'Show Myntra logistics label',
        instruction: 'Display AWB, forward tracking, and return airway bill clearly.',
        required: true,
        hotkey: '1'
      },
      {
        id: 'show_six_sides',
        order: 2,
        title: 'Inspect outer polybag',
        instruction: 'Show all 6 sides of outer flyer and tamper strip.',
        required: true,
        hotkey: '2'
      },
      {
        id: 'open_uncut',
        order: 3,
        title: 'Open without interruption',
        instruction: 'Slice open bag while keeping parcel continuously visible.',
        required: true,
        hotkey: '3'
      },
      {
        id: 'show_item_tags',
        order: 4,
        title: 'Verify security & brand tag',
        instruction: 'Display intact plastic security loop tag, brand tag, and wash care label.',
        required: true,
        hotkey: '4'
      },
      {
        id: 'show_damage_diff',
        order: 5,
        title: 'Check defects / usage',
        instruction: 'Check for makeup marks, perfume smell, stains, or swapped items.',
        required: true,
        hotkey: '5'
      },
      {
        id: 'state_condition',
        order: 6,
        title: 'Mark return condition',
        instruction: 'Select final condition before ending recording.',
        required: true,
        hotkey: '6'
      }
    ]
  },
  AJIO: {
    marketplace: 'AJIO',
    displayName: 'AJIO Return Inspection',
    status: 'UNVERIFIED - check your seller panel',
    notes:
      'AJIO merchant claims mandate inspection of brand packaging, unbroken tags, and intact barcode.',
    continuousRecordingMandatory: true,
    steps: [
      {
        id: 'show_label',
        order: 1,
        title: 'Show AJIO courier label',
        instruction: 'Display AWB barcode and order reference label.',
        required: true,
        hotkey: '1'
      },
      {
        id: 'show_six_sides',
        order: 2,
        title: '6-sided parcel review',
        instruction: 'Show all six surfaces of package to confirm no prior opening.',
        required: true,
        hotkey: '2'
      },
      {
        id: 'open_uncut',
        order: 3,
        title: 'Uncut video opening',
        instruction: 'Open outer polybag continuously on frame.',
        required: true,
        hotkey: '3'
      },
      {
        id: 'show_item_tags',
        order: 4,
        title: 'Inspect brand box & tags',
        instruction: 'Check inner box, garment tags, and accessories.',
        required: true,
        hotkey: '4'
      },
      {
        id: 'show_damage_diff',
        order: 5,
        title: 'Show defect or swap',
        instruction: 'Show damages, incorrect sizes, or swapped products.',
        required: true,
        hotkey: '5'
      },
      {
        id: 'state_condition',
        order: 6,
        title: 'Select condition state',
        instruction: 'Tag final condition before saving.',
        required: true,
        hotkey: '6'
      }
    ]
  },
  Snapdeal: {
    marketplace: 'Snapdeal',
    displayName: 'Snapdeal Return Unboxing',
    status: 'UNVERIFIED - check your seller panel',
    notes: 'Standard 6-sided unboxing verification with continuous recording.',
    continuousRecordingMandatory: true,
    steps: [
      {
        id: 'show_label',
        order: 1,
        title: 'Show shipping label & AWB',
        instruction: 'Show AWB and buyer details on label.',
        required: true,
        hotkey: '1'
      },
      {
        id: 'show_six_sides',
        order: 2,
        title: 'Show all 6 sides',
        instruction: 'Turn parcel on all faces to document intact packaging.',
        required: true,
        hotkey: '2'
      },
      {
        id: 'open_uncut',
        order: 3,
        title: 'Open without cuts',
        instruction: 'Continuous video during opening.',
        required: true,
        hotkey: '3'
      },
      {
        id: 'show_item_tags',
        order: 4,
        title: 'Show product & tags',
        instruction: 'Show product clearly.',
        required: true,
        hotkey: '4'
      },
      {
        id: 'show_damage_diff',
        order: 5,
        title: 'Show difference / damage',
        instruction: 'Document any defects or wrong contents.',
        required: true,
        hotkey: '5'
      },
      {
        id: 'state_condition',
        order: 6,
        title: 'Condition tag',
        instruction: 'Select condition before saving.',
        required: true,
        hotkey: '6'
      }
    ]
  },
  GlowRoad: {
    marketplace: 'GlowRoad',
    displayName: 'GlowRoad Return Unboxing',
    status: 'UNVERIFIED - check your seller panel',
    notes: 'Standard reseller return evidence protocol.',
    continuousRecordingMandatory: true,
    steps: [
      {
        id: 'show_label',
        order: 1,
        title: 'Show label & AWB',
        instruction: 'Present AWB label to camera.',
        required: true,
        hotkey: '1'
      },
      {
        id: 'show_six_sides',
        order: 2,
        title: 'Show 6 sides',
        instruction: 'Inspect outer seals on all six sides.',
        required: true,
        hotkey: '2'
      },
      {
        id: 'open_uncut',
        order: 3,
        title: 'Uncut opening',
        instruction: 'Open parcel continuously.',
        required: true,
        hotkey: '3'
      },
      {
        id: 'show_item_tags',
        order: 4,
        title: 'Show product',
        instruction: 'Show received item and tags.',
        required: true,
        hotkey: '4'
      },
      {
        id: 'show_damage_diff',
        order: 5,
        title: 'Show damage / swap',
        instruction: 'Detail any discrepancy or damage.',
        required: true,
        hotkey: '5'
      },
      {
        id: 'state_condition',
        order: 6,
        title: 'Final condition',
        instruction: 'Tag parcel condition.',
        required: true,
        hotkey: '6'
      }
    ]
  },
  Unknown: {
    marketplace: 'Unknown',
    displayName: 'Universal Return Unboxing',
    status: 'UNVERIFIED - check your seller panel',
    notes:
      'Universal 6-point unboxing evidence checklist recommended for Indian marketplace claims dispute portals.',
    continuousRecordingMandatory: true,
    steps: [
      {
        id: 'show_label',
        order: 1,
        title: 'Show sealed parcel & AWB',
        instruction:
          'Hold the shipping label close to the camera so the AWB barcode, order ID, and courier name are legible.',
        required: true,
        hotkey: '1'
      },
      {
        id: 'show_six_sides',
        order: 2,
        title: 'Show all 6 sides of flyer',
        instruction:
          'Rotate the parcel to prove all six sides and corners are intact without prior tampering or cuts.',
        required: true,
        hotkey: '2'
      },
      {
        id: 'open_uncut',
        order: 3,
        title: 'Cut & open parcel (continuous)',
        instruction:
          'Cut open the tamper-evident flyer on camera without moving it out of frame and without pausing.',
        required: true,
        hotkey: '3'
      },
      {
        id: 'show_item_tags',
        order: 4,
        title: 'Show item & brand tags',
        instruction:
          'Pull out the product and display all attached tags, barcode stickers, and inner polybags.',
        required: true,
        hotkey: '4'
      },
      {
        id: 'show_damage_diff',
        order: 5,
        title: 'Show damage, defect or swap',
        instruction:
          'Show any broken pieces, scratches, different item model, or missing accessories in close-up.',
        required: true,
        hotkey: '5'
      },
      {
        id: 'state_condition',
        order: 6,
        title: 'Declare final condition',
        instruction: 'Select final package condition below before ending the recording.',
        required: true,
        hotkey: '6'
      }
    ]
  }
};

export function getChecklistProfile(marketplace?: Marketplace): MarketplaceChecklistProfile {
  if (!marketplace || !(marketplace in EVIDENCE_CHECKLIST_PROFILES)) {
    return EVIDENCE_CHECKLIST_PROFILES.Unknown;
  }
  return EVIDENCE_CHECKLIST_PROFILES[marketplace];
}
