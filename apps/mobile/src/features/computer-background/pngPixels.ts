import { unzlibSync } from "fflate";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
// PNG color type -> channels, for the 8-bit, non-interlaced images the image
// manipulator writes. Palette images never come out of it.
const CHANNELS_BY_COLOR_TYPE: Readonly<Record<number, number>> = { 0: 1, 2: 3, 4: 2, 6: 4 };

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

/** Decodes a small PNG to RGBA so the phone can score a picture's colors in JS. */
export function decodePngPixels(bytes: Uint8Array): {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
} {
  if (SIGNATURE.some((value, index) => bytes[index] !== value)) throw new Error("Not a PNG.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let channels = 0;
  const compressed: Uint8Array[] = [];
  for (let offset = 8; offset + 8 <= bytes.length;) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      const [bitDepth, colorType, , , interlace] = data.subarray(8, 13);
      channels = CHANNELS_BY_COLOR_TYPE[colorType ?? -1] ?? 0;
      if (bitDepth !== 8 || channels === 0 || interlace !== 0) {
        throw new Error("Unsupported PNG layout.");
      }
    } else if (type === "IDAT") {
      compressed.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  const joined = new Uint8Array(compressed.reduce((total, chunk) => total + chunk.length, 0));
  let cursor = 0;
  for (const chunk of compressed) {
    joined.set(chunk, cursor);
    cursor += chunk.length;
  }
  const raw = unzlibSync(joined);
  const stride = width * channels;
  const pixels = new Uint8Array(stride * height);
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)];
    const source = row * (stride + 1) + 1;
    const target = row * stride;
    for (let column = 0; column < stride; column += 1) {
      const value = raw[source + column] ?? 0;
      const left = column >= channels ? (pixels[target + column - channels] ?? 0) : 0;
      const up = row > 0 ? (pixels[target - stride + column] ?? 0) : 0;
      const upLeft =
        row > 0 && column >= channels ? (pixels[target - stride + column - channels] ?? 0) : 0;
      const predicted =
        filter === 1
          ? left
          : filter === 2
            ? up
            : filter === 3
              ? (left + up) >> 1
              : filter === 4
                ? paeth(left, up, upLeft)
                : 0;
      pixels[target + column] = (value + predicted) & 0xff;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const base = index * channels;
    const gray = channels <= 2;
    rgba[index * 4] = pixels[base] ?? 0;
    rgba[index * 4 + 1] = pixels[gray ? base : base + 1] ?? 0;
    rgba[index * 4 + 2] = pixels[gray ? base : base + 2] ?? 0;
    rgba[index * 4 + 3] =
      channels === 4 || channels === 2 ? (pixels[base + channels - 1] ?? 0) : 255;
  }
  return { width, height, rgba };
}
