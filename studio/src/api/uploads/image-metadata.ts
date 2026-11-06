// What happens to every file before it is stored (N18, N19): find out what it really is from its
// bytes, and take the metadata out of photos — the location data (GPS) above all, which D7 says we
// remove. Plain byte work, no libraries: JPEG segments and PNG and WebP chunks. Only the display
// orientation survives, because dropping it would rotate people's photos.
//
// If a photo can't be made safe, it isn't stored at all.

export interface FileKind {
  /** What the bytes really are. */
  contentType: string;
  /** The extension the stored copy gets. */
  extension: string;
}

/** What we accept (N19: images, PDFs and spreadsheets), by their real content. */
const KINDS: { contentType: string; extension: string; sniff: (b: Buffer) => boolean }[] = [
  { contentType: 'image/jpeg', extension: '.jpg', sniff: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { contentType: 'image/png', extension: '.png', sniff: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { contentType: 'image/webp', extension: '.webp', sniff: (b) => b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP' },
  { contentType: 'application/pdf', extension: '.pdf', sniff: (b) => b.toString('latin1', 0, 5) === '%PDF-' },
  // xlsx is a zip whose entries live under xl/ (a .docx has word/ instead, an .apk no xl/).
  {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
    sniff: (b) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 && b.includes('xl/'),
  },
];

/** What the bytes really are; `undefined` when they are none of the kinds we take. */
export function sniffContentType(bytes: Buffer): FileKind | undefined {
  const kind = KINDS.find(({ sniff }) => sniff(bytes));
  return kind ? { contentType: kind.contentType, extension: kind.extension } : undefined;
}

/** The kind is known and is an image: its metadata can be stripped. */
export function isImage(contentType: string): boolean {
  return contentType.startsWith('image/');
}

export class UnsafeImageError extends Error {}

/**
 * The same photo with its metadata gone: the location data (GPS), the time it was taken, the
 * camera, captions, thumbnails. Only a non-1 display orientation survives, as the smallest
 * possible EXIF block, so portraits still show upright. Throws `UnsafeImageError` when the bytes
 * don't hold together — the caller then refuses the file rather than storing it uncleaned.
 */
export function stripImageMetadata(bytes: Buffer, contentType: string): Buffer {
  if (contentType === 'image/jpeg') return stripJpeg(bytes);
  if (contentType === 'image/png') return stripPng(bytes);
  if (contentType === 'image/webp') return stripWebp(bytes);
  throw new UnsafeImageError(`no metadata stripper for ${contentType}`);
}

const broken = (why: string): never => {
  throw new UnsafeImageError(why);
};

// --- JPEG -------------------------------------------------------------------

/**
 * Walks the JPEG's segments up to the image data. Each is `markerAt` (where the FF marker is) and
 * the segment's full length including the marker; the scan after SOS is one final segment.
 */
function jpegSegments(bytes: Buffer): { markerAt: number; marker: number; end: number }[] {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) broken('not a JPEG');
  const segments: { markerAt: number; marker: number; end: number }[] = [];
  let i = 2;
  for (;;) {
    if (i >= bytes.length || bytes[i] !== 0xff) broken('a JPEG segment is missing its marker');
    while (i < bytes.length && bytes[i] === 0xff) i++; // fill bytes before a marker
    const marker = bytes[i]!;
    if (marker === 0xd9) {
      segments.push({ markerAt: i - 1, marker, end: bytes.length });
      return segments;
    }
    if (marker === 0xda) {
      // SOS: the image data that follows is copied as it is (it carries no metadata).
      segments.push({ markerAt: i - 1, marker, end: bytes.length });
      return segments;
    }
    if (i + 3 > bytes.length) broken('a JPEG segment runs past the end of the file');
    const size = bytes.readUInt16BE(i + 1);
    if (size < 2 || i + 1 + size > bytes.length) broken('a JPEG segment has a bad length');
    segments.push({ markerAt: i - 1, marker, end: i + 1 + size });
    i = i + 1 + size;
  }
}

/** Reads the display orientation (1–8) out of a JPEG's EXIF block, if it has one we can read. */
export function jpegOrientation(bytes: Buffer): number | undefined {
  let segments: { markerAt: number; marker: number; end: number }[];
  try {
    segments = jpegSegments(bytes);
  } catch {
    return undefined;
  }
  for (const { marker, markerAt, end } of segments) {
    if (marker !== 0xe1) continue;
    const segment = bytes.subarray(markerAt + 4, end);
    if (segment.toString('latin1', 0, 6) !== 'Exif\0\0') continue;
    const orientation = tiffOrientation(segment.subarray(6));
    if (orientation !== undefined) return orientation;
  }
  return undefined;
}

/** Reads tag 0x0112 (Orientation) from TIFF IFD 0. Both byte orders. */
function tiffOrientation(tiff: Buffer): number | undefined {
  if (tiff.length < 8) return undefined;
  const order = tiff.toString('latin1', 0, 2);
  const little = order === 'II';
  if (!little && order !== 'MM') return undefined;
  const u16 = (at: number) => (little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
  const u32 = (at: number) => (little ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at));
  if (u16(2) !== 42) return undefined;
  const ifd = u32(4);
  if (ifd + 2 > tiff.length) return undefined;
  const count = u16(ifd);
  for (let n = 0; n < count; n++) {
    const entry = ifd + 2 + n * 12;
    if (entry + 12 > tiff.length) return undefined;
    if (u16(entry) !== 0x0112 || u16(entry + 2) !== 3) continue;
    const value = u16(entry + 8);
    return value >= 1 && value <= 8 ? value : undefined;
  }
  return undefined;
}

/** The smallest possible EXIF block: IFD 0 with one entry, the display orientation. */
function orientationApp1(orientation: number): Buffer {
  const tiff = Buffer.alloc(26);
  tiff.write('II*\0', 0, 'latin1');
  tiff.writeUInt32LE(8, 4); // IFD 0 right after the header
  tiff.writeUInt16LE(1, 8); // one entry
  tiff.writeUInt16LE(0x0112, 10); // Orientation
  tiff.writeUInt16LE(3, 12); // SHORT
  tiff.writeUInt32LE(1, 14); // one value
  tiff.writeUInt16LE(orientation, 18); // it, inline
  tiff.writeUInt32LE(0, 22); // no further IFD
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const segment = Buffer.alloc(4 + payload.length);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment.writeUInt16BE(payload.length + 2, 2);
  payload.copy(segment, 4);
  return segment;
}

function stripJpeg(bytes: Buffer): Buffer {
  const orientation = jpegOrientation(bytes);
  const parts: Buffer[] = [bytes.subarray(0, 2)]; // SOI
  for (const { marker, markerAt, end } of jpegSegments(bytes)) {
    if (marker === 0xda || marker === 0xd9) {
      // Before the image data, put the orientation back if it was worth keeping.
      if (orientation !== undefined && orientation !== 1) parts.push(orientationApp1(orientation));
      parts.push(bytes.subarray(markerAt, end));
      continue;
    }
    // Keep the JFIF header (APP0) and the colour profile (APP2), and every structural segment.
    // Everything else that can carry facts about the photo goes: EXIF and XMP (APP1), IRB
    // (APP13), COM, and the other APPn blocks.
    const drop = marker === 0xfe || (marker >= 0xe1 && marker <= 0xef && marker !== 0xe2);
    if (!drop) parts.push(bytes.subarray(markerAt, end));
  }
  return Buffer.concat(parts);
}

// --- PNG --------------------------------------------------------------------

/** Chunks that hold anything but picture: text, time, EXIF. */
const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'tIME', 'eXIf']);

