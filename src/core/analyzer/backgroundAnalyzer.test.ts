import { describe, it, expect } from 'vitest';
import { analyzeBackground } from './backgroundAnalyzer';
import type { SegmentationMask } from '../../types';

/**
 * Helper to create ImageData with specified pixel values.
 * pixels is an array of [r, g, b, a] tuples.
 */
function createImageData(width: number, height: number, pixels: [number, number, number, number][]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i++) {
    data[i * 4] = pixels[i][0];
    data[i * 4 + 1] = pixels[i][1];
    data[i * 4 + 2] = pixels[i][2];
    data[i * 4 + 3] = pixels[i][3];
  }
  return { width, height, data, colorSpace: 'srgb' } as ImageData;
}

/**
 * Helper to create a uniform ImageData where all pixels have the same color.
 */
function createUniformImageData(width: number, height: number, r: number, g: number, b: number): ImageData {
  const totalPixels = width * height;
  const pixels: [number, number, number, number][] = [];
  for (let i = 0; i < totalPixels; i++) {
    pixels.push([r, g, b, 255]);
  }
  return createImageData(width, height, pixels);
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

describe('analyzeBackground', () => {
  it('should return compliant for pure white background', () => {
    // 2x2 image, all white, all background
    const imageData = createUniformImageData(2, 2, 255, 255, 255);
    const mask = createMask(2, 2, [0, 0, 0, 0]); // all background

    const result = analyzeBackground(imageData, mask);

    expect(result.isCompliant).toBe(true);
    expect(result.averageRGB.r).toBe(255);
    expect(result.averageRGB.g).toBe(255);
    expect(result.averageRGB.b).toBe(255);
    expect(result.maxDeviation).toBe(0);
    expect(result.nonWhitePercentage).toBe(0);
  });

  it('should return compliant for near-white background with all channels >= 250', () => {
    // 2x2 image, near-white (252, 251, 250), all background
    const imageData = createUniformImageData(2, 2, 252, 251, 250);
    const mask = createMask(2, 2, [0, 0, 0, 0]);

    const result = analyzeBackground(imageData, mask);

    expect(result.isCompliant).toBe(true);
    expect(result.averageRGB.r).toBe(252);
    expect(result.averageRGB.g).toBe(251);
    expect(result.averageRGB.b).toBe(250);
    expect(result.maxDeviation).toBe(5); // 255 - 250
    expect(result.nonWhitePercentage).toBe(0); // all channels >= 250, so no non-white pixels
  });

  it('should return non-compliant when one channel average < 250', () => {
    // 2x2 image, background has low blue channel (255, 255, 240)
    const imageData = createUniformImageData(2, 2, 255, 255, 240);
    const mask = createMask(2, 2, [0, 0, 0, 0]);

    const result = analyzeBackground(imageData, mask);

    expect(result.isCompliant).toBe(false);
    expect(result.averageRGB.r).toBe(255);
    expect(result.averageRGB.g).toBe(255);
    expect(result.averageRGB.b).toBe(240);
    expect(result.maxDeviation).toBe(15); // 255 - 240
    expect(result.nonWhitePercentage).toBe(100); // all pixels have b < 250
  });

  it('should return compliant when no background pixels exist (all foreground)', () => {
    // 2x2 image, all foreground (mask = 255)
    const imageData = createUniformImageData(2, 2, 100, 100, 100);
    const mask = createMask(2, 2, [255, 255, 255, 255]); // all foreground

    const result = analyzeBackground(imageData, mask);

    expect(result.isCompliant).toBe(true);
    expect(result.averageRGB.r).toBe(255);
    expect(result.averageRGB.g).toBe(255);
    expect(result.averageRGB.b).toBe(255);
    expect(result.maxDeviation).toBe(0);
    expect(result.nonWhitePercentage).toBe(0);
  });

  it('should correctly handle mixed background pixels', () => {
    // 2x2 image: 2 background pixels (one white, one gray), 2 foreground pixels
    const pixels: [number, number, number, number][] = [
      [255, 255, 255, 255], // background - white
      [200, 200, 200, 255], // background - gray
      [100, 50, 30, 255],   // foreground - ignored
      [0, 0, 0, 255],       // foreground - ignored
    ];
    const imageData = createImageData(2, 2, pixels);
    const mask = createMask(2, 2, [0, 0, 255, 255]); // first 2 are background

    const result = analyzeBackground(imageData, mask);

    // Average of background: (255+200)/2 = 227.5 for each channel
    expect(result.averageRGB.r).toBeCloseTo(227.5);
    expect(result.averageRGB.g).toBeCloseTo(227.5);
    expect(result.averageRGB.b).toBeCloseTo(227.5);
    expect(result.isCompliant).toBe(false); // 227.5 < 250
    expect(result.maxDeviation).toBeCloseTo(27.5); // 255 - 227.5
    // 1 out of 2 background pixels is non-white (the gray one)
    expect(result.nonWhitePercentage).toBe(50);
  });

  it('should only consider background pixels (mask === 0) for analysis', () => {
    // 4 pixels: 1 background (white), 3 foreground (dark colors)
    const pixels: [number, number, number, number][] = [
      [255, 255, 255, 255], // background
      [0, 0, 0, 255],       // foreground
      [50, 50, 50, 255],    // foreground
      [100, 100, 100, 255], // foreground
    ];
    const imageData = createImageData(2, 2, pixels);
    const mask = createMask(2, 2, [0, 255, 255, 255]);

    const result = analyzeBackground(imageData, mask);

    // Only the first pixel (white) is background
    expect(result.averageRGB.r).toBe(255);
    expect(result.averageRGB.g).toBe(255);
    expect(result.averageRGB.b).toBe(255);
    expect(result.isCompliant).toBe(true);
    expect(result.nonWhitePercentage).toBe(0);
  });

  it('should calculate nonWhitePercentage correctly with mixed white and non-white background', () => {
    // 4 pixels all background: 3 white, 1 non-white
    const pixels: [number, number, number, number][] = [
      [255, 255, 255, 255], // white
      [255, 255, 255, 255], // white
      [255, 255, 255, 255], // white
      [240, 255, 255, 255], // non-white (r < 250)
    ];
    const imageData = createImageData(2, 2, pixels);
    const mask = createMask(2, 2, [0, 0, 0, 0]);

    const result = analyzeBackground(imageData, mask);

    // Average R = (255+255+255+240)/4 = 251.25
    expect(result.averageRGB.r).toBeCloseTo(251.25);
    expect(result.averageRGB.g).toBe(255);
    expect(result.averageRGB.b).toBe(255);
    expect(result.isCompliant).toBe(true); // 251.25 >= 250
    expect(result.nonWhitePercentage).toBe(25); // 1 out of 4 is non-white
  });

  it('should return non-compliant when average is just below threshold', () => {
    // All background pixels at exactly 249 for one channel
    const imageData = createUniformImageData(2, 2, 255, 249, 255);
    const mask = createMask(2, 2, [0, 0, 0, 0]);

    const result = analyzeBackground(imageData, mask);

    expect(result.isCompliant).toBe(false); // avgG = 249 < 250
    expect(result.averageRGB.g).toBe(249);
    expect(result.maxDeviation).toBe(6); // 255 - 249
  });
});
