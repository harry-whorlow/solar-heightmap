import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { encode } from "jpeg-js";
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

function encodeJpeg(rgb: Uint8Array, width: number, height: number, quality: number): Buffer {
  // jpeg-js reads RGBA, so pad each pixel with an opaque alpha byte.
  const rgba = Buffer.alloc(width * height * 4, 0xff);
  for (let i = 0, o = 0; i < rgb.length; i += 3, o += 4) {
    rgba[o] = rgb[i];
    rgba[o + 1] = rgb[i + 1];
    rgba[o + 2] = rgb[i + 2];
  }
  return encode({ data: rgba, width, height }, quality).data;
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
    "color-quality": { type: "string", default: "90" },
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
  const colorQuality = Number(values["color-quality"]);
  colorFile = `${body}-color-${colorCols}x${colorRows}.jpg`;
  const rgb = sampleColorGrid(colorInput, colorCols, colorRows);
  writeFileSync(join(values.out, colorFile), encodeJpeg(rgb, colorCols, colorRows, colorQuality));
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
