import { describe, it, expect } from 'vitest';
import { analyzeMultiView } from './multiViewAnalyzer';
import type { SegmentationMask } from '../../types';

/**
 * Helper to create ImageData with specified dimensions.
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
 */
function createMask(width: number, height: number, maskValues: number[]): SegmentationMask {
  return {
    width,
    height,
    data: new Uint8Array(maskValues),
  };
}

describe('analyzeMultiView', () => {
  it('should return compliant for a single connected foreground region', () => {
    // 10x10 image, one large connected block in the center (rows 2-7, cols 2-7 = 36 pixels)
    // Total = 100, threshold = 1 pixel (1% of 100)
    const width = 10;
    const height = 10;
    const maskValues = new Array(100).fill(0);

    // Single connected block
    for (let y = 2; y <= 7; y++) {
      for (let x = 2; x <= 7; x++) {
        maskValues[y * width + x] = 255;
      }
    }

    const imageData = createImageData(width, height);
    const mask = createMask(width, height, maskValues);

    const result = analyzeMultiView(imageData, mask);

    expect(result.hasMultipleViews).toBe(false);
    expect(result.viewCount).toBe(1);
    expect(result.isCompliant).toBe(true);
  });

  it('should return non-compliant for two separate foreground regions', () => {
    // 20x10 = 200 pixels, threshold = 2 pixels (1% of 200)
    // Region 1: rows 2-7, cols 1-4 = 6*4 = 24 pixels (left block)
    // Region 2: rows 2-7, cols 15-18 = 6*4 = 24 pixels (right block)
    // Both are well above threshold
    const width = 20;
    const height = 10;
    const maskValues = new Array(200).fill(0);

    // Region 1 (left)
    for (let y = 2; y <= 7; y++) {
      for (let x = 1; x <= 4; x++) {
        maskValues[y * width + x] = 255;
      }
    }

    // Region 2 (right)
    for (let y = 2; y <= 7; y++) {
      for (let x = 15; x <= 18; x++) {
        maskValues[y * width + x] = 255;
      }
    }

    const imageData = createImageData(width, height);
    const mask = createMask(width, height, maskValues);

    const result = analyzeMultiView(imageData, mask);

    expect(result.hasMultipleViews).toBe(true);
    expect(result.viewCount).toBe(2);
    expect(result.isCompliant).toBe(false);
  });

  it('should filter out small noise regions below 1% threshold', () => {
    // 100x100 = 10000 pixels, threshold = 100 pixels (1%)
    // One large region: 50x50 = 2500 pixels (well above threshold)
    // Several small noise regions: each < 100 pixels
    const width = 100;
    const height = 100;
    const maskValues = new Array(10000).fill(0);

    // Large region (rows 10-59, cols 10-59) = 50*50 = 2500 pixels
    for (let y = 10; y <= 59; y++) {
      for (let x = 10; x <= 59; x++) {
        maskValues[y * width + x] = 255;
      }
    }

    // Small noise region 1: 3x3 = 9 pixels at top-left corner area (rows 2-4, cols 2-4)
    for (let y = 2; y <= 4; y++) {
      for (let x = 2; x <= 4; x++) {
        maskValues[y * width + x] = 255;
      }
    }

    // Small noise region 2: 5x5 = 25 pixels at bottom-right (rows 80-84, cols 80-84)
    for (let y = 80; y <= 84; y++) {
      for (let x = 80; x <= 84; x++) {
        maskValues[y * width + x] = 255;
      }
    }

    const imageData = createImageData(width, height);
    const mask = createMask(width, height, maskValues);

    const result = analyzeMultiView(imageData, mask);

    // Only the large region counts; noise regions are filtered out
    expect(result.hasMultipleViews).toBe(false);
    expect(result.viewCount).toBe(1);
    expect(result.isCompliant).toBe(true);
  });

  it('should return compliant with viewCount 0 when no foreground pixels exist', () => {
    // 10x10 image, all background
    const width = 10;
    const height = 10;
    const maskValues = new Array(100).fill(0);

    const imageData = createImageData(width, height);
    const mask = createMask(width, height, maskValues);

    const result = analyzeMultiView(imageData, mask);

    expect(result.hasMultipleViews).toBe(false);
    expect(result.viewCount).toBe(0);
    expect(result.isCompliant).toBe(true);
  });

  it('should return non-compliant for two large separate regions', () => {
    // 100x100 = 10000 pixels, threshold = 100 pixels
    // Region 1: rows 5-30, cols 5-30 = 26*26 = 676 pixels (top-left)
    // Region 2: rows 60-85, cols 60-85 = 26*26 = 676 pixels (bottom-right)
    const width = 100;
    const height = 100;
    const maskValues = new Array(10000).fill(0);

    // Region 1 (top-left)
    for (let y = 5; y <= 30; y++) {
      for (let x = 5; x <= 30; x++) {
        maskValues[y * width + x] = 255;
      }
    }

    // Region 2 (bottom-right)
    for (let y = 60; y <= 85; y++) {
      for (let x = 60; x <= 85; x++) {
        maskValues[y * width + x] = 255;
      }
    }

    const imageData = createImageData(width, height);
    const mask = createMask(width, height, maskValues);

    const result = analyzeMultiView(imageData, mask);

    expect(result.hasMultipleViews).toBe(true);
    expect(result.viewCount).toBe(2);
    expect(result.isCompliant).toBe(false);
  });
});
