import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { crc32, deflateSync } from "node:zlib";
import { MARS_RADIUS_KM, MOON_RADIUS_KM, openHeightMap, sampleColorGrid } from "../src/scripts/sampling.ts";

// Mars relief reaches ~21 km, which overflows int16 at half-metre precision.
const BODIES: Record<string, { input: string; colorInput?: string; radiusKm: number; unitsPerKm: number }> = {
  moon: {
    input: "data/lunar-height-map.tif",
    colorInput: "data/lunar-color-mosaic.tif",
    radiusKm: MOON_RADIUS_KM,
    unitsPerKm: 2000,
  },
  mars: {
    input: "data/mars-height-map.tif",
    colorInput: "data/mars-color-mosaic.tif",
    radiusKm: MARS_RADIUS_KM,
    unitsPerKm: 1000,
  },
};

function encodePng(rgb: Uint8Array, width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const out = Buffer.alloc(data.length + 12);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "ascii");
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour RGB

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw.set(rgb.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const { values } = parseArgs({
  options: {
    body: { type: "string", default: "moon" },
    input: { type: "string" },
    out: { type: "string", default: "public/data" },
    cols: { type: "string", default: "1024" },
    rows: { type: "string", default: "512" },
    "color-input": { type: "string" },
    "color-cols": { type: "string", default: "2048" },
    "color-rows": { type: "string", default: "1024" },
  },
});

if (!(values.body in BODIES)) {
  throw new Error(`--body must be one of: ${Object.keys(BODIES).join(", ")}`);
}
const body = values.body!;
const { radiusKm, unitsPerKm } = BODIES[body];

const cols = Number(values.cols);
const rows = Number(values.rows);
if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) {
  throw new Error("--cols and --rows must be positive integers");
}

const start = performance.now();
const map = openHeightMap(values.input ?? BODIES[body].input, { radiusKm });
const heightsKm = map.sampleGrid(cols, rows);
map.close();

const heights = new Int16Array(heightsKm.length);
let minKm = Infinity;
let maxKm = -Infinity;
for (let i = 0; i < heightsKm.length; i++) {
  heights[i] = Math.round(heightsKm[i] * unitsPerKm);
  minKm = Math.min(minKm, heightsKm[i]);
  maxKm = Math.max(maxKm, heightsKm[i]);
}

const file = `${body}-${cols}x${rows}.bin`;
mkdirSync(values.out, { recursive: true });
writeFileSync(join(values.out, file), new Uint8Array(heights.buffer));

// Optional true-colour mosaic, shown when the "Material" toggle is on.
let colorFile: string | undefined;
const colorInput = values["color-input"] ?? BODIES[body].colorInput;
if (colorInput) {
  const colorCols = Number(values["color-cols"]);
  const colorRows = Number(values["color-rows"]);
  colorFile = `${body}-color-${colorCols}x${colorRows}.png`;
  const rgb = sampleColorGrid(colorInput, colorCols, colorRows);
  writeFileSync(join(values.out, colorFile), encodePng(rgb, colorCols, colorRows));
  console.log(`Wrote ${colorFile}`);
}
writeFileSync(
  join(values.out, `${body}.json`),
  JSON.stringify(
    {
      file,
      cols,
      rows,
      vertexCount: heights.length,
      format: "int16le",
      unitsPerKm,
      radiusKm,
      minKm,
      maxKm,
      colorFile,
    },
    null,
    2,
  ),
);

console.log(
  `Wrote ${file} (${cols + 1}x${rows + 1} vertices, ${heights.byteLength} bytes, ` +
    `${minKm.toFixed(2)}..${maxKm.toFixed(2)} km) in ${(performance.now() - start).toFixed(0)} ms`,
);
