// Generate solid-color PNG icons (192x192 and 512x512)
// No dependencies; writes PNG by hand with zlib compress
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let c = ~0;
  for (let n = 0; n < buf.length; n++) {
    c ^= buf[n];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([t, data]));
  crc.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, t, data, crc]);
}

function pngRGBA(width, height, r, g, b, a) {
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = chunk('IHDR', ihdr);

  // IDAT data: each row starts with filter byte 0
  const rowBytes = width * 4 + 1;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const off = y * rowBytes;
    raw[off] = 0; // filter type 0
    for (let x = 0; x < width; x++) {
      const p = off + 1 + x * 4;
      raw[p + 0] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
      raw[p + 3] = a;
    }
  }
  const comp = zlib.deflateSync(raw);
  const idatChunk = chunk('IDAT', comp);

  const iendChunk = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

const outDir = path.resolve('public/icons');
ensureDir(outDir);

const color = { r: 0x0f, g: 0x5f, b: 0x3f, a: 0xff };

const icon192 = pngRGBA(192, 192, color.r, color.g, color.b, color.a);
fs.writeFileSync(path.join(outDir, 'icon-192.png'), icon192);

const icon512 = pngRGBA(512, 512, color.r, color.g, color.b, color.a);
fs.writeFileSync(path.join(outDir, 'icon-512.png'), icon512);

console.log('Generated icons at', outDir);

// Generate a favicon.ico (32x32, 32-bit)
function writeFaviconIco(destPath, r, g, b, a) {
  const width = 32, height = 32;
  // Build DIB (BMP without file header) for ICO entry
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(width, 4); // biWidth
  header.writeInt32LE(height * 2, 8); // biHeight (includes AND mask)
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount
  header.writeUInt32LE(0, 16); // biCompression = BI_RGB
  const pixelBytes = width * height * 4;
  header.writeUInt32LE(pixelBytes, 20); // biSizeImage
  header.writeInt32LE(0, 24); // biXPelsPerMeter
  header.writeInt32LE(0, 28); // biYPelsPerMeter
  header.writeUInt32LE(0, 32); // biClrUsed
  header.writeUInt32LE(0, 36); // biClrImportant

  // BGRA pixel data, bottom-up
  const pixels = Buffer.alloc(pixelBytes);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dstY = (height - 1 - y);
      const off = (dstY * width + x) * 4;
      pixels[off + 0] = b;
      pixels[off + 1] = g;
      pixels[off + 2] = r;
      pixels[off + 3] = a;
    }
  }

  // AND mask: 1bpp, padded to 32-bit per row. For 32px, 4 bytes per row.
  const maskRowBytes = Math.ceil(width / 32) * 4; // 4
  const mask = Buffer.alloc(maskRowBytes * height); // all zero = fully opaque

  const dib = Buffer.concat([header, pixels, mask]);

  // ICO header
  const iconDir = Buffer.alloc(6);
  iconDir.writeUInt16LE(0, 0); // reserved
  iconDir.writeUInt16LE(1, 2); // type = 1 (icon)
  iconDir.writeUInt16LE(1, 4); // count = 1

  const entry = Buffer.alloc(16);
  entry[0] = width; // width
  entry[1] = height; // height
  entry[2] = 0; // color count
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bit count
  entry.writeUInt32LE(dib.length, 8); // bytes in res
  entry.writeUInt32LE(6 + 16, 12); // offset

  const ico = Buffer.concat([iconDir, entry, dib]);
  fs.writeFileSync(destPath, ico);
}

writeFaviconIco(path.resolve('public/favicon.ico'), color.r, color.g, color.b, color.a);
console.log('Generated favicon at public/favicon.ico');
