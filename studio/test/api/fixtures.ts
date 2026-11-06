// Synthetic test images, built byte by byte here so the tests never depend on a binary file in
// the repo. Each carries a marker string where its private metadata is ("FAKEGPS!"), so a test can
// check the stripper took it out.

/** A TIFF entry: tag, type (2 = ASCII, 3 = SHORT, 4 = LONG), count, and the value or an offset. */
function entry(tag: number, type: number, count: number, value: number): Buffer {
  const out = Buffer.alloc(12);
  out.writeUInt16LE(tag, 0);
  out.writeUInt16LE(type, 2);
  out.writeUInt32LE(count, 4);
  out.writeUInt32LE(value, 8);
  return out;
}

/**
 * Little-endian TIFF with IFD 0 holding Orientation (0x0112) and a GPS pointer (0x8825) to a GPS
 * IFD whose first entry is the 8-byte ASCII "FAKEGPS!".
 */
function exifTiff(orientation: number): Buffer {
  const head = Buffer.alloc(8);
  head.write('II*\0', 0, 'latin1');
  head.writeUInt32LE(8, 4);
  const ifd0 = Buffer.concat([
    Buffer.from([2, 0]),
    entry(0x0112, 3, 1, orientation),
    entry(0x8825, 4, 1, 38),
    Buffer.alloc(4),
  ]);
  const gps = Buffer.concat([Buffer.from([1, 0]), entry(0x0001, 2, 8, 56), Buffer.alloc(4)]);
  return Buffer.concat([head, ifd0, gps, Buffer.from('FAKEGPS!', 'latin1')]);
}

function segment(marker: number, data: Buffer): Buffer {
  const out = Buffer.alloc(4 + data.length);
  out[0] = 0xff;
  out[1] = marker;
  out.writeUInt16BE(data.length + 2, 2);
  data.copy(out, 4);
  return out;
}

/** A structurally valid JPEG: JFIF header, EXIF with orientation and GPS, a 1×1 frame, image data. */
export function jpegWithGps(orientation = 6): Buffer {
  const jfif = Buffer.concat([Buffer.from('JFIF\0', 'latin1'), Buffer.from([1, 1, 0, 0, 1, 0, 1, 0, 0])]);
  const app0 = segment(0xe0, jfif);
  const app1 = segment(0xe1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), exifTiff(orientation)]));
  const sof0 = segment(0xc0, Buffer.from([8, 0, 1, 0, 1, 1, 1, 0x11, 0]));
  const sos = segment(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0]));
  const scan = Buffer.from([0x12, 0x34, 0xff, 0xd9]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, app1, sof0, sos, scan]);
}

/** The same kind of JPEG, with a COM comment and an APP13 IRB block instead of EXIF. */
export function jpegWithComments(): Buffer {
  const jfif = Buffer.concat([Buffer.from('JFIF\0', 'latin1'), Buffer.from([1, 1, 0, 0, 1, 0, 1, 0, 0])]);
  const app0 = segment(0xe0, jfif);
  const com = segment(0xfe, Buffer.from('taken at home', 'latin1'));
  const app13 = segment(0xed, Buffer.concat([Buffer.from('Photoshop 3.0\0', 'latin1'), Buffer.from('FAKEGPS!', 'latin1')]));
  const sof0 = segment(0xc0, Buffer.from([8, 0, 1, 0, 1, 1, 1, 0x11, 0]));
  const sos = segment(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0]));
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, com, app13, sof0, sos, Buffer.from([0x12, 0xff, 0xd9])]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  return out; // the CRC is left as zeroes: nothing here checks it
}

/** A 1×1 PNG with a text chunk carrying "FAKEGPS!". */
export function pngWithSecretText(): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = pngChunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]));
  const text = pngChunk('tEXt', Buffer.concat([Buffer.from('Comment\0', 'latin1'), Buffer.from('FAKEGPS!', 'latin1')]));
  const idat = pngChunk('IDAT', Buffer.from([0x78, 0x78]));
  return Buffer.concat([signature, ihdr, text, idat, pngChunk('IEND', Buffer.alloc(0))]);
}

function webpChunk(fourcc: string, data: Buffer): Buffer {
  const out = Buffer.alloc(8 + data.length + (data.length % 2));
  out.write(fourcc, 0, 'latin1');
  out.writeUInt32LE(data.length, 4);
  data.copy(out, 8);
  return out;
}

/** A WebP whose VP8X says it has EXIF and XMP, and does: both carry "FAKEGPS!". */
export function webpWithMetadata(): Buffer {
  const vp8x = webpChunk('VP8X', Buffer.from([0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
  const exif = webpChunk('EXIF', Buffer.from('FAKEGPS!', 'latin1'));
  const xmp = webpChunk('XMP ', Buffer.from('<x>FAKEGPS!</x>', 'latin1'));
  const frame = webpChunk('VP8 ', Buffer.from('picture', 'latin1'));
  const body = Buffer.concat([Buffer.from('WEBP', 'latin1'), vp8x, exif, xmp, frame]);
  const out = Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.alloc(4), body]);
  out.writeUInt32LE(out.length - 8, 4);
  return out;
}
