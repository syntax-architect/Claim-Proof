/* SmartLabel SKU+ — the Phase 2 engine.
 * Parses Indian marketplace shipping-label PDFs with pdfjs-dist and rebuilds
 * them as lossless vector crops (pdf-lib): 4×6 / 4×4 / 4-per-A4, bold SKU
 * stamps, multi-quantity guards, courier sorting and a handover manifest. */

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
}

export interface ProcessResult {
  pdfBytes: Uint8Array;
  fileName: string;
  labels: ExtractedLabel[];
}

export type ProgressFn = (done: number, total: number, stage: string) => void;

/* ── pdfjs bootstrap (worker wired once per session) ─────────────────── */

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function getPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
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
}

interface PageInfo {
  fileIndex: number;
  fileName: string;
  pageIndex: number;
  pageW: number;
  pageH: number;
  chunks: TextChunk[];
}

function collectChunks(items: unknown[]): TextChunk[] {
  const chunks: TextChunk[] = [];
  for (const raw of items) {
    const item = raw as { str?: string; transform?: number[]; width?: number; height?: number };
    if (typeof item.str !== 'string' || !item.transform) continue;
    if (!item.str.trim()) continue;
    const t = item.transform;
    chunks.push({
      str: item.str,
      x: t[4],
      y: t[5],
      w: item.width ?? item.str.length * 4,
      h: item.height ?? (Math.abs(t[3]) || 8)
    });
  }
  return chunks;
}