function stripPng(bytes: Buffer): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(signature)) broken('not a PNG');
  const parts: Buffer[] = [signature];
  let i = 8;
  while (i < bytes.length) {
    if (i + 8 > bytes.length) broken('a PNG chunk is missing its header');
    const size = bytes.readUInt32BE(i);
    const type = bytes.toString('latin1', i + 4, i + 8);
    const end = i + 12 + size; // header, data, CRC
    if (end > bytes.length) broken('a PNG chunk runs past the end of the file');
    if (!PNG_DROP.has(type)) parts.push(bytes.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(parts);
}

// --- WebP -------------------------------------------------------------------

/**
 * A RIFF container: `RIFF <size> WEBP` then chunks of `fourcc, size, data` padded to even.
 * The EXIF and XMP chunks go, and VP8X's flags say they are gone (bits: ICC 0x20, alpha 0x10,
 * EXIF 0x08, XMP 0x04, animation 0x02).
 */
function stripWebp(bytes: Buffer): Buffer {
  if (bytes.length < 12 || bytes.toString('latin1', 0, 4) !== 'RIFF' || bytes.toString('latin1', 8, 12) !== 'WEBP') {
    broken('not a WebP');
  }
  const parts: Buffer[] = [bytes.subarray(0, 12)];
  let i = 12;
  while (i < bytes.length) {
    if (i + 8 > bytes.length) broken('a WebP chunk is missing its header');
    const fourcc = bytes.toString('latin1', i, i + 4);
    const size = bytes.readUInt32LE(i + 4);
    const dataEnd = i + 8 + size;
    if (dataEnd > bytes.length) broken('a WebP chunk runs past the end of the file');
    // Chunks are padded to an even size; some writers leave the very last pad byte off.
    const end = Math.min(dataEnd + (size % 2), bytes.length);
    if (fourcc === 'EXIF' || fourcc === 'XMP ') {
      // dropped
    } else if (fourcc === 'VP8X' && size >= 1) {
      const chunk = Buffer.from(bytes.subarray(i, end));
      chunk[8] = chunk[8]! & ~(0x08 | 0x04);
      parts.push(chunk);
    } else {
      parts.push(bytes.subarray(i, end));
    }
    i = end;
  }
  const out = Buffer.concat(parts);
  out.writeUInt32LE(out.length - 8, 4); // the RIFF size counts everything after the first 8 bytes
  return out;
}
