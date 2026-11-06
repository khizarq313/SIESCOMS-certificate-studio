// Pure image processing maths for Image Studio (crop, remove background, recolour ink).
// Runs without DOM, canvas or React dependencies.

export interface Raster {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export const SIGNATURE_INK = {
  blue: '#1B3A9E',
  black: '#0B0B0B',
} as const;

export type InkChoice = 'original' | 'blue' | 'black';

const INK_RGB: Record<'blue' | 'black', [number, number, number]> = {
  blue: [27, 58, 158],
  black: [11, 11, 11],
};

/** True if more than 1% of pixels have alpha below 250. */
export function hasTransparency(r: Raster): boolean {
  const total = r.width * r.height;
  if (total === 0) return false;
  let transparentCount = 0;
  const threshold = total * 0.01;
  const d = r.data;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] < 250) {
      transparentCount++;
      if (transparentCount > threshold) return true;
    }
  }
  return false;
}

/** Clamps the rectangle to image boundaries and extracts the sub-raster. */
export function cropRaster(r: Raster, rect: { x: number; y: number; w: number; h: number }): Raster {
  if (r.width <= 0 || r.height <= 0) {
    return { data: new Uint8ClampedArray(0), width: 0, height: 0 };
  }

  const x0 = Math.max(0, Math.min(r.width, Math.round(rect.x)));
  const y0 = Math.max(0, Math.min(r.height, Math.round(rect.y)));
  const x1 = Math.max(x0, Math.min(r.width, Math.round(rect.x + rect.w)));
  const y1 = Math.max(y0, Math.min(r.height, Math.round(rect.y + rect.h)));
  const w = x1 - x0;
  const h = y1 - y0;

  if (w <= 0 || h <= 0) {
    return { data: new Uint8ClampedArray(0), width: 0, height: 0 };
  }

  const out = new Uint8ClampedArray(w * h * 4);
  const src = r.data;
  const rowBytes = w * 4;

  for (let row = 0; row < h; row++) {
    const srcOffset = ((y0 + row) * r.width + x0) * 4;
    const dstOffset = row * rowBytes;
    out.set(src.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
  }

  return { data: out, width: w, height: h };
}

function smoothstep(min: number, max: number, x: number): number {
  if (x <= min) return 0;
  if (x >= max) return 1;
  const t = (x - min) / (max - min);
  return t * t * (3 - 2 * t);
}

/** Process signature raster: background removal via adaptive paper brightness estimation and ink recolouring. */
export function processSignature(
  r: Raster,
  opts: {
    removeBackground: boolean;
    sensitivity?: number; // 0-100, default 50
    boldness?: number;    // 0-100, default 50
    ink?: InkChoice;
  }
): Raster {
  const { width, height } = r;
  if (width <= 0 || height <= 0) {
    return { data: new Uint8ClampedArray(0), width: 0, height: 0 };
  }

  const sensitivity = opts.sensitivity ?? 50;
  const boldness = opts.boldness ?? 50;
  const ink = opts.ink ?? 'original';
  const total = width * height;
  const src = r.data;

  // If background removal is turned off, return a clean copy with alpha 255 everywhere and unchanged RGB
  if (!opts.removeBackground) {
    const out = new Uint8ClampedArray(src);
    for (let i = 3; i < out.length; i += 4) {
      out[i] = 255;
    }
    return { data: out, width, height };
  }

  const out = new Uint8ClampedArray(total * 4);

  // 1. If image already has transparency: preserve alpha and only apply ink colour
  if (hasTransparency(r)) {
    out.set(src);
    if (ink === 'blue' || ink === 'black') {
      const [ir, ig, ib] = INK_RGB[ink];
      for (let i = 0; i < total; i++) {
        const idx = i * 4;
        if (out[idx + 3] > 0) {
          out[idx] = ir;
          out[idx + 1] = ig;
          out[idx + 2] = ib;
        }
      }
    }
    return { data: out, width, height };
  }

  // 2. Compute luminance L = 0.299R + 0.587G + 0.114B
  const L = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    L[i] = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
  }

  // 3. Estimate paper brightness B(x, y)
  const cellSize = Math.max(8, Math.round(Math.max(width, height) / 48));
  const nx = Math.max(1, Math.ceil(width / cellSize));
  const ny = Math.max(1, Math.ceil(height / cellSize));
  const cellB = new Float32Array(nx * ny);

  for (let cy = 0; cy < ny; cy++) {
    const yStart = cy * cellSize;
    const yEnd = Math.min(height, yStart + cellSize);
    for (let cx = 0; cx < nx; cx++) {
      const xStart = cx * cellSize;
      const xEnd = Math.min(width, xStart + cellSize);

      const hist = new Uint16Array(256);
      let count = 0;
      for (let y = yStart; y < yEnd; y++) {
        const row = y * width;
        for (let x = xStart; x < xEnd; x++) {
          const lVal = Math.max(0, Math.min(255, Math.round(L[row + x])));
          hist[lVal]++;
          count++;
        }
      }

      let p90 = 255;
      if (count > 0) {
        const target = Math.floor(count * 0.9);
        let accum = 0;
        for (let b = 0; b < 256; b++) {
          accum += hist[b];
          if (accum >= target) {
            p90 = Math.max(1, b);
            break;
          }
        }
      }
      cellB[cy * nx + cx] = Math.max(1, p90);
    }
  }

  // 4 & 5. Compute alpha and recolour
  const t0 = 0.22 - 0.2 * (sensitivity / 100);
  const t1 = t0 + 0.5;
  const g = 1.6 - 1.0 * (boldness / 100);
  const targetInkRgb = (ink === 'blue' || ink === 'black') ? INK_RGB[ink] : null;

  for (let y = 0; y < height; y++) {
    const gy = (y + 0.5) / cellSize - 0.5;
    const c0y = Math.max(0, Math.min(ny - 1, Math.floor(gy)));
    const c1y = Math.max(0, Math.min(ny - 1, c0y + 1));
    const ty = Math.max(0, Math.min(1, gy - c0y));

    for (let x = 0; x < width; x++) {
      const gx = (x + 0.5) / cellSize - 0.5;
      const c0x = Math.max(0, Math.min(nx - 1, Math.floor(gx)));
      const c1x = Math.max(0, Math.min(nx - 1, c0x + 1));
      const tx = Math.max(0, Math.min(1, gx - c0x));

      const bTop = (1 - tx) * cellB[c0y * nx + c0x] + tx * cellB[c0y * nx + c1x];
      const bBot = (1 - tx) * cellB[c1y * nx + c0x] + tx * cellB[c1y * nx + c1x];
      const B = Math.max(1, (1 - ty) * bTop + ty * bBot);

      const pixIndex = y * width + x;
      const pixL = L[pixIndex];
      const n = Math.max(0, Math.min(1, pixL / B));
      const darkness = 1 - n;

      const alphaNorm = Math.pow(smoothstep(t0, t1, darkness), g);
      const alpha = Math.max(0, Math.min(255, Math.round(alphaNorm * 255)));

      const idx = pixIndex * 4;
      out[idx + 3] = alpha;

      if (alpha === 0) {
        out[idx] = 0;
        out[idx + 1] = 0;
        out[idx + 2] = 0;
      } else if (targetInkRgb) {
        out[idx] = targetInkRgb[0];
        out[idx + 1] = targetInkRgb[1];
        out[idx + 2] = targetInkRgb[2];
      } else {
        // ink: 'original' -> UN-MIX paper brightness
        const denom = Math.max(alphaNorm, 0.05);
        const paperFactor = B * (1 - alphaNorm);
        out[idx] = Math.max(0, Math.min(255, Math.round((src[idx] - paperFactor) / denom)));
        out[idx + 1] = Math.max(0, Math.min(255, Math.round((src[idx + 1] - paperFactor) / denom)));
        out[idx + 2] = Math.max(0, Math.min(255, Math.round((src[idx + 2] - paperFactor) / denom)));
      }
    }
  }

  return { data: out, width, height };
}

