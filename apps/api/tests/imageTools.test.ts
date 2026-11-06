import { describe, expect, it } from 'vitest';
import {
  SIGNATURE_INK,
  autoTrimBounds,
  cropRaster,
  hasTransparency,
  processLogo,
  processSignature,
  type Raster,
} from '@siescoms/certificate';

function createSyntheticSignature(penColor = [40, 40, 40]): {
  raster: Raster;
  strokeCenters: Set<number>;
  paperPixels: Set<number>;
} {
  const width = 300;
  const height = 120;
  const data = new Uint8ClampedArray(width * height * 4);
  const strokeCenters = new Set<number>();
  const paperPixels = new Set<number>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const pix = y * width + x;

      // Left-to-right brightness gradient from 235 to 200 plus +/-4 noise
      const baseGrad = 235 - (35 * x) / (width - 1);
      // Deterministic pseudo-noise in range [-4, 4]
      const noise = ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1) * 8 - 4;
      const paperVal = Math.max(0, Math.min(255, Math.round(baseGrad + noise)));

      // Sine wave stroke: cy = 60 + 25 * sin(x * 0.05), constrained within x in [15, 285]
      const isStrokeX = x >= 15 && x <= 285;
      const strokeY = 60 + 25 * Math.sin(x * 0.05);
      const dist = Math.abs(y - strokeY);

      if (isStrokeX && dist <= 0.6) {
        // Stroke center (3px wide total, center is <= 0.6)
        data[idx] = penColor[0];
        data[idx + 1] = penColor[1];
        data[idx + 2] = penColor[2];
        data[idx + 3] = 255;
        strokeCenters.add(pix);
      } else if (isStrokeX && dist <= 1.5) {
        // Anti-aliased stroke edge
        const t = (dist - 0.6) / 0.9;
        data[idx] = Math.round(penColor[0] * (1 - t) + paperVal * t);
        data[idx + 1] = Math.round(penColor[1] * (1 - t) + paperVal * t);
        data[idx + 2] = Math.round(penColor[2] * (1 - t) + paperVal * t);
        data[idx + 3] = 255;
      } else {
        // Pure paper
        data[idx] = paperVal;
        data[idx + 1] = paperVal;
        data[idx + 2] = paperVal;
        data[idx + 3] = 255;
        paperPixels.add(pix);
      }
    }
  }

  return { raster: { data, width, height }, strokeCenters, paperPixels };
}

