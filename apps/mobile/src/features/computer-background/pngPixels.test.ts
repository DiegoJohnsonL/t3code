import { zlibSync } from "fflate";
import { describe, expect, it } from "vite-plus/test";

import { decodePngPixels } from "./pngPixels";

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(
    Array.from(type, (char) => char.charCodeAt(0)),
    4,
  );
  out.set(data, 8);
  // The decoder does not verify CRCs, so the test leaves them zeroed.
  return out;
}

function png(input: {
  readonly width: number;
  readonly height: number;
  readonly colorType: number;
  readonly rows: ReadonlyArray<ReadonlyArray<number>>;
}): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, input.width);
  view.setUint32(4, input.height);
  header.set([8, input.colorType, 0, 0, 0], 8);
  const parts = [
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlibSync(Uint8Array.from(input.rows.flat()))),
    chunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

describe("decodePngPixels", () => {
  it("reverses every scanline filter into RGBA", () => {
    // Two RGBA pixels per row; each row after the first uses a different filter
    // that predicts the same pixels, so every row decodes to red then green.
    const red = [255, 0, 0, 255];
    const green = [0, 255, 0, 255];
    const decoded = decodePngPixels(
      png({
        width: 2,
        height: 5,
        colorType: 6,
        rows: [
          [0, ...red, ...green],
          [1, ...red, 1, 255, 0, 0],
          [2, 0, 0, 0, 0, 0, 0, 0, 0],
          [3, 128, 0, 0, 128, 129, 128, 0, 0],
          [4, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
      }),
    );
    expect(decoded.width).toBe(2);
    for (let row = 0; row < 5; row += 1) {
      expect([...decoded.rgba.subarray(row * 8, row * 8 + 8)]).toEqual([...red, ...green]);
    }
  });

  it("widens RGB and grayscale pictures to opaque RGBA", () => {
    expect([
      ...decodePngPixels(png({ width: 1, height: 1, colorType: 2, rows: [[0, 10, 20, 30]] })).rgba,
    ]).toEqual([10, 20, 30, 255]);
    expect([
      ...decodePngPixels(png({ width: 1, height: 1, colorType: 0, rows: [[0, 99]] })).rgba,
    ]).toEqual([99, 99, 99, 255]);
  });

  it("rejects files that are not PNGs", () => {
    expect(() => decodePngPixels(new Uint8Array([0xff, 0xd8, 0xff]))).toThrow("Not a PNG.");
  });
});
