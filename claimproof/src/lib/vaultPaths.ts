/* Canonical vault path helpers. Both the recorder (writer) and the evidence
 * modals (reader) must agree on these — never hand-build vault paths. */

import type { RecordingType } from '../types';
import { istDateKey } from './dateUtils';

export function sanitizeAwb(awb: string): string {
  const clean = awb.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  return clean || 'UNKNOWN_AWB';
}

/** `<YYYY-MM-DD>/<Dispatch|Return>/<AWB>` relative to the vault root. */
export function vaultSubPath(type: RecordingType, startedAt: number, awb: string): string {
  return `${istDateKey(new Date(startedAt))}/${vaultTypeFolder(type)}/${sanitizeAwb(awb)}`;
}

export function vaultTypeFolder(type: RecordingType): 'Dispatch' | 'Return' {
  return type === 'return' ? 'Return' : 'Dispatch';
}

export function videoExtForMime(mime: string): 'mp4' | 'webm' {
  return mime.includes('mp4') ? 'mp4' : 'webm';
}

export function videoFileName(awb: string, mime: string): string {
  return `${sanitizeAwb(awb)}_Video.${videoExtForMime(mime)}`;
}

export function photoCollageFileName(awb: string): string {
  return `${sanitizeAwb(awb)}_Photo_Collage.jpg`;
}