/** Process logo/seal raster: flood-fill background removal preserving enclosed light shapes. */
export function processLogo(
  r: Raster,
  opts: {
    removeBackground: boolean;
    tolerance?: number; // 0-100, default 35
  }
): Raster {
  const { width, height } = r;
  if (width <= 0 || height <= 0) {
    return { data: new Uint8ClampedArray(0), width: 0, height: 0 };
  }

  const src = r.data;
  const total = width * height;

  if (!opts.removeBackground) {
    const out = new Uint8ClampedArray(src);
    for (let i = 3; i < out.length; i += 4) {
      out[i] = 255;
    }
    return { data: out, width, height };
  }

  // Check if border is already mostly transparent
  let borderTransparent = 0;
  let borderCount = 0;
  for (let x = 0; x < width; x++) {
    if (src[x * 4 + 3] < 128) borderTransparent++;
    if (src[((height - 1) * width + x) * 4 + 3] < 128) borderTransparent++;
    borderCount += 2;
  }
  for (let y = 1; y < height - 1; y++) {
    if (src[(y * width) * 4 + 3] < 128) borderTransparent++;
    if (src[(y * width + width - 1) * 4 + 3] < 128) borderTransparent++;
    borderCount += 2;
  }

  if (borderCount > 0 && borderTransparent / borderCount > 0.5) {
    return { data: new Uint8ClampedArray(src), width, height };
  }

  // Sample median colour of outer 2-pixel ring
  const ringR: number[] = [];
  const ringG: number[] = [];
  const ringB: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < 2 || x >= width - 2 || y < 2 || y >= height - 2) {
        const idx = (y * width + x) * 4;
        ringR.push(src[idx]);
        ringG.push(src[idx + 1]);
        ringB.push(src[idx + 2]);
      }
    }
  }

  ringR.sort((a, b) => a - b);
  ringG.sort((a, b) => a - b);
  ringB.sort((a, b) => a - b);
  const mid = Math.floor(ringR.length / 2);
  const bgR = ringR[mid] ?? 255;
  const bgG = ringG[mid] ?? 255;
  const bgB = ringB[mid] ?? 255;

  const tolerance = opts.tolerance ?? 35;
  const maxDist = 6 + (tolerance / 100) * 84;
  const maxDistSq = maxDist * maxDist;

  // BFS flood-fill from border pixels
  const isBg = new Uint8Array(total);
  const queue = new Int32Array(total);
  let qHead = 0;
  let qTail = 0;

  function tryEnqueue(x: number, y: number) {
    const idx = y * width + x;
    if (isBg[idx]) return;
    const pIdx = idx * 4;
    const dr = src[pIdx] - bgR;
    const dg = src[pIdx + 1] - bgG;
    const db = src[pIdx + 2] - bgB;
    if (dr * dr + dg * dg + db * db <= maxDistSq) {
      isBg[idx] = 1;
      queue[qTail++] = idx;
    }
  }

  for (let x = 0; x < width; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }

  while (qHead < qTail) {
    const idx = queue[qHead++];
    const x = idx % width;
    const y = Math.floor(idx / width);

    if (x > 0) tryEnqueue(x - 1, y);
    if (x < width - 1) tryEnqueue(x + 1, y);
    if (y > 0) tryEnqueue(x, y - 1);
    if (y < height - 1) tryEnqueue(x, y + 1);
  }

  const out = new Uint8ClampedArray(total * 4);
  out.set(src);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const pIdx = idx * 4;

      if (isBg[idx]) {
        out[pIdx + 3] = 0;
      } else {
        // Check if 4-connected to background to soften 1-pixel edge
        const isEdge =
          (x > 0 && isBg[idx - 1]) ||
          (x < width - 1 && isBg[idx + 1]) ||
          (y > 0 && isBg[idx - width]) ||
          (y < height - 1 && isBg[idx + width]);

        if (isEdge) {
          const dr = src[pIdx] - bgR;
          const dg = src[pIdx + 1] - bgG;
          const db = src[pIdx + 2] - bgB;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);
          const factor = Math.max(0.1, Math.min(1, (dist - maxDist * 0.4) / (maxDist * 0.8)));
          const alpha = Math.max(0, Math.min(255, Math.round(factor * 255)));
          out[pIdx + 3] = alpha;

          // Un-mix background
          const denom = Math.max(factor, 0.05);
          out[pIdx] = Math.max(0, Math.min(255, Math.round((src[pIdx] - bgR * (1 - factor)) / denom)));
          out[pIdx + 1] = Math.max(0, Math.min(255, Math.round((src[pIdx + 1] - bgG * (1 - factor)) / denom)));
          out[pIdx + 2] = Math.max(0, Math.min(255, Math.round((src[pIdx + 2] - bgB * (1 - factor)) / denom)));
        } else {
          out[pIdx + 3] = 255;
        }
      }
    }
  }

  return { data: out, width, height };
}

/** Computes tight bounding box around visible pixels (alpha > 16) with padding fraction. */
export function autoTrimBounds(r: Raster, paddingFraction = 0.04): { x: number; y: number; w: number; h: number } | null {
  const { width, height, data } = r;
  if (width <= 0 || height <= 0) return null;

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (data[(row + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const pad = Math.round(Math.max(cw, ch) * paddingFraction);

  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  const w = Math.min(width - x, cw + pad * 2);
  const h = Math.min(height - y, ch + pad * 2);

  return { x, y, w, h };
}
