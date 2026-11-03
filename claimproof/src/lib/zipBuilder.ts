/**
 * Zero-dependency pure TypeScript PKZIP archive builder.
 *
 * Implements standard PKZIP 2.0 specification for creating .zip files
 * directly in the browser and Node.js with zero external libraries.
 */

// Precomputed CRC32 table for fast checksum calculation
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export const computeCrc32 = crc32;

/** Converts a JS Date to MS-DOS date and time (16 bits each). */
function dosDateTime(date: Date): { dosDate: number; dosTime: number } {
  const d = date;
  const dosTime =
    ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f);
  const year = Math.max(1980, d.getFullYear()) - 1980;
  const dosDate = ((year & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
  return { dosDate, dosTime };
}

export interface ZipEntryInput {
  name: string;
  data: Uint8Array | ArrayBuffer | string;
  date?: Date;
}

interface StoredEntry {
  nameBytes: Uint8Array;
  data: Uint8Array;
  crc: number;
  uncompressedSize: number;
  compressedSize: number;
  offset: number;
  dosDate: number;
  dosTime: number;
}

export class ZipBuilder {
  private entries: ZipEntryInput[] = [];

  /**
   * Adds a file entry to the archive.
   * Path separators should use forward slashes (e.g. `Key_Frames/frame1.jpg`).
   */
  addFile(name: string, data: Uint8Array | ArrayBuffer | string, date?: Date): this {
    // Normalize path separators to standard forward slash
    const normalizedName = name.replace(/\\/g, '/').replace(/^\/+/, '');
    this.entries.push({ name: normalizedName, data, date });
    return this;
  }

  /**
   * Builds the final ZIP archive as a Uint8Array.
   */
  async build(): Promise<Uint8Array> {
    const textEncoder = new TextEncoder();
    const stored: StoredEntry[] = [];
    const parts: Uint8Array[] = [];
    let currentOffset = 0;

    const defaultDate = new Date();

    // 1. Process all file entries and generate Local File Headers
    for (const entry of this.entries) {
      let dataBytes: Uint8Array;
      if (typeof entry.data === 'string') {
        dataBytes = textEncoder.encode(entry.data);
      } else if (entry.data instanceof Uint8Array) {
        dataBytes = entry.data;
      } else {
        dataBytes = new Uint8Array(entry.data);
      }

      const nameBytes = textEncoder.encode(entry.name);
      const entryCrc = crc32(dataBytes);
      const { dosDate, dosTime } = dosDateTime(entry.date ?? defaultDate);

      // Method 0 = Store (uncompressed). Ideal for MP4, WebM, JPEG, PDF which are pre-compressed.
      const compressionMethod = 0;
      const uncompressedSize = dataBytes.length;
      const compressedSize = dataBytes.length;

      // Local file header (30 bytes + name length)
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(localHeader.buffer);

      view.setUint32(0, 0x04034b50, true); // Local file header signature
      view.setUint16(4, 20, true); // Version needed to extract (2.0)
      view.setUint16(6, 0x0800, true); // General purpose bit flag (UTF-8 bit 11)
      view.setUint16(8, compressionMethod, true);
      view.setUint16(10, dosTime, true);
      view.setUint16(12, dosDate, true);
      view.setUint32(14, entryCrc, true);
      view.setUint32(18, compressedSize, true);
      view.setUint32(22, uncompressedSize, true);
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true); // Extra field length

      localHeader.set(nameBytes, 30);

      parts.push(localHeader);
      parts.push(dataBytes);

      stored.push({
        nameBytes,
        data: dataBytes,
        crc: entryCrc,
        uncompressedSize,
        compressedSize,
        offset: currentOffset,
        dosDate,
        dosTime
      });

      currentOffset += localHeader.length + dataBytes.length;
    }

    // 2. Central Directory
    const centralDirStartOffset = currentOffset;
    let centralDirSize = 0;

    for (const entry of stored) {
      // Central directory header (46 bytes + name length)
      const cdHeader = new Uint8Array(46 + entry.nameBytes.length);
      const view = new DataView(cdHeader.buffer);

      view.setUint32(0, 0x02014b50, true); // Central directory header signature
      view.setUint16(4, 20, true); // Version made by
      view.setUint16(6, 20, true); // Version needed to extract
      view.setUint16(8, 0x0800, true); // UTF-8 flag
      view.setUint16(10, 0, true); // Compression method (0 = Store)
      view.setUint16(12, entry.dosTime, true);
      view.setUint16(14, entry.dosDate, true);
      view.setUint32(16, entry.crc, true);
      view.setUint32(20, entry.compressedSize, true);
      view.setUint32(24, entry.uncompressedSize, true);
      view.setUint16(28, entry.nameBytes.length, true);
      view.setUint16(30, 0, true); // Extra field length
      view.setUint16(32, 0, true); // File comment length
      view.setUint16(34, 0, true); // Disk number start
      view.setUint16(36, 0, true); // Internal file attributes
      view.setUint32(38, 0, true); // External file attributes
      view.setUint32(42, entry.offset, true); // Relative offset of local header

      cdHeader.set(entry.nameBytes, 46);

      parts.push(cdHeader);
      centralDirSize += cdHeader.length;
    }

    // 3. End of Central Directory Record (22 bytes)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);

    eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
    eocdView.setUint16(4, 0, true); // Disk number
    eocdView.setUint16(6, 0, true); // Start disk
    eocdView.setUint16(8, stored.length, true); // Entries on disk
    eocdView.setUint16(10, stored.length, true); // Total entries
    eocdView.setUint32(12, centralDirSize, true); // Central directory size
    eocdView.setUint32(16, centralDirStartOffset, true); // Central directory offset
    eocdView.setUint16(20, 0, true); // Comment length

    parts.push(eocd);

    // Combine all parts into single contiguous buffer
    const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
    const finalBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const p of parts) {
      finalBuffer.set(p, offset);
      offset += p.length;
    }

    return finalBuffer;
  }

  /**
   * Builds the final ZIP archive and returns it as a Blob.
   */
  async buildBlob(mimeType = 'application/zip'): Promise<Blob> {
    const bytes = await this.build();
    return new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
  }
}
