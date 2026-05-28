import { describe, it, expect } from 'vitest';
import {
  calculateCropArea,
  findForegroundBBox,
  adjustCoverage,
  type ForegroundBBox,
} from './coverageCorrector';
import type { SegmentationMask } from '../../types';

/**
 * Helper to create a mock ImageData object.
 */
function createImageData(width: number, height: number, fillValue: number = 255): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillValue;     // R
    data[i + 1] = fillValue; // G
    data[i + 2] = fillValue; // B
    data[i + 3] = 255;       // A
  }
  return { data, width, height, colorSpace: 'srgb' } as ImageData;
}

/**
 * Helper to create a segmentation mask with foreground in a specific region.
 */
function createMask(
  width: number,
  height: number,
  foregroundRegion?: { x: number; y: number; w: number; h: number }
): SegmentationMask {
  const data = new Uint8Array(width * height);
  if (foregroundRegion) {
    const { x, y, w, h } = foregroundRegion;
    for (let row = y; row < y + h && row < height; row++) {
      for (let col = x; col < x + w && col < width; col++) {
        data[row * width + col] = 255;
      }
    }
  }
  return { width, height, data };
}

describe('findForegroundBBox', () => {
  it('should return null when no foreground pixels exist', () => {
    const mask = createMask(100, 100);
    const result = findForegroundBBox(mask);
    expect(result).toBeNull();
  });

  it('should find correct bounding box for a centered region', () => {
    const mask = createMask(100, 100, { x: 20, y: 30, w: 40, h: 50 });
    const result = findForegroundBBox(mask);
    expect(result).toEqual({ minX: 20, minY: 30, maxX: 59, maxY: 79 });
  });

  it('should find correct bounding box for a single pixel', () => {
    const mask: SegmentationMask = { width: 10, height: 10, data: new Uint8Array(100) };
    mask.data[55] = 255; // pixel at (5, 5)
    const result = findForegroundBBox(mask);
    expect(result).toEqual({ minX: 5, minY: 5, maxX: 5, maxY: 5 });
  });
});

describe('calculateCropArea', () => {
  it('should return area containing all foreground pixels', () => {
    const width = 200;
    const height = 200;
    const bbox: ForegroundBBox = { minX: 50, minY: 50, maxX: 149, maxY: 149 };
    const foregroundPixelCount = 100 * 100; // 10000 pixels in 100x100 area

    const cropArea = calculateCropArea(width, height, bbox, foregroundPixelCount, 85);

    // Crop area must contain all foreground pixels
    expect(cropArea.x).toBeLessThanOrEqual(bbox.minX);
    expect(cropArea.y).toBeLessThanOrEqual(bbox.minY);
    expect(cropArea.x + cropArea.width - 1).toBeGreaterThanOrEqual(bbox.maxX);
    expect(cropArea.y + cropArea.height - 1).toBeGreaterThanOrEqual(bbox.maxY);
  });

  it('should achieve target coverage', () => {
    const width = 200;
    const height = 200;
    const bbox: ForegroundBBox = { minX: 50, minY: 50, maxX: 149, maxY: 149 };
    const foregroundPixelCount = 100 * 100; // 10000 pixels

    const cropArea = calculateCropArea(width, height, bbox, foregroundPixelCount, 85);
    const cropTotalPixels = cropArea.width * cropArea.height;
    const achievedCoverage = (foregroundPixelCount / cropTotalPixels) * 100;

    // Coverage should be >= target
    expect(achievedCoverage).toBeGreaterThanOrEqual(85);
  });

  it('should not exceed original image bounds', () => {
    const width = 100;
    const height = 100;
    const bbox: ForegroundBBox = { minX: 10, minY: 10, maxX: 30, maxY: 30 };
    const foregroundPixelCount = 21 * 21;

    const cropArea = calculateCropArea(width, height, bbox, foregroundPixelCount, 85);

    expect(cropArea.x).toBeGreaterThanOrEqual(0);
    expect(cropArea.y).toBeGreaterThanOrEqual(0);
    expect(cropArea.x + cropArea.width).toBeLessThanOrEqual(width);
    expect(cropArea.y + cropArea.height).toBeLessThanOrEqual(height);
  });

  it('should return bounding box when foreground fills entire image', () => {
    const width = 100;
    const height = 100;
    const bbox: ForegroundBBox = { minX: 0, minY: 0, maxX: 99, maxY: 99 };
    const foregroundPixelCount = 100 * 100;

    const cropArea = calculateCropArea(width, height, bbox, foregroundPixelCount, 85);

    // When foreground fills entire image, coverage is already 100%
    // The crop area should be the full image or bounding box
    expect(cropArea.x).toBe(0);
    expect(cropArea.y).toBe(0);
    expect(cropArea.width).toBeLessThanOrEqual(width);
    expect(cropArea.height).toBeLessThanOrEqual(height);
    // All foreground must be included
    expect(cropArea.x + cropArea.width - 1).toBeGreaterThanOrEqual(99);
    expect(cropArea.y + cropArea.height - 1).toBeGreaterThanOrEqual(99);
  });

  it('should handle foreground at image edge', () => {
    const width = 200;
    const height = 200;
    // Foreground at top-left corner
    const bbox: ForegroundBBox = { minX: 0, minY: 0, maxX: 49, maxY: 49 };
    const foregroundPixelCount = 50 * 50;

    const cropArea = calculateCropArea(width, height, bbox, foregroundPixelCount, 85);

    // Must contain all foreground
    expect(cropArea.x).toBeLessThanOrEqual(0);
    expect(cropArea.y).toBeLessThanOrEqual(0);
    expect(cropArea.x + cropArea.width - 1).toBeGreaterThanOrEqual(49);
    expect(cropArea.y + cropArea.height - 1).toBeGreaterThanOrEqual(49);
    // Must not exceed bounds
    expect(cropArea.x).toBeGreaterThanOrEqual(0);
    expect(cropArea.y).toBeGreaterThanOrEqual(0);
  });
});

