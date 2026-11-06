// What we do to every image before it is stored: find out what it is, and take the metadata out
// (N18, N19). The fixtures are built byte by byte in test/api/fixtures.ts.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  UnsafeImageError,
  isImage,
  jpegOrientation,
  sniffContentType,
  stripImageMetadata,
} from '../src/api/uploads/image-metadata.ts';
import { jpegWithComments, jpegWithGps, pngWithSecretText, webpWithMetadata } from './api/fixtures.ts';

describe('what a file really is', () => {
  test('each kind we take is recognised by its bytes', () => {
    assert.equal(sniffContentType(jpegWithGps())?.contentType, 'image/jpeg');
    assert.equal(sniffContentType(pngWithSecretText())?.contentType, 'image/png');
    assert.equal(sniffContentType(webpWithMetadata())?.contentType, 'image/webp');
    assert.equal(sniffContentType(Buffer.from('%PDF-1.7\n...'))?.contentType, 'application/pdf');
    assert.equal(
      sniffContentType(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('xl/workbook.xml')]))?.contentType,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  test('anything else is none of our kinds', () => {
    assert.equal(sniffContentType(Buffer.from('hello, plain text')), undefined);
    assert.equal(sniffContentType(Buffer.alloc(0)), undefined);
    // a zip without xl/ is not an xlsx
    assert.equal(sniffContentType(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('word/document.xml')])), undefined);
  });

  test('images are the kinds whose metadata we strip', () => {
    assert.equal(isImage('image/jpeg'), true);
    assert.equal(isImage('application/pdf'), false);
  });
});

describe('JPEG photos', () => {
  test('the GPS data is gone and the display orientation survives', () => {
    const photo = jpegWithGps(6);
    assert.equal(jpegOrientation(photo), 6);
    const clean = stripImageMetadata(photo, 'image/jpeg');
    assert.ok(!clean.includes(Buffer.from('FAKEGPS!')), 'the GPS marker must be gone');
    assert.equal(jpegOrientation(clean), 6, 'the orientation is kept');
    assert.equal(clean[0], 0xff);
    assert.equal(clean[1], 0xd8, 'still a JPEG');
  });

  test('the JFIF header and the picture itself are untouched', () => {
    const photo = jpegWithGps();
    const clean = stripImageMetadata(photo, 'image/jpeg');
    assert.ok(clean.includes(Buffer.from('JFIF\0', 'latin1')), 'the JFIF header stays');
    // the frame (SOF0) and the image data (SOS to the end) come through byte for byte; the kept
    // orientation block sits between them
    const frame = photo.indexOf(Buffer.from([0xff, 0xc0]));
    const scan = photo.indexOf(Buffer.from([0xff, 0xda]));
    const cleanFrame = clean.indexOf(Buffer.from([0xff, 0xc0]));
    assert.deepEqual(clean.subarray(cleanFrame, cleanFrame + (scan - frame)), photo.subarray(frame, scan));
    assert.deepEqual(clean.subarray(clean.indexOf(Buffer.from([0xff, 0xda]))), photo.subarray(scan));
  });

  test('stripping twice changes nothing', () => {
    const once = stripImageMetadata(jpegWithGps(8), 'image/jpeg');
    assert.deepEqual(stripImageMetadata(once, 'image/jpeg'), once);
  });

  test('a photo with no orientation keeps no EXIF at all', () => {
    const clean = stripImageMetadata(jpegWithGps(1), 'image/jpeg');
    assert.ok(!clean.includes(Buffer.from('Exif')), 'orientation 1 needs no EXIF block');
    assert.equal(jpegOrientation(clean), undefined);
  });

  test('comments and Photoshop blocks go too', () => {
    const clean = stripImageMetadata(jpegWithComments(), 'image/jpeg');
    assert.ok(!clean.includes(Buffer.from('FAKEGPS!')));
    assert.ok(!clean.includes(Buffer.from('taken at home')));
    assert.ok(!clean.includes(Buffer.from('Photoshop')));
  });

  test('a JPEG that does not hold together is refused, not stored uncleaned', () => {
    const photo = jpegWithGps();
    const app1 = photo.indexOf(Buffer.from('Exif\0\0', 'latin1'));
    photo.writeUInt16BE(5000, app1 - 2); // APP1's length field, pointing past the end
    assert.throws(() => stripImageMetadata(photo, 'image/jpeg'), UnsafeImageError);
  });
});

describe('PNG and WebP', () => {
  test('a PNG keeps its picture chunks and loses the text', () => {
    const clean = stripImageMetadata(pngWithSecretText(), 'image/png');
    assert.ok(!clean.includes(Buffer.from('FAKEGPS!')));
    assert.equal(clean.toString('latin1', 12, 16), 'IHDR', 'IHDR is still the first chunk');
    assert.equal(clean.toString('latin1', clean.length - 8, clean.length - 4), 'IEND');
  });

  test('a WebP loses its EXIF and XMP chunks and its VP8X stops claiming them', () => {
    const clean = stripImageMetadata(webpWithMetadata(), 'image/webp');
    assert.ok(!clean.includes(Buffer.from('FAKEGPS!')));
    assert.equal(clean.readUInt32LE(4), clean.length - 8, 'the RIFF size is rewritten');
    const vp8x = clean.indexOf(Buffer.from('VP8X', 'latin1'));
    assert.equal(clean[vp8x + 8]! & 0x0c, 0, 'the EXIF and XMP flags are cleared');
    assert.ok(clean.includes(Buffer.from('VP8 ', 'latin1')), 'the picture stays');
  });
});
