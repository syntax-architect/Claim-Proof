/* SmartLabel SKU+ — the Phase 2 engine.
 * Parses Indian marketplace shipping-label PDFs with pdfjs-dist and rebuilds
 * them as lossless vector crops (pdf-lib): 4×6 / 4×4 / 4-per-A4, bold SKU
 * stamps, multi-quantity guards, courier sorting and a handover manifest. */

import { BRAND } from '../config/brand';
import type { CropPreset, CourierPartner, ExtractedLabel, Marketplace } from '../types';
import { ddMmm, formatIST, istDateKey } from '../lib/dateUtils';

type PdfLib = typeof import('pdf-lib');
type OutDoc = Awaited<ReturnType<PdfLib['PDFDocument']['create']>>;
type PdfRgb = PdfLib['rgb'];

export interface CropOptions {
  preset: CropPreset;
  stampSku: boolean;
  multiQtyGuard: boolean;
  valmoPlusAsValmo: boolean;
  withManifest: boolean;
  isFree?: boolean;
}

export interface ProcessResult {
  pdfBytes: Uint8Array;
  fileName: string;
  labels: ExtractedLabel[];
  manifestData?: unknown;
}

export type ProgressFn = (done: number, total: number, stage: string) => void;

/* ── pdfjs bootstrap (worker wired once per session) ─────────────────── */

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function getPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      if (typeof process !== 'undefined' && process.versions?.node) {
        try {
          const nodePath = 'node:path';
          const nodeUrl = 'node:url';
          const path = (await import(/* @vite-ignore */ nodePath)) as typeof import('node:path');
          const url = (await import(/* @vite-ignore */ nodeUrl)) as typeof import('node:url');
          pdfjs.GlobalWorkerOptions.workerSrc = url.pathToFileURL(
            path.resolve(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
          ).href;
        } catch {
          /* fake worker fallback */
        }
      } else {
        const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      }
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

/* ── text-layer model ────────────────────────────────────────────────── */

interface TextChunk {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx?: number;
  vy?: number;
  vw?: number;
  vh?: number;
}

interface PageInfo {
  fileIndex: number;
  fileName: string;
  pageIndex: number;
  pageW: number;
  pageH: number;
  rotation?: number;
  chunks: TextChunk[];
}

function collectChunks(
  items: unknown[],
  viewport?: { convertToViewportPoint(x: number, y: number): number[] }
): TextChunk[] {
  const chunks: TextChunk[] = [];
  for (const raw of items) {
    const item = raw as { str?: string; transform?: number[]; width?: number; height?: number };
    if (typeof item.str !== 'string' || !item.transform) continue;
    if (!item.str.trim()) continue;
    const t = item.transform;
    const x = t[4];
    const y = t[5];
    const w = item.width ?? item.str.length * 4;
    const h = item.height ?? (Math.abs(t[3]) || 8);
    let vx = x;
    let vy = y;
    let vw = w;
    let vh = h;
    if (viewport && typeof viewport.convertToViewportPoint === 'function') {
      const [vx1, vy1] = viewport.convertToViewportPoint(x, y);
      const [vx2, vy2] = viewport.convertToViewportPoint(x + w, y + h);
      vx = Math.min(vx1, vx2);
      vy = Math.min(vy1, vy2);
      vw = Math.abs(vx2 - vx1);
      vh = Math.abs(vy2 - vy1);
    }
    chunks.push({
      str: item.str,
      x,
      y,
      w,
      h,
      vx,
      vy,
      vw,
      vh
    });
  }
  return chunks;
}

export function cleanText(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

export function chunksToText(chunks: TextChunk[]): string {
  if (chunks.length === 0) return '';
  const sorted = [...chunks].sort((a, b) => {
    const ay = a.vy !== undefined ? a.vy : -a.y;
    const by = b.vy !== undefined ? b.vy : -b.y;
    if (Math.abs(ay - by) > 3) return ay - by;
    const ax = a.vx !== undefined ? a.vx : a.x;
    const bx = b.vx !== undefined ? b.vx : b.x;
    return ax - bx;
  });
  const lines: TextChunk[][] = [];
  for (const chunk of sorted) {
    const line = lines[lines.length - 1];
    const cy = chunk.vy !== undefined ? chunk.vy : -chunk.y;
    const ly = line ? (line[0].vy !== undefined ? line[0].vy : -line[0].y) : 0;
    const ch = chunk.vh !== undefined ? chunk.vh : chunk.h;
    if (line && Math.abs(ly - cy) <= Math.max(4, (ch || 8) * 0.5)) {
      line.push(chunk);
    } else {
      lines.push([chunk]);
    }
  }
  return lines
    .map((line) =>
      line
        .sort((a, b) => {
          const ax = a.vx !== undefined ? a.vx : a.x;
          const bx = b.vx !== undefined ? b.vx : b.x;
          return ax - bx;
        })
        .map((c) => c.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .join('\n');
}

function contentBox(chunks: TextChunk[]): ExtractedLabel['contentBox'] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of chunks) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.w);
    maxY = Math.max(maxY, c.y + c.h);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 288, h: 432 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/* ── field extraction ────────────────────────────────────────────────── */

export const COURIER_KEYS: [string, CourierPartner][] = [
  ['valmoplus', 'ValmoPlus'],
  ['valmo plus', 'ValmoPlus'],
  ['delhivery', 'Delhivery'],
  ['shadowfax', 'Shadowfax'],
  ['xpressbees', 'Xpressbees'],
  ['ecom express', 'Ecom Express'],
  ['ecomexpress', 'Ecom Express'],
  ['dtdc', 'DTDC'],
  ['ekart', 'Ekart'],
  ['valmo', 'Valmo']
];

export const MARKETPLACE_KEYS: [string, Marketplace][] = [
  ['meesho', 'Meesho'],
  ['flipkart', 'Flipkart'],
  ['amazon', 'Amazon'],
  ['myntra', 'Myntra'],
  ['ajio', 'AJIO'],
  ['snapdeal', 'Snapdeal'],
  ['glowroad', 'GlowRoad']
];

export function firstMatch(text: string, patterns: RegExp[]): string | null {
  const cleaned = cleanText(text);
  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

export function extractAwb(text: string): { awb: string; confidence: number } {
  const cleaned = cleanText(text);

  const labeledPatterns = [
    /(?:^|[^\w])(?:AWB\b|A\.W\.B\.)\s*(?:No\b\.?|Number\b|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{6,23})(?=[^\w-]|$)/i,
    /(?:^|[^\w])Tracking\s*(?:ID\b|No\b\.?|Number\b|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{6,23})(?=[^\w-]|$)/i,
    /(?:^|[^\w])Tracking\s*[:#]\s*([A-Z0-9][A-Z0-9-]{6,23})(?=[^\w-]|$)/i,
    /(?:^|[^\w])Consignment\s*(?:No\b\.?|Number\b|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{6,23})(?=[^\w-]|$)/i,
    /(?:^|[^\w])Waybill\s*(?:No\b\.?|Number\b|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{6,23})(?=[^\w-]|$)/i,
    /(?:^|[^\w])LRN\b\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{6,23})(?=[^\w-]|$)/i
  ];

  for (const re of labeledPatterns) {
    const m = cleaned.match(re);
    if (m && m[1]) {
      const val = m[1].trim().toUpperCase().replace(/\s+/g, '');
      // An AWB must be 7-24 chars and contain at least one digit (rejecting words like "NUMBERS" or "DETAILS")
      if (val.length >= 7 && val.length <= 24 && /\d/.test(val)) {
        return { awb: val, confidence: 1.0 };
      }
    }
  }

  // Fallback: longest standalone digit run between 8 and 18 digits
  let best = '';
  for (const m of cleaned.matchAll(/\b(\d{8,18})\b/g)) {
    if (m[1].length > best.length) best = m[1];
  }
  if (best) {
    return { awb: best, confidence: 0.7 };
  }

  return { awb: '', confidence: 0 };
}

export function extractSku(text: string): { sku: string; confidence: number } {
  const cleaned = cleanText(text);

  const skuPatterns = [
    /(?:^|[^\w])Product\s*(?:Code|SKU|ID)\b\s*[:#\s]\s*([A-Z0-9][A-Z0-9/_.\-+%]{1,35})(?=[^\w/_.\-+%]|$)/i,
    /(?:^|[^\w])Item\s*(?:Code|SKU)\b\s*[:#\s]\s*([A-Z0-9][A-Z0-9/_.\-+%]{1,35})(?=[^\w/_.\-+%]|$)/i,
    /(?:^|[^\w])SKU\s*(?:ID|Code|#)?\b\s*[:#\s]\s*([A-Z0-9][A-Z0-9/_.\-+%]{1,35})(?=[^\w/_.\-+%]|$)/i,
    /(?:^|[^\w])SKU\s*-\s*([A-Z0-9][A-Z0-9/_.\-+%]{1,35})(?=[^\w/_.\-+%]|$)/i
  ];

  for (const re of skuPatterns) {
    const m = cleaned.match(re);
    if (m && m[1]) {
      const val = m[1].trim().toUpperCase();
      if (val.length >= 2 && val.length <= 36) {
        return { sku: val, confidence: 1.0 };
      }
    }
  }

  return { sku: '', confidence: 0 };
}

export function extractOrderId(text: string): { orderId: string; confidence: number } {
  const cleaned = cleanText(text);

  const patterns = [
    /(?:^|[^\w])Order\s*(?:ID|No\.?|Number|#)\b\s*[:#-]?\s*([A-Z0-9][A-Z0-9_-]{4,29})(?=[^\w-]|$)/i,
    /(?:^|[^\w])(OD\d{10,20})\b/i,
    /(?:^|[^\w])(\d{3}-\d{7}-\d{7})\b/
  ];

  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m && m[1]) {
      const val = m[1].trim().toUpperCase();
      if (val.length >= 5 && val.length <= 30) {
        return { orderId: val, confidence: 1.0 };
      }
    }
  }

  return { orderId: 'UNKNOWN', confidence: 0 };
}

export function extractCourier(text: string): { courier: CourierPartner; confidence: number } {
  const lower = cleanText(text).toLowerCase();
  for (const [key, courier] of COURIER_KEYS) {
    if (lower.includes(key)) return { courier, confidence: 1.0 };
  }
  return { courier: 'Unknown', confidence: 0 };
}

export function extractMarketplace(text: string): { marketplace: Marketplace; confidence: number } {
  const lower = cleanText(text).toLowerCase();
  for (const [key, marketplace] of MARKETPLACE_KEYS) {
    if (lower.includes(key)) return { marketplace, confidence: 1.0 };
  }
  return { marketplace: 'Unknown', confidence: 0 };
}

export function extractQty(text: string): { qty: number; confidence: number } {
  const cleaned = cleanText(text);
  const patterns = [
    /(?:^|[^\w])(?:Qty|QTY|Quantity)\s*[:#-]?\s*(\d{1,3})\b/i,
    /(?:^|[^\w])(\d{1,2})\s*(?:pcs|PCS|Pcs|pieces?)\b/i
  ];
  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (n > 0 && Number.isFinite(n)) {
        return { qty: Math.min(99, n), confidence: 1.0 };
      }
    }
  }
  return { qty: 1, confidence: 0.5 };
}

export function extractSize(text: string): { size: string; confidence: number } {
  const cleaned = cleanText(text);
  const patterns = [
    /(?:^|[^\w])Size\s*[:#-]?\s*(FREE\s*SIZE|ONE\s*SIZE|FS)\b/i,
    /(?:^|[^\w])Size\s*[:#-]?\s*([A-Z0-9]{1,10})\b/i
  ];
  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m && m[1]) {
      return { size: m[1].trim().toUpperCase(), confidence: 0.9 };
    }
  }
  return { size: '', confidence: 0 };
}

export function extractColor(text: string): { color: string; confidence: number } {
  const cleaned = cleanText(text);
  const m = cleaned.match(
    /(?:^|[^\w])Colou?r\s*[:#-]?\s*([A-Za-z]+(?:\s+(?!(?:Size|SKU|Qty|Quantity|Order|Item|Price|Fit|Brand)\b)[A-Za-z]+)?)(?=[^\w]|$)/i
  );
  if (m && m[1]) {
    return { color: m[1].trim(), confidence: 0.9 };
  }
  return { color: '', confidence: 0 };
}

export function extractInvoiceTotal(text: string): { total: number | null; confidence: number } {
  const cleaned = cleanText(text);
  const re =
    /(?:Invoice\s*Total|Order\s*Total|Total\s*Amount|Grand\s*Total|Amount\s*Payable|Net\s*Payable|Net\s*Amount|Total\s*Price)\s*[:#-]?\s*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)/i;
  const m = cleaned.match(re);
  if (m && m[1]) {
    const n = Number(m[1].replace(/,/g, ''));
    if (Number.isFinite(n)) {
      return { total: n, confidence: 1.0 };
    }
  }
  return { total: null, confidence: 0 };
}

export function labelFromChunks(
  info: PageInfo,
  chunks: TextChunk[]
): Omit<ExtractedLabel, 'sourceFile' | 'page'> {
  if (chunks.length === 0) {
    return {
      marketplace: 'Unknown',
      awb: '',
      orderId: 'UNKNOWN',
      courier: 'Unknown',
      sku: '',
      size: '',
      color: '',
      qty: 1,
      invoiceTotal: null,
      contentBox: {
        x: 0,
        y: 0,
        w: Math.min(288, info.pageW || 288),
        h: Math.min(432, info.pageH || 432)
      },
      confidence: {
        awb: 0,
        orderId: 0,
        courier: 0,
        marketplace: 0,
        sku: 0,
        qty: 0,
        size: 0,
        color: 0,
        invoiceTotal: 0
      },
      needsManualEdit: true,
      missingFields: ['awb', 'sku'],
      warning:
        'Scanned / image-only PDF detected (no digital text layer). Manual entry or original vector PDF required.',
      isImageOnly: true
    };
  }

  const text = chunksToText(chunks);
  const { awb, confidence: awbConf } = extractAwb(text);
  const { sku, confidence: skuConf } = extractSku(text);
  const { orderId, confidence: orderConf } = extractOrderId(text);
  const { courier, confidence: courierConf } = extractCourier(text);
  const { marketplace, confidence: mktConf } = extractMarketplace(text);
  const { qty, confidence: qtyConf } = extractQty(text);
  const { size, confidence: sizeConf } = extractSize(text);
  const { color, confidence: colorConf } = extractColor(text);
  const { total: invoiceTotal, confidence: totalConf } = extractInvoiceTotal(text);

  const missingFields: ('awb' | 'sku')[] = [];
  if (!awb) missingFields.push('awb');
  if (!sku) missingFields.push('sku');

  const needsManualEdit = missingFields.length > 0;
  const warning = needsManualEdit
    ? `Missing ${missingFields.map((f) => f.toUpperCase()).join(' and ')} — flagged for manual edit.`
    : undefined;

  return {
    marketplace,
    awb,
    orderId,
    courier,
    sku,
    size,
    color,
    qty,
    invoiceTotal,
    contentBox: contentBox(chunks),
    confidence: {
      awb: awbConf,
      orderId: orderConf,
      courier: courierConf,
      marketplace: mktConf,
      sku: skuConf,
      qty: qtyConf,
      size: sizeConf,
      color: colorConf,
      invoiceTotal: totalConf
    },
    needsManualEdit,
    missingFields: needsManualEdit ? missingFields : undefined,
    warning,
    isImageOnly: false
  };
}

/* ── parse pass ──────────────────────────────────────────────────────── */

function chunksInQuadrant(
  chunks: TextChunk[],
  q: number,
  pageW: number,
  pageH: number
): TextChunk[] {
  const col = q % 2;
  const row = Math.floor(q / 2); // 0 = top half
  const x0 = col * (pageW / 2);
  const x1 = x0 + pageW / 2;
  const y0 = row * (pageH / 2);
  const y1 = y0 + pageH / 2;
  return chunks.filter((c) => {
    const cx = c.vx !== undefined ? c.vx + (c.vw ?? c.w) / 2 : c.x + c.w / 2;
    const cy = c.vy !== undefined ? c.vy + (c.vh ?? c.h) / 2 : pageH - (c.y + c.h / 2);
    return cx >= x0 && cx < x1 && cy >= y0 && cy < y1;
  });
}

interface ParsedLabel {
  label: ExtractedLabel;
  fileIndex: number;
  pageIndex: number;
  pageW: number;
  pageH: number;
  /** grid4 only: which quadrant of the source page this label came from. */
  quadrant?: number;
}

export type PdfFileInput = File | { name: string; arrayBuffer(): Promise<ArrayBuffer> };

async function parseFiles(
  files: PdfFileInput[],
  preset: CropPreset,
  onProgress?: ProgressFn
): Promise<{ pages: PageInfo[]; parsed: ParsedLabel[] }> {
  const pdfjs = await getPdfjs();
  const pages: PageInfo[] = [];

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex];
    onProgress?.(
      fileIndex,
      files.length,
      `Parsing labels (${fileIndex + 1}/${files.length}) — ${file.name}`
    );
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const loadingTask = pdfjs.getDocument({ data });
      const doc = await loadingTask.promise;
      for (let pageIndex = 0; pageIndex < doc.numPages; pageIndex++) {
        const page = await doc.getPage(pageIndex + 1);
        const rotation = (page.rotate || 0) % 360;
        const viewport = page.getViewport({ scale: 1, rotation });
        const content = await page.getTextContent();
        const chunks = collectChunks(content.items, viewport);
        pages.push({
          fileIndex,
          fileName: file.name,
          pageIndex,
          pageW: viewport.width,
          pageH: viewport.height,
          rotation,
          chunks
        });
        page.cleanup();
      }
      void loadingTask.destroy();
    } catch (e) {
      console.warn(`[pdfLabelProcessor] skipping unreadable PDF "${file.name}":`, e);
    }
  }

  /* Extraction pass — page-level for full presets, quadrant-level for grid4. */
  const parsed: ParsedLabel[] = [];
  for (const info of pages) {
    if (preset === 'grid4') {
      let anyFound = false;
      for (let q = 0; q < 4; q++) {
        const quadChunks = chunksInQuadrant(info.chunks, q, info.pageW, info.pageH);
        if (quadChunks.length > 0) {
          const extracted = labelFromChunks(info, quadChunks);
          parsed.push({
            label: { ...extracted, sourceFile: info.fileName, page: info.pageIndex + 1 },
            fileIndex: info.fileIndex,
            pageIndex: info.pageIndex,
            pageW: info.pageW,
            pageH: info.pageH,
            quadrant: q
          });
          anyFound = true;
        }
      }
      if (!anyFound) {
        const extracted = labelFromChunks(info, []);
        parsed.push({
          label: { ...extracted, sourceFile: info.fileName, page: info.pageIndex + 1 },
          fileIndex: info.fileIndex,
          pageIndex: info.pageIndex,
          pageW: info.pageW,
          pageH: info.pageH
        });
      }
    } else {
      const extracted = labelFromChunks(info, info.chunks);
      parsed.push({
        label: { ...extracted, sourceFile: info.fileName, page: info.pageIndex + 1 },
        fileIndex: info.fileIndex,
        pageIndex: info.pageIndex,
        pageW: info.pageW,
        pageH: info.pageH
      });
    }
  }

  return { pages, parsed };
}

/* ── sort: Courier → SKU → Quantity (desc) → AWB ─────────────────────── */

function courierSortKey(c: string): string {
  return c === 'Unknown' ? 'zzz_unknown' : c.toLowerCase();
}

function sortParsed(parsed: ParsedLabel[], valmoPlusAsValmo: boolean): ParsedLabel[] {
  const mapped = (c: CourierPartner) => (valmoPlusAsValmo && c === 'ValmoPlus' ? 'Valmo' : c);
  return [...parsed].sort((a, b) => {
    const ca = courierSortKey(mapped(a.label.courier));
    const cb = courierSortKey(mapped(b.label.courier));
    if (ca !== cb) return ca.localeCompare(cb);
    if (a.label.sku !== b.label.sku) return a.label.sku.localeCompare(b.label.sku);
    if (a.label.qty !== b.label.qty) return b.label.qty - a.label.qty;
    return a.label.awb.localeCompare(b.label.awb);
  });
}

/* ── pdf-lib build pass ──────────────────────────────────────────────── */

const PRESET_SIZE: Record<'4x6' | '4x4', [number, number]> = {
  '4x6': [288, 432], // 4 × 6 inches in points
  '4x4': [288, 288]
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

async function buildOutput(
  files: PdfFileInput[],
  parsed: ParsedLabel[],
  opts: CropOptions,
  onProgress?: ProgressFn
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');
  const outDoc = await PDFDocument.create();
  const helv = await outDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await outDoc.embedFont(StandardFonts.HelveticaBold);
  const now = Date.now();

  /* Load each source PDF once. */
  const sourceDocs = new Map<number, Awaited<ReturnType<typeof PDFDocument.create>>>();
  for (const p of parsed) {
    if (!sourceDocs.has(p.fileIndex)) {
      const bytes = new Uint8Array(await files[p.fileIndex].arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      sourceDocs.set(p.fileIndex, doc);
    }
  }

  /* Manifest pages first. */
  if (opts.withManifest && parsed.length > 0) {
    drawManifest(outDoc, parsed, opts, helv, helvBold, now, rgb);
  }

  const ink = rgb(0.07, 0.09, 0.12);
  const guardRed = rgb(0.85, 0.1, 0.1);

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    onProgress?.(
      i,
      parsed.length,
      `Cropping & stamping (${i + 1}/${parsed.length}) — ${p.label.awb || 'Label ' + (i + 1)}`
    );
    const srcDoc = sourceDocs.get(p.fileIndex);
    if (!srcDoc) continue;
    const srcPage = srcDoc.getPage(p.pageIndex);
    const rotation = srcPage.getRotation().angle;
    if (rotation !== 0) {
      srcPage.setRotation(degrees(0));
    }
    const embedded = await outDoc.embedPage(srcPage);

    let outW: number;
    let outH: number;
    let cropX = 0;
    let cropY = 0;

    if (opts.preset === 'grid4') {
      const q = p.quadrant ?? 0;
      const col = q % 2;
      const row = Math.floor(q / 2);
      outW = p.pageW / 2;
      outH = p.pageH / 2;
      cropX = col * outW;
      cropY = row === 0 ? p.pageH / 2 : 0;
    } else {
      const [W, H] = PRESET_SIZE[opts.preset];
      const cb = p.label.contentBox;
      const paddedW = Math.min(p.pageW, cb.w + 30);
      const paddedH = Math.min(p.pageH, cb.h + 40);
      outW = Math.max(W, paddedW);
      outH = Math.max(H, paddedH);
      cropX = clamp(cb.x + cb.w / 2 - outW / 2, 0, Math.max(0, p.pageW - outW));
      cropY = clamp(cb.y + cb.h / 2 - outH / 2, 0, Math.max(0, p.pageH - outH));
    }

    const page = outDoc.addPage([outW, outH]);
    page.drawPage(embedded, { x: -cropX, y: -cropY });

    /* SKU & spec injector — bold strip at the bottom margin. */
    if (opts.stampSku) {
      const stripText = `${p.label.sku || p.label.orderId} | Size: ${p.label.size || '—'} | Qty: ${p.label.qty} | ${ddMmm(now)}`;
      let fontSize = 11;
      while (helvBold.widthOfTextAtSize(stripText, fontSize) > outW - 20 && fontSize > 7.5) {
        fontSize -= 0.5;
      }
      page.drawRectangle({
        x: 6,
        y: 6,
        width: outW - 12,
        height: 19,
        color: rgb(1, 1, 1)
      });
      page.drawText(stripText, {
        x: 10,
        y: 11,
        size: fontSize,
        font: helvBold,
        color: ink
      });
    }

    /* Multi-quantity guard — thick border + high-visibility badge. */
    if (opts.multiQtyGuard && p.label.qty > 1) {
      page.drawRectangle({
        x: 5,
        y: 5,
        width: outW - 10,
        height: outH - 10,
        borderColor: guardRed,
        borderWidth: 4
      });
      const badgeText = `MULTI-QTY: ${p.label.qty} UNITS`;
      const badgeWidth = helvBold.widthOfTextAtSize(badgeText, 9) + 10;
      page.drawRectangle({
        x: outW - badgeWidth - 4,
        y: outH - 22,
        width: badgeWidth,
        height: 17,
        color: guardRed
      });
      page.drawText(badgeText, {
        x: outW - badgeWidth + 1,
        y: outH - 17.5,
        size: 9,
        font: helvBold,
        color: rgb(1, 1, 1)
      });
    }
  }

  return outDoc.save();
}

/* ── warehouse picklist & courier handover manifest ──────────────────── */

function drawManifest(
  outDoc: OutDoc,
  parsed: ParsedLabel[],
  opts: CropOptions,
  helv: import('pdf-lib').PDFFont,
  helvBold: import('pdf-lib').PDFFont,
  now: number,
  rgb: PdfRgb
): void {
  const ink = rgb(0.07, 0.09, 0.12);
  const muted = rgb(0.42, 0.46, 0.52);
  const line = rgb(0.82, 0.84, 0.87);
  const zebra = rgb(0.955, 0.965, 0.975);
  const accent = rgb(0.04, 0.47, 0.36);

  const mappedCourier = (c: CourierPartner) =>
    opts.valmoPlusAsValmo && c === 'ValmoPlus' ? 'Valmo' : c;

  interface Row {
    courier: string;
    sku: string;
    size: string;
    units: number;
    parcels: number;
  }
  const grouped = new Map<string, Row>();
  for (const p of parsed) {
    const courier = mappedCourier(p.label.courier);
    const key = `${courier}||${p.label.sku}`;
    const row = grouped.get(key) ?? {
      courier,
      sku: p.label.sku || '(no SKU)',
      size: p.label.size || '—',
      units: 0,
      parcels: 0
    };
    row.units += p.label.qty;
    row.parcels += 1;
    grouped.set(key, row);
  }
  const rows = [...grouped.values()].sort(
    (a, b) =>
      courierSortKey(a.courier).localeCompare(courierSortKey(b.courier)) ||
      a.sku.localeCompare(b.sku)
  );

  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 42;
  const manifestPages: import('pdf-lib').PDFPage[] = [];
  let page = outDoc.addPage([pageW, pageH]);
  manifestPages.push(page);
  let y = pageH - margin;

  const isFree = opts.isFree ?? true;

  const newPage = () => {
    page = outDoc.addPage([pageW, pageH]);
    manifestPages.push(page);
    y = pageH - margin;
  };
  const ensure = (needed: number) => {
    const bottomCutoff = isFree ? margin + 50 : margin + 25;
    if (y - needed < bottomCutoff) newPage();
  };

  /* Header block. */
  page.drawRectangle({
    x: 0,
    y: pageH - 96,
    width: pageW,
    height: 96,
    color: rgb(0.97, 0.98, 0.985)
  });
  page.drawText('WAREHOUSE PICKLIST & COURIER HANDOVER SUMMARY', {
    x: margin,
    y: pageH - 52,
    size: 16,
    font: helvBold,
    color: accent
  });
  page.drawText(`Generated ${formatIST(now)}  ·  ${BRAND.domain} — SmartLabel SKU+`, {
    x: margin,
    y: pageH - 72,
    size: 9,
    font: helv,
    color: muted
  });
  const grandParcels = parsed.length;
  const grandUnits = parsed.reduce((s, p) => s + p.label.qty, 0);
  page.drawText(`${rows.length} SKU groups  ·  ${grandParcels} parcels  ·  ${grandUnits} units`, {
    x: margin,
    y: pageH - 86,
    size: 9,
    font: helvBold,
    color: ink
  });
  y = pageH - 116;

  /* Table header. */
  const colX = [margin, margin + 150, margin + 330, margin + 390, margin + 450];
  const drawTableHeader = () => {
    page.drawText('COURIER', { x: colX[0], y, size: 8.5, font: helvBold, color: muted });
    page.drawText('SKU', { x: colX[1], y, size: 8.5, font: helvBold, color: muted });
    page.drawText('SIZE', { x: colX[2], y, size: 8.5, font: helvBold, color: muted });
    page.drawText('UNITS', { x: colX[3], y, size: 8.5, font: helvBold, color: muted });
    page.drawText('PARCELS', { x: colX[4], y, size: 8.5, font: helvBold, color: muted });
    page.drawLine({
      start: { x: margin, y: y - 5 },
      end: { x: pageW - margin, y: y - 5 },
      thickness: 0.8,
      color: line
    });
    y -= 20;
  };
  drawTableHeader();

  let currentCourier = '';
  for (const row of rows) {
    if (row.courier !== currentCourier) {
      currentCourier = row.courier;
      ensure(46);
      const courierParcels = rows
        .filter((r) => r.courier === currentCourier)
        .reduce((s, r) => s + r.parcels, 0);
      const courierUnits = rows
        .filter((r) => r.courier === currentCourier)
        .reduce((s, r) => s + r.units, 0);
      page.drawRectangle({
        x: margin - 4,
        y: y - 4,
        width: pageW - 2 * margin + 8,
        height: 20,
        color: zebra
      });
      page.drawText(`${currentCourier.toUpperCase()}`, {
        x: colX[0],
        y,
        size: 10,
        font: helvBold,
        color: accent
      });
      page.drawText(`${courierParcels} parcels · ${courierUnits} units`, {
        x: colX[1],
        y,
        size: 10,
        font: helvBold,
        color: ink
      });
      y -= 22;
    }
    ensure(18);
    page.drawText(row.sku, { x: colX[1], y, size: 9, font: helv, color: ink });
    page.drawText(row.size, { x: colX[2], y, size: 9, font: helv, color: ink });
    page.drawText(String(row.units), { x: colX[3], y, size: 9, font: helvBold, color: ink });
    page.drawText(String(row.parcels), { x: colX[4], y, size: 9, font: helv, color: ink });
    y -= 16;
  }

  ensure(isFree ? 85 : 40);
  page.drawLine({
    start: { x: margin, y: y - 2 },
    end: { x: pageW - margin, y: y - 2 },
    thickness: 1,
    color: line
  });
  y -= 18;
  page.drawText(`GRAND TOTAL: ${grandParcels} parcels · ${grandUnits} units`, {
    x: colX[0],
    y,
    size: 10,
    font: helvBold,
    color: ink
  });
  y -= 18;
  page.drawText(
    `Scan every AWB in ${BRAND.name} before sealing — claim windows start at return scan.`,
    {
      x: colX[0],
      y,
      size: 8,
      font: helv,
      color: muted
    }
  );

  if (isFree) {
    y -= 14;
    page.drawRectangle({
      x: margin,
      y: y - 36,
      width: pageW - 2 * margin,
      height: 36,
      color: rgb(0.95, 0.98, 0.96),
      borderColor: accent,
      borderWidth: 1
    });
    page.drawText(`VERIFIED DISPATCH · PACKED WITH ${BRAND.domain.toUpperCase()} PROOF STUDIO`, {
      x: margin + 12,
      y: y - 16,
      size: 9,
      font: helvBold,
      color: accent
    });
    page.drawText(
      'Uncut HD packing videos & burnt-in live IST timestamp recorded for every AWB in this manifest.',
      {
        x: margin + 12,
        y: y - 28,
        size: 7.5,
        font: helv,
        color: ink
      }
    );
    y -= 44;
  }

  // Draw viral footer on all manifest pages for Free tier users
  if (isFree) {
    for (const p of manifestPages) {
      p.drawRectangle({
        x: margin,
        y: 14,
        width: pageW - 2 * margin,
        height: 22,
        color: rgb(0.96, 0.98, 0.97),
        borderColor: rgb(0.04, 0.47, 0.36),
        borderWidth: 0.8
      });
      p.drawText(`Packed with ${BRAND.domain} — Barcode Verified Proof Studio`, {
        x: margin + 10,
        y: 21,
        size: 8.5,
        font: helvBold,
        color: accent
      });
      const tagText = `Free 4×6 Label Cropper & Return Dispute Proof · ${BRAND.domain}`;
      const tagW = helv.widthOfTextAtSize(tagText, 7.5);
      p.drawText(tagText, {
        x: pageW - margin - tagW - 10,
        y: 21.5,
        size: 7.5,
        font: helv,
        color: muted
      });
    }
  } else {
    // For paid users, a clean white-label confidentiality notice at the bottom
    for (const p of manifestPages) {
      const cleanText = 'CONFIDENTIAL WAREHOUSE DISPATCH MANIFEST · AUTHORIZED COURIER HANDOVER';
      p.drawText(cleanText, {
        x: margin,
        y: 18,
        size: 7.5,
        font: helv,
        color: muted
      });
    }
  }
}

/* ── public entry point ──────────────────────────────────────────────── */

export async function processLabelFiles(
  files: PdfFileInput[],
  opts: CropOptions,
  onProgress?: ProgressFn
): Promise<ProcessResult> {
  if (files.length === 0) {
    throw new Error('No PDF files were provided.');
  }

  const { parsed } = await parseFiles(files, opts.preset, onProgress);

  if (parsed.length === 0) {
    throw new Error(
      'No shipping labels could be parsed from the selected PDFs. Make sure these are marketplace label PDFs with machine-readable text (not photos of labels).'
    );
  }

  const sorted = sortParsed(parsed, opts.valmoPlusAsValmo);
  const pdfBytes = await buildOutput(files, sorted, opts, onProgress);

  const hhmm = new Date().toTimeString().slice(0, 5).replace(':', '');
  return {
    pdfBytes,
    fileName: `${BRAND.name}_Labels_${istDateKey()}_${hhmm}.pdf`,
    labels: sorted.map((p) => ({
      ...p.label,
      courier:
        opts.valmoPlusAsValmo && p.label.courier === 'ValmoPlus'
          ? ('Valmo' as CourierPartner)
          : p.label.courier
    }))
  };
}

/** Parses raw PDF bytes into extracted shipping labels with field confidence scores. */
export async function parsePdfBuffer(
  buffer: Uint8Array | ArrayBuffer,
  fileName = 'input.pdf',
  preset: CropPreset = '4x6'
): Promise<ExtractedLabel[]> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const fakeFile: PdfFileInput = {
    name: fileName,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  };
  const { parsed } = await parseFiles([fakeFile], preset);
  return parsed.map((p) => p.label);
}