describe('adjustCoverage', () => {
  it('should return unchanged image when already at target coverage', () => {
    const width = 100;
    const height = 100;
    const imageData = createImageData(width, height, 128);
    // 90% foreground - already above 85%
    const mask = createMask(width, height, { x: 5, y: 5, w: 95, h: 95 });
    // Actually count: 95*95 = 9025 out of 10000 = 90.25%

    const result = adjustCoverage(imageData, mask, 85);

    // Should return original since coverage is already >= 85%
    expect(result.width).toBe(width);
    expect(result.height).toBe(height);
  });

  it('should crop image to increase coverage when below target', () => {
    const width = 200;
    const height = 200;
    const imageData = createImageData(width, height, 128);
    // Small foreground region: 50x50 = 2500 pixels out of 40000 = 6.25%
    const mask = createMask(width, height, { x: 75, y: 75, w: 50, h: 50 });

    const result = adjustCoverage(imageData, mask, 85);

    // Result should be smaller than original
    expect(result.width * result.height).toBeLessThan(width * height);

    // Verify coverage in the cropped result
    // The foreground pixel count should be the same (all preserved)
    // and the total area should be smaller
    const maxAllowedArea = Math.floor(2500 * 100 / 85);
    expect(result.width * result.height).toBeLessThanOrEqual(maxAllowedArea);
  });

  it('should preserve all foreground pixels after cropping', () => {
    const width = 100;
    const height = 100;
    const imageData = createImageData(width, height, 200);
    // Mark specific foreground pixels with distinct color
    const mask = createMask(width, height, { x: 30, y: 30, w: 20, h: 20 });

    // Set foreground pixels to a distinct color (red)
    for (let y = 30; y < 50; y++) {
      for (let x = 30; x < 50; x++) {
        const idx = (y * width + x) * 4;
        imageData.data[idx] = 255;     // R
        imageData.data[idx + 1] = 0;   // G
        imageData.data[idx + 2] = 0;   // B
        imageData.data[idx + 3] = 255; // A
      }
    }

    const result = adjustCoverage(imageData, mask, 85);

    // Count red pixels in result - should be 20*20 = 400
    let redPixelCount = 0;
    for (let i = 0; i < result.data.length; i += 4) {
      if (result.data[i] === 255 && result.data[i + 1] === 0 && result.data[i + 2] === 0) {
        redPixelCount++;
      }
    }
    expect(redPixelCount).toBe(20 * 20);
  });

  it('should return original when no foreground pixels exist', () => {
    const width = 100;
    const height = 100;
    const imageData = createImageData(width, height);
    const mask = createMask(width, height); // No foreground

    const result = adjustCoverage(imageData, mask, 85);

    expect(result.width).toBe(width);
    expect(result.height).toBe(height);
    expect(result.data).toBe(imageData.data);
  });

  it('should handle foreground filling entire image', () => {
    const width = 50;
    const height = 50;
    const imageData = createImageData(width, height, 100);
    // Entire image is foreground
    const mask = createMask(width, height, { x: 0, y: 0, w: 50, h: 50 });

    const result = adjustCoverage(imageData, mask, 85);

    // Coverage is already 100%, should return unchanged
    expect(result.width).toBe(width);
    expect(result.height).toBe(height);
  });

  it('should achieve at least target coverage after adjustment', () => {
    const width = 300;
    const height = 300;
    const imageData = createImageData(width, height, 128);
    // Small centered foreground: 60x60 = 3600 out of 90000 = 4%
    const mask = createMask(width, height, { x: 120, y: 120, w: 60, h: 60 });

    const result = adjustCoverage(imageData, mask, 85);

    // Count foreground pixels in the cropped result
    // All 3600 foreground pixels should be in the result
    const resultTotalPixels = result.width * result.height;
    const achievedCoverage = (3600 / resultTotalPixels) * 100;
    expect(achievedCoverage).toBeGreaterThanOrEqual(85);
  });
});