function chunksToText(chunks: TextChunk[]): string {
  const sorted = [...chunks].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextChunk[][] = [];
  for (const chunk of sorted) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line[0].y - chunk.y) <= Math.max(3, (line[0].h || 8) * 0.5)) {
      line.push(chunk);
    } else {
      lines.push([chunk]);
    }
  }
  return lines
    .map((line) =>
      line
        .sort((a, b) => a.x - b.x)
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

const COURIER_KEYS: [string, CourierPartner][] = [
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

const MARKETPLACE_KEYS: [string, Marketplace][] = [
  ['meesho', 'Meesho'],
  ['flipkart', 'Flipkart'],
  ['amazon', 'Amazon'],
  ['myntra', 'Myntra'],
  ['ajio', 'AJIO'],
  ['snapdeal', 'Snapdeal'],
  ['glowroad', 'GlowRoad']
];

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function extractAwb(text: string): string | null {
  const labeled = firstMatch(text, [
    /\bA\.?W\.?B\.?\s*(?:No\.?|Number|#)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-]{7,19})/i,
    /\bTracking\s*(?:ID|No\.?|Number|#)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-]{7,19})/i,
    /\bConsignment\s*(?:No\.?|Number|#)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-]{7,19})/i,
    /\bLRN\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-]{7,19})/i
  ]);
  if (labeled) return labeled.toUpperCase().replace(/\s+/g, '');
  /* Fallback: the longest standalone digit run on the page. */
  let best = '';
  for (const m of text.matchAll(/\b(\d{8,16})\b/g)) {
    if (m[1].length > best.length) best = m[1];
  }
  return best || null;
}

function detectCourier(text: string): CourierPartner {
  const lower = text.toLowerCase();
  for (const [key, courier] of COURIER_KEYS) {
    if (lower.includes(key)) return courier;
  }
  return 'Unknown';
}

function detectMarketplace(text: string): Marketplace {
  const lower = text.toLowerCase();
  for (const [key, marketplace] of MARKETPLACE_KEYS) {
    if (lower.includes(key)) return marketplace;
  }
  return 'Unknown';
}

function labelFromChunks(
  info: PageInfo,
  chunks: TextChunk[]
): Omit<ExtractedLabel, 'sourceFile' | 'page'> | null {
  if (chunks.length === 0) return null;
  const text = chunksToText(chunks);
  const awb = extractAwb(text);
  if (!awb) return null;

  const orderId =
    firstMatch(text, [
      /\bOrder\s*(?:ID|No\.?|Number|#)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-_]{5,24})/i
    ]) ?? 'UNKNOWN';

  const sku =
    firstMatch(text, [
      /\bSKU\s*(?:ID|Code|#)?\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\/_\-\.]{2,31})/i
    ]) ?? '';

  const size = firstMatch(text, [/\bSize\s*[:#\-]?\s*([A-Z0-9]{1,6})\b/i]) ?? '';
  const color = firstMatch(text, [/\bColou?r\s*[:#\-]?\s*([A-Za-z]+(?: [A-Za-z]+)?)/i]) ?? '';

  const qtyRaw = firstMatch(text, [
    /\b(?:Qty|QTY|Quantity)\s*[:#\-]?\s*(\d{1,3})\b/,
    /\b(\d{1,2})\s*(?:pcs|PCS|Pcs|pieces?)\b/
  ]);
  const qty = qtyRaw ? Math.max(1, Math.min(99, parseInt(qtyRaw, 10) || 1)) : 1;

  const totalRaw = firstMatch(text, [
    /(?:Invoice\s*Total|Order\s*Total|Total\s*Amount|Grand\s*Total|Amount\s*Payable|Net\s*Payable|Net\s*Amount|Total\s*Price)\s*[:#\-]?\s*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)/i
  ]);
  const invoiceTotal = totalRaw ? Number(totalRaw.replace(/,/g, '')) : null;

  return {
    marketplace: detectMarketplace(text),
    awb: awb.toUpperCase(),
    orderId: orderId.toUpperCase(),
    courier: detectCourier(text),
    sku: sku.toUpperCase(),
    size,
    color,
    qty,
    invoiceTotal: invoiceTotal !== null && Number.isFinite(invoiceTotal) ? invoiceTotal : null,
    contentBox: contentBox(chunks)
  };
}

/* ── parse pass ──────────────────────────────────────────────────────── */

function chunksInQuadrant(chunks: TextChunk[], q: number, pageW: number, pageH: number): TextChunk[] {
  const col = q % 2;
  const row = Math.floor(q / 2); // 0 = top half
  const x0 = col * (pageW / 2);
  const x1 = x0 + pageW / 2;
  const yBottom = pageH - (row + 1) * (pageH / 2);
  const yTop = yBottom + pageH / 2;
  return chunks.filter((c) => {
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    return cx >= x0 && cx < x1 && cy >= yBottom && cy < yTop;
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

async function parseFiles(
  files: File[],
  preset: CropPreset,
  onProgress?: ProgressFn
): Promise<{ pages: PageInfo[]; parsed: ParsedLabel[] }> {
  const pdfjs = await getPdfjs();
  const pages: PageInfo[] = [];

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex];
    onProgress?.(fileIndex, files.length, `Parsing labels (${fileIndex + 1}/${files.length}) — ${file.name}`);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const loadingTask = pdfjs.getDocument({ data });
      const doc = await loadingTask.promise;
      for (let pageIndex = 0; pageIndex < doc.numPages; pageIndex++) {
        const page = await doc.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const chunks = collectChunks(content.items);
        pages.push({
          fileIndex,
          fileName: file.name,
          pageIndex,
          pageW: viewport.width,
          pageH: viewport.height,
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
      for (let q = 0; q < 4; q++) {
        const quadChunks = chunksInQuadrant(info.chunks, q, info.pageW, info.pageH);
        const extracted = labelFromChunks(info, quadChunks);
        if (extracted) {
          parsed.push({
            label: { ...extracted, sourceFile: info.fileName, page: info.pageIndex + 1 },
            fileIndex: info.fileIndex,
            pageIndex: info.pageIndex,
            pageW: info.pageW,
            pageH: info.pageH,
            quadrant: q
          });
        }
      }
    } else {
      const extracted = labelFromChunks(info, info.chunks);
      if (extracted) {
        parsed.push({
          label: { ...extracted, sourceFile: info.fileName, page: info.pageIndex + 1 },
          fileIndex: info.fileIndex,
          pageIndex: info.pageIndex,
          pageW: info.pageW,
          pageH: info.pageH
        });
      }
    }
  }

  return { pages, parsed };
}

/* ── sort: Courier → SKU → Quantity (desc) → AWB ─────────────────────── */

function courierSortKey(c: string): string {
  return c === 'Unknown' ? 'zzz_unknown' : c.toLowerCase();
}

function sortParsed(parsed: ParsedLabel[], valmoPlusAsValmo: boolean): ParsedLabel[] {
  const mapped = (c: CourierPartner) =>
    valmoPlusAsValmo && c === 'ValmoPlus' ? 'Valmo' : c;
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
  files: File[],
  parsed: ParsedLabel[],
  opts: CropOptions,
  onProgress?: ProgressFn
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
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
    onProgress?.(i, parsed.length, `Cropping & stamping (${i + 1}/${parsed.length}) — ${p.label.awb}`);
    const srcDoc = sourceDocs.get(p.fileIndex);
    if (!srcDoc) continue;
    const embedded = await outDoc.embedPage(srcDoc.getPage(p.pageIndex));

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
    const row = grouped.get(key) ?? { courier, sku: p.label.sku || '(no SKU)', size: p.label.size || '—', units: 0, parcels: 0 };
    row.units += p.label.qty;
    row.parcels += 1;
    grouped.set(key, row);
  }
  const rows = [...grouped.values()].sort(
    (a, b) => courierSortKey(a.courier).localeCompare(courierSortKey(b.courier)) || a.sku.localeCompare(b.sku)
  );

  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 42;
  let page = outDoc.addPage([pageW, pageH]);
  let y = pageH - margin;

  const newPage = () => {
    page = outDoc.addPage([pageW, pageH]);
    y = pageH - margin;
  };
  const ensure = (needed: number) => {
    if (y - needed < margin + 30) newPage();
  };

  /* Header block. */
  page.drawRectangle({ x: 0, y: pageH - 96, width: pageW, height: 96, color: rgb(0.97, 0.98, 0.985) });
  page.drawText('WAREHOUSE PICKLIST & COURIER HANDOVER SUMMARY', {
    x: margin,
    y: pageH - 52,
    size: 16,
    font: helvBold,
    color: accent
  });
  page.drawText(`Generated ${formatIST(now)}  ·  ClaimProof.in — SmartLabel SKU+`, {
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
    page.drawLine({ start: { x: margin, y: y - 5 }, end: { x: pageW - margin, y: y - 5 }, thickness: 0.8, color: line });
    y -= 20;
  };
  drawTableHeader();

  let currentCourier = '';
  for (const row of rows) {
    if (row.courier !== currentCourier) {
      currentCourier = row.courier;
      ensure(46);
      const courierParcels = rows.filter((r) => r.courier === currentCourier).reduce((s, r) => s + r.parcels, 0);
      const courierUnits = rows.filter((r) => r.courier === currentCourier).reduce((s, r) => s + r.units, 0);
      page.drawRectangle({ x: margin - 4, y: y - 4, width: pageW - 2 * margin + 8, height: 20, color: zebra });
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

  ensure(40);
  page.drawLine({ start: { x: margin, y: y - 2 }, end: { x: pageW - margin, y: y - 2 }, thickness: 1, color: line });
  y -= 18;
  page.drawText(`GRAND TOTAL: ${grandParcels} parcels · ${grandUnits} units`, {
    x: colX[0],
    y,
    size: 10,
    font: helvBold,
    color: ink
  });
  y -= 20;
  page.drawText('Scan every AWB in ClaimProof before sealing — claim windows start at return scan.', {
    x: colX[0],
    y,
    size: 8,
    font: helv,
    color: muted
  });
}

/* ── public entry point ──────────────────────────────────────────────── */

export async function processLabelFiles(
  files: File[],
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
    fileName: `ClaimProof_Labels_${istDateKey()}_${hhmm}.pdf`,
    labels: sorted.map((p) => ({
      ...p.label,
      courier:
        opts.valmoPlusAsValmo && p.label.courier === 'ValmoPlus'
          ? ('Valmo' as CourierPartner)
          : p.label.courier
    }))
  };
}
