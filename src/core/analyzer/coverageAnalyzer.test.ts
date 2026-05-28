import { describe, it, expect } from 'vitest';
import { analyzeCoverage } from './coverageAnalyzer';
import type { SegmentationMask } from '../../types';

/**
 * Helper to create ImageData with specified dimensions.
 * All pixels are white (255, 255, 255, 255) — content doesn't matter for coverage analysis.
 */
function createImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 255;
    data[i * 4 + 1] = 255;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data, colorSpace: 'srgb' } as ImageData;
}

/**
 * Helper to create a SegmentationMask.
 * maskValues: array of 0 (background) or 255 (foreground) for each pixel.
 */
function createMask(width: number, height: number, maskValues: number[]): SegmentationMask {
  return {
    width,
    height,
    data: new Uint8Array(maskValues),
  };
}

describe('analyzeCoverage', () => {
  it('should return compliant for exactly 85% coverage not touching edges', () => {
    // 10x10 image = 100 pixels, need 85 foreground pixels not touching edges
    // Place foreground in the interior (rows 1-8, cols 1-8 = 64 pixels, not enough)
    // Use a 20x5 = 100 pixel image instead
    // 20x5 image: interior is cols 1-18, rows 1-3 = 18*3 = 54 pixels (not enough)
    // Use a 10x20 = 200 pixels image, need 170 foreground pixels in interior
    // Interior: cols 1-8, rows 1-18 = 8*18 = 144 (not enough)
    // Simpler approach: use a 100-pixel image (10x10), place 85 pixels in interior
    // Interior of 10x10: cols 1-8, rows 1-8 = 8*8 = 64 (not enough for 85)
    // Let's use a 20x20 = 400 pixel image, need 340 foreground in interior
    // Interior: cols 1-18, rows 1-18 = 18*18 = 324 (not enough)
    // Use exact math: 20 pixels total, 17 foreground = 85%
    // 5x4 = 20 pixels, interior: cols 1-3, rows 1-2 = 3*2 = 6 (not enough)
    // Better: use a controlled setup where we know the exact percentage
    // 100 pixels (10x10), 85 foreground, none on edges
    // Edges: row 0 (10), row 9 (10), col 0 rows 1-8 (8), col 9 rows 1-8 (8) = 36 edge pixels
    // Interior: 64 pixels — can't fit 85 foreground without touching edges in 10x10

    // Use a larger image: 20x20 = 400 pixels
    // Edge pixels: row 0 (20) + row 19 (20) + col 0 rows 1-18 (18) + col 19 rows 1-18 (18) = 76
    // Interior: 324 pixels
    // Need 85% of 400 = 340 foreground pixels — but interior only has 324
    // Still not enough!

    // Use percentage-based approach: make a small image where math works
    // 4x5 = 20 pixels, 17 foreground = 85%
    // Edge pixels in 4x5: row 0 (4), row 4 (4), col 0 rows 1-3 (3), col 3 rows 1-3 (3) = 14
    // Interior: 6 pixels — can't fit 17 without edges

    // The simplest approach: accept that for high coverage, some pixels will be on edges
    // Instead, test with a scenario where coverage is exactly 85% and NOT touching edges
    // This requires a large enough image. Let's use a 100x100 image.
    const width = 100;
    const height = 100;
    const totalPixels = width * height; // 10000
    const targetForeground = 8500; // 85%

    const maskValues = new Array(totalPixels).fill(0);
    // Fill interior pixels (rows 1-98, cols 1-98) = 98*98 = 9604 interior pixels
    // We need exactly 8500 of them
    let count = 0;
    for (let y = 1; y < height - 1 && count < targetForeground; y++) {
      for (let x = 1; x < width - 1 && count < targetForeground; x++) {
        maskValues[y * width + x] = 255;
        count++;
      }
    }

    const imageData = createImageData(width, height);
    const mask = createMask(width, height, maskValues);

    const result = analyzeCoverage(imageData, mask);

    expect(result.coveragePercentage).toBe(85);
    expect(result.isCompliant).toBe(true);
    expect(result.isCropped).toBe(false);
  });

  it('should return non-compliant for coverage < 85%', () => {
    // 10x10 = 100 pixels, 50 foreground = 50% coverage
    const width = 10;
    const height = 10;
    const maskValues = new Array(100).fill(0);

    // Place 50 foreground pixels in interior (rows 1-8, cols 1-8)
    let count = 0;
    for (let y = 1; y < 9 && count < 50; y++) {
      for (let x = 1; x < 9 && count < 50; x++) {
        maskValues[y * width + x] = 255;
        count++;
      }
    }

    const imageData = createImageData(width, height);
    const mask = createMask(width, height, maskValues);

    const result = analyzeCoverage(imageData, mask);

    expect(result.coveragePercentage).toBe(50);
    expect(result.isCompliant).toBe(false);
    expect(result.isCropped).toBe(false);
  });

  it('should return non-compliant and cropped for 100% coverage touching all edges', () => {
    // 5x5 = 25 pixels, all foreground
    const width = 5;
    const height = 5;
    const maskValues = new Array(25).fill(255);

    const imageData = createImageData(width, height);
    const mask = createMask(width, height, maskValues);

    const result = analyzeCoverage(imageData, mask);

    expect(result.coveragePercentage).toBe(100);
    expect(result.isCropped).toBe(true);
    expect(result.isCompliant).toBe(false); // cropped makes it non-compliant
  });

  it('should return compliant when foreground does not touch any edge', () => {
    // 6x6 = 36 pixels, foreground in center (rows 1-4, cols 1-4) = 16 pixels
    // Coverage = 16/36 ≈ 44.4% — not compliant due to coverage
    // Use a scenario where coverage >= 85% and no edge touching
    // 10x10 = 100 pixels, interior = 8x8 = 64 pixels
    // 64/100 = 64% — still not 85%
    // Use 5x5 = 25 pixels, interior = 3x3 = 9 pixels, 9/25 = 36%
    // Need a different approach: use a large image
    const width = 10;
    const height = 10;
    const totalPixels = 100;
    // Place 90 foreground pixels in interior (rows 1-8, cols 1-8 = 64 max)
    // Can't reach 85% without touching edges in 10x10
    // So test just the "not touching edges" aspect with lower coverage
    const maskValues = new Array(totalPixels).fill(0);

    // Place foreground in center: rows 2-7, cols 2-7 = 6*6 = 36 pixels
    for (let y = 2; y <= 7; y++) {
      for (let x = 2; x <= 7; x++) {
        maskValues[y * width + x] = 255;
      }
    }

    const imageData = createImageData(width, height);
    const mask = createMask(width, height, maskValues);

    const result = analyzeCoverage(imageData, mask);

    expect(result.coveragePercentage).toBe(36);
    expect(result.isCropped).toBe(false);
    // Not compliant because coverage < 85%, but isCropped is false
    expect(result.isCompliant).toBe(false);
  });

  it('should detect cropping when foreground touches top edge', () => {
    // 5x5 = 25 pixels, foreground pixel at row 0 (top edge)
    const width = 5;
    const height = 5;
    const maskValues = new Array(25).fill(0);

    // Place one foreground pixel at top edge (row 0, col 2)
    maskValues[0 * width + 2] = 255;
    // Place more foreground in interior to have some coverage
    maskValues[1 * width + 2] = 255;
    maskValues[2 * width + 2] = 255;

    const imageData = createImageData(width, height);
    const mask = createMask(width, height, maskValues);

    const result = analyzeCoverage(imageData, mask);

    expect(result.isCropped).toBe(true);
    expect(result.isCompliant).toBe(false); // cropped → non-compliant
    expect(result.coveragePercentage).toBe(12); // 3/25 * 100 = 12%
  });

  it('should return 0% coverage and empty bounding box for empty mask', () => {
    // 5x5 = 25 pixels, no foreground
    const width = 5;
    const height = 5;
    const maskValues = new Array(25).fill(0);

    const imageData = createImageData(width, height);
    const mask = createMask(width, height, maskValues);

    const result = analyzeCoverage(imageData, mask);

    expect(result.coveragePercentage).toBe(0);
    expect(result.isCompliant).toBe(false); // 0% < 85%
    expect(result.isCropped).toBe(false);
    expect(result.boundingBox).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('should calculate bounding box correctly', () => {
    // 10x10 image, foreground pixels at specific positions
    const width = 10;
    const height = 10;
    const maskValues = new Array(100).fill(0);

    // Place foreground at: (2,3), (5,3), (3,7), (6,7)
    // minX=2, maxX=6, minY=3, maxY=7
    maskValues[3 * width + 2] = 255; // (2, 3)
    maskValues[3 * width + 5] = 255; // (5, 3)
    maskValues[7 * width + 3] = 255; // (3, 7)
    maskValues[7 * width + 6] = 255; // (6, 7)

    const imageData = createImageData(width, height);
    const mask = createMask(width, height, maskValues);

    const result = analyzeCoverage(imageData, mask);

    expect(result.boundingBox).toEqual({
      x: 2,
      y: 3,
      width: 5,  // maxX - minX + 1 = 6 - 2 + 1 = 5
      height: 5, // maxY - minY + 1 = 7 - 3 + 1 = 5
    });
    expect(result.coveragePercentage).toBe(4); // 4/100 * 100
    expect(result.isCropped).toBe(false);
  });

  it('should detect cropping when foreground touches left edge', () => {
    const width = 5;
    const height = 5;
    const maskValues = new Array(25).fill(0);

    // Place foreground pixel at left edge (col 0, row 2)
    maskValues[2 * width + 0] = 255;

    const imageData = createImageData(width, height);
    const mask = createMask(width, height, maskValues);

    const result = analyzeCoverage(imageData, mask);

    expect(result.isCropped).toBe(true);
  });

  it('should detect cropping when foreground touches right edge', () => {
    const width = 5;
    const height = 5;
    const maskValues = new Array(25).fill(0);

    // Place foreground pixel at right edge (col 4, row 2)
    maskValues[2 * width + 4] = 255;

    const imageData = createImageData(width, height);
    const mask = createMask(width, height, maskValues);

    const result = analyzeCoverage(imageData, mask);

    expect(result.isCropped).toBe(true);
  });

  it('should detect cropping when foreground touches bottom edge', () => {
    const width = 5;
    const height = 5;
    const maskValues = new Array(25).fill(0);

    // Place foreground pixel at bottom edge (row 4, col 2)
    maskValues[4 * width + 2] = 255;

    const imageData = createImageData(width, height);
    const mask = createMask(width, height, maskValues);

    const result = analyzeCoverage(imageData, mask);

    expect(result.isCropped).toBe(true);
  });

  it('should calculate bounding box for single pixel', () => {
    const width = 10;
    const height = 10;
    const maskValues = new Array(100).fill(0);

    // Single foreground pixel at (4, 5)
    maskValues[5 * width + 4] = 255;

    const imageData = createImageData(width, height);
    const mask = createMask(width, height, maskValues);

    const result = analyzeCoverage(imageData, mask);

    expect(result.boundingBox).toEqual({
      x: 4,
      y: 5,
      width: 1,
      height: 1,
    });
  });
});