describe('Phase 2: Image Studio image processing maths (imageTools.ts)', () => {
  it('1. processSignature with ink black removes paper gradient and recolours stroke', () => {
    const { raster, strokeCenters, paperPixels } = createSyntheticSignature();
    const res = processSignature(raster, {
      removeBackground: true,
      sensitivity: 50,
      boldness: 50,
      ink: 'black',
    });

    let paperAlphaLow = 0;
    for (const p of paperPixels) {
      if (res.data[p * 4 + 3] <= 4) paperAlphaLow++;
    }
    const paperPercent = paperAlphaLow / paperPixels.size;
    expect(paperPercent).toBeGreaterThanOrEqual(0.98);

    let strokeAlphaHigh = 0;
    for (const s of strokeCenters) {
      if (res.data[s * 4 + 3] >= 240) strokeAlphaHigh++;
    }
    const strokePercent = strokeAlphaHigh / strokeCenters.size;
    expect(strokePercent).toBeGreaterThanOrEqual(0.95);

    // RGB matches SIGNATURE_INK.black (#0B0B0B -> 11, 11, 11) within 1
    for (let i = 0; i < res.width * res.height; i++) {
      const idx = i * 4;
      if (res.data[idx + 3] > 0) {
        expect(Math.abs(res.data[idx] - 11)).toBeLessThanOrEqual(1);
        expect(Math.abs(res.data[idx + 1] - 11)).toBeLessThanOrEqual(1);
        expect(Math.abs(res.data[idx + 2] - 11)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('2. processSignature with ink blue recolours stroke to SIGNATURE_INK.blue', () => {
    const { raster } = createSyntheticSignature();
    const res = processSignature(raster, {
      removeBackground: true,
      sensitivity: 50,
      boldness: 50,
      ink: 'blue',
    });

    // SIGNATURE_INK.blue is #1B3A9E -> [27, 58, 158]
    for (let i = 0; i < res.width * res.height; i++) {
      const idx = i * 4;
      if (res.data[idx + 3] > 0) {
        expect(Math.abs(res.data[idx] - 27)).toBeLessThanOrEqual(1);
        expect(Math.abs(res.data[idx + 1] - 58)).toBeLessThanOrEqual(1);
        expect(Math.abs(res.data[idx + 2] - 158)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('3. processSignature with ink original preserves pen colour and prevents pale halos', () => {
    const pen = [30, 50, 160];
    const { raster, strokeCenters } = createSyntheticSignature(pen);
    const res = processSignature(raster, {
      removeBackground: true,
      sensitivity: 50,
      boldness: 50,
      ink: 'original',
    });

    // Stroke-centre colour is within 12 per channel of the pen colour
    for (const s of strokeCenters) {
      const idx = s * 4;
      expect(Math.abs(res.data[idx] - pen[0])).toBeLessThanOrEqual(12);
      expect(Math.abs(res.data[idx + 1] - pen[1])).toBeLessThanOrEqual(12);
      expect(Math.abs(res.data[idx + 2] - pen[2])).toBeLessThanOrEqual(12);
    }

    // Semi-transparent edge pixels (alpha 10-245) are never lighter than pen colour by > 40 in luminance
    const penLum = 0.299 * pen[0] + 0.587 * pen[1] + 0.114 * pen[2];
    for (let i = 0; i < res.width * res.height; i++) {
      const idx = i * 4;
      const alpha = res.data[idx + 3];
      if (alpha >= 10 && alpha <= 245) {
        const edgeLum = 0.299 * res.data[idx] + 0.587 * res.data[idx + 1] + 0.114 * res.data[idx + 2];
        expect(edgeLum - penLum).toBeLessThanOrEqual(40);
      }
    }
  });

  it('4. removeBackground: false returns alpha 255 everywhere and unchanged RGB', () => {
    const { raster } = createSyntheticSignature();
    const res = processSignature(raster, { removeBackground: false });

    expect(res.width).toBe(raster.width);
    expect(res.height).toBe(raster.height);
    for (let i = 0; i < res.width * res.height; i++) {
      const idx = i * 4;
      expect(res.data[idx]).toBe(raster.data[idx]);
      expect(res.data[idx + 1]).toBe(raster.data[idx + 1]);
      expect(res.data[idx + 2]).toBe(raster.data[idx + 2]);
      expect(res.data[idx + 3]).toBe(255);
    }
  });

  it('5. handles already transparent PNG: preserves alpha and recolours to black', () => {
    const width = 100;
    const height = 50;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      if (i > 100 && i < 300) {
        data[idx] = 50; data[idx + 1] = 50; data[idx + 2] = 50; data[idx + 3] = 255;
      } else {
        data[idx + 3] = 0; // transparent
      }
    }
    const r: Raster = { data, width, height };
    expect(hasTransparency(r)).toBe(true);

    const res = processSignature(r, { removeBackground: true, ink: 'black' });
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      expect(res.data[idx + 3]).toBe(r.data[idx + 3]);
      if (res.data[idx + 3] > 0) {
        expect(res.data[idx]).toBe(11);
        expect(res.data[idx + 1]).toBe(11);
        expect(res.data[idx + 2]).toBe(11);
      }
    }
  });

  it('6. autoTrimBounds returns a box containing all stroke pixels and smaller than whole image', () => {
    const { raster, strokeCenters } = createSyntheticSignature();
    const processed = processSignature(raster, { removeBackground: true });
    const bounds = autoTrimBounds(processed);

    expect(bounds).not.toBeNull();
    expect(bounds!.w).toBeLessThan(raster.width);
    expect(bounds!.h).toBeLessThan(raster.height);

    for (const s of strokeCenters) {
      const x = s % raster.width;
      const y = Math.floor(s / raster.width);
      expect(x).toBeGreaterThanOrEqual(bounds!.x);
      expect(x).toBeLessThan(bounds!.x + bounds!.w);
      expect(y).toBeGreaterThanOrEqual(bounds!.y);
      expect(y).toBeLessThan(bounds!.y + bounds!.h);
    }
  });

  it('7. processLogo removes border background and preserves enclosed light shapes', () => {
    const width = 80;
    const height = 80;
    const data = new Uint8ClampedArray(width * height * 4);

    // White background everywhere
    data.fill(255);

    // Center is (40, 40)
    // Red filled circle radius 30 (from r=12 to r=30)
    // White enclosed disc radius 12 (r < 12)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const dist = Math.hypot(x - 40, y - 40);
        if (dist <= 12) {
          // Enclosed white disc
          data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255; data[idx + 3] = 255;
        } else if (dist <= 30) {
          // Red circle
          data[idx] = 220; data[idx + 1] = 20; data[idx + 2] = 20; data[idx + 3] = 255;
        } else {
          // White background
          data[idx] = 255; data[idx + 1] = 255; data[idx + 2] = 255; data[idx + 3] = 255;
        }
      }
    }

    const res = processLogo({ data, width, height }, { removeBackground: true, tolerance: 35 });

    // Border pixels get alpha 0
    expect(res.data[0 * 4 + 3]).toBe(0);
    expect(res.data[(0 * width + 79) * 4 + 3]).toBe(0);
    expect(res.data[(79 * width + 0) * 4 + 3]).toBe(0);

    // The enclosed white disc center (40, 40) stays alpha 255
    const centerIdx = (40 * width + 40) * 4;
    expect(res.data[centerIdx + 3]).toBe(255);
    expect(res.data[centerIdx]).toBe(255);

    // Circle pixels are alpha >= 250
    const circleIdx = (40 * width + 60) * 4; // dist = 20
    expect(res.data[circleIdx + 3]).toBeGreaterThanOrEqual(250);
  });

  it('8. cropRaster clamps rectangles and handles 4x4, all-white and all-black rasters safely', () => {
    const width = 20;
    const height = 20;
    const data = new Uint8ClampedArray(width * height * 4).fill(128);
    const cropped = cropRaster({ data, width, height }, { x: 5, y: 5, w: 10, h: 10 });
    expect(cropped.width).toBe(10);
    expect(cropped.height).toBe(10);
    expect(cropped.data.length).toBe(10 * 10 * 4);

    // Rectangle sticking out
    const clamped = cropRaster({ data, width, height }, { x: 15, y: 15, w: 10, h: 10 });
    expect(clamped.width).toBe(5);
    expect(clamped.height).toBe(5);

    // 4x4 raster
    const tinyData = new Uint8ClampedArray(4 * 4 * 4).fill(255);
    const tinySig = processSignature({ data: tinyData, width: 4, height: 4 }, { removeBackground: true });
    expect(Number.isNaN(tinySig.data[0])).toBe(false);

    // All-white and all-black
    const allWhite = new Uint8ClampedArray(20 * 20 * 4).fill(255);
    const whiteRes = processSignature({ data: allWhite, width: 20, height: 20 }, { removeBackground: true });
    expect(Number.isNaN(whiteRes.data[0])).toBe(false);

    const allBlack = new Uint8ClampedArray(20 * 20 * 4);
    for (let i = 3; i < allBlack.length; i += 4) allBlack[i] = 255;
    const blackRes = processSignature({ data: allBlack, width: 20, height: 20 }, { removeBackground: true });
    expect(Number.isNaN(blackRes.data[0])).toBe(false);
  });
});
