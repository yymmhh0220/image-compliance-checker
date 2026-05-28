import { describe, it, expect } from 'vitest';
import { replaceBackground } from './backgroundCorrector';
import type { SegmentationMask } from '../../types';

/**
 * Helper to create an ImageData-compatible object for testing.
 * jsdom does not provide ImageData constructor, so we create a plain object.
 */
function createImageData(width: number, height: number, data: Uint8ClampedArray): ImageData {
  return { width, height, data, colorSpace: 'srgb' } as ImageData;
}

/**
 * Helper to create a SegmentationMask.
 */
function createMask(width: number, height: number, maskValues: number[]): SegmentationMask {
  return { width, height, data: new Uint8Array(maskValues) };
}

describe('replaceBackground', () => {
  it('should replace background pixels with pure white', () => {
    // 2x1 image: first pixel is red (background), second is blue (foreground)
    const width = 2;
    const height = 1;
    const data = new Uint8ClampedArray([
      255, 0, 0, 255,   // pixel 0: red
      0, 0, 255, 255,   // pixel 1: blue
    ]);
    const imageData = createImageData(width, height, data);
    const mask = createMask(width, height, [0, 255]); // pixel 0 = background, pixel 1 = foreground

    const result = replaceBackground(imageData, mask);

    // Background pixel should be white
    expect(result.data[0]).toBe(255); // R
    expect(result.data[1]).toBe(255); // G
    expect(result.data[2]).toBe(255); // B
    expect(result.data[3]).toBe(255); // A
  });

  it('should preserve foreground pixels unchanged', () => {
    const width = 2;
    const height = 1;
    const data = new Uint8ClampedArray([
      100, 50, 25, 200, // pixel 0: some color (background)
      0, 0, 255, 255,   // pixel 1: blue (foreground)
    ]);
    const imageData = createImageData(width, height, data);
    const mask = createMask(width, height, [0, 255]); // pixel 0 = background, pixel 1 = foreground

    const result = replaceBackground(imageData, mask);

    // Foreground pixel (index 1) should remain unchanged
    expect(result.data[4]).toBe(0);   // R
    expect(result.data[5]).toBe(0);   // G
    expect(result.data[6]).toBe(255); // B
    expect(result.data[7]).toBe(255); // A
  });

  it('should handle mixed image with both foreground and background', () => {
    // 2x2 image with mixed foreground/background
    const width = 2;
    const height = 2;
    const data = new Uint8ClampedArray([
      10, 20, 30, 255,   // pixel 0: dark (background)
      50, 100, 150, 255, // pixel 1: medium (foreground)
      200, 180, 160, 128,// pixel 2: light semi-transparent (foreground)
      80, 90, 70, 255,   // pixel 3: dark green (background)
    ]);
    const imageData = createImageData(width, height, data);
    const mask = createMask(width, height, [0, 255, 255, 0]);

    const result = replaceBackground(imageData, mask);

    // Pixel 0: background -> white
    expect(result.data[0]).toBe(255);
    expect(result.data[1]).toBe(255);
    expect(result.data[2]).toBe(255);
    expect(result.data[3]).toBe(255);

    // Pixel 1: foreground -> unchanged
    expect(result.data[4]).toBe(50);
    expect(result.data[5]).toBe(100);
    expect(result.data[6]).toBe(150);
    expect(result.data[7]).toBe(255);

    // Pixel 2: foreground -> unchanged
    expect(result.data[8]).toBe(200);
    expect(result.data[9]).toBe(180);
    expect(result.data[10]).toBe(160);
    expect(result.data[11]).toBe(128);

    // Pixel 3: background -> white
    expect(result.data[12]).toBe(255);
    expect(result.data[13]).toBe(255);
    expect(result.data[14]).toBe(255);
    expect(result.data[15]).toBe(255);
  });

  it('should turn entire image white when all pixels are background', () => {
    const width = 3;
    const height = 1;
    const data = new Uint8ClampedArray([
      100, 50, 25, 255,
      0, 128, 64, 200,
      30, 60, 90, 180,
    ]);
    const imageData = createImageData(width, height, data);
    const mask = createMask(width, height, [0, 0, 0]); // all background

    const result = replaceBackground(imageData, mask);

    for (let i = 0; i < 3; i++) {
      const idx = i * 4;
      expect(result.data[idx]).toBe(255);     // R
      expect(result.data[idx + 1]).toBe(255); // G
      expect(result.data[idx + 2]).toBe(255); // B
      expect(result.data[idx + 3]).toBe(255); // A
    }
  });

  it('should leave image unchanged when all pixels are foreground', () => {
    const width = 3;
    const height = 1;
    const originalData = new Uint8ClampedArray([
      100, 50, 25, 255,
      0, 128, 64, 200,
      30, 60, 90, 180,
    ]);
    const imageData = createImageData(width, height, new Uint8ClampedArray(originalData));
    const mask = createMask(width, height, [255, 255, 255]); // all foreground

    const result = replaceBackground(imageData, mask);

    for (let i = 0; i < originalData.length; i++) {
      expect(result.data[i]).toBe(originalData[i]);
    }
  });

  it('should preserve dimensions of the output image', () => {
    const width = 4;
    const height = 3;
    const data = new Uint8ClampedArray(width * height * 4).fill(128);
    const imageData = createImageData(width, height, data);
    const mask = createMask(width, height, new Array(width * height).fill(0));

    const result = replaceBackground(imageData, mask);

    expect(result.width).toBe(width);
    expect(result.height).toBe(height);
  });

  it('should not modify the original imageData', () => {
    const width = 2;
    const height = 1;
    const originalValues = [100, 50, 25, 255, 0, 128, 64, 200];
    const data = new Uint8ClampedArray(originalValues);
    const imageData = createImageData(width, height, data);
    const mask = createMask(width, height, [0, 0]);

    replaceBackground(imageData, mask);

    // Original data should remain unchanged
    for (let i = 0; i < originalValues.length; i++) {
      expect(imageData.data[i]).toBe(originalValues[i]);
    }
  });
});
