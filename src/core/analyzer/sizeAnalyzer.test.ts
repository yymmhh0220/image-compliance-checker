import { describe, it, expect } from 'vitest';
import { analyzeSize } from './sizeAnalyzer';

/**
 * Helper to create a minimal ImageData-like object for testing.
 * We only need width and height for the size analyzer.
 */
function createImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  return { width, height, data, colorSpace: 'srgb' } as ImageData;
}

describe('analyzeSize', () => {
  it('should return compliant when longest edge is exactly 1000', () => {
    const result = analyzeSize(createImageData(1000, 800));
    expect(result.width).toBe(1000);
    expect(result.height).toBe(800);
    expect(result.longEdge).toBe(1000);
    expect(result.isCompliant).toBe(true);
  });

  it('should return compliant when longest edge is greater than 1000', () => {
    const result = analyzeSize(createImageData(1200, 900));
    expect(result.width).toBe(1200);
    expect(result.height).toBe(900);
    expect(result.longEdge).toBe(1200);
    expect(result.isCompliant).toBe(true);
  });

  it('should return non-compliant when longest edge is less than 1000', () => {
    const result = analyzeSize(createImageData(800, 600));
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.longEdge).toBe(800);
    expect(result.isCompliant).toBe(false);
  });

  it('should correctly identify longest edge when width > height', () => {
    const result = analyzeSize(createImageData(1500, 700));
    expect(result.longEdge).toBe(1500);
    expect(result.isCompliant).toBe(true);
  });

  it('should correctly identify longest edge when height > width', () => {
    const result = analyzeSize(createImageData(700, 1500));
    expect(result.longEdge).toBe(1500);
    expect(result.isCompliant).toBe(true);
  });

  it('should handle square images correctly', () => {
    const result = analyzeSize(createImageData(999, 999));
    expect(result.longEdge).toBe(999);
    expect(result.isCompliant).toBe(false);

    const result2 = analyzeSize(createImageData(1000, 1000));
    expect(result2.longEdge).toBe(1000);
    expect(result2.isCompliant).toBe(true);
  });

  it('should return non-compliant for very small images', () => {
    const result = analyzeSize(createImageData(100, 50));
    expect(result.width).toBe(100);
    expect(result.height).toBe(50);
    expect(result.longEdge).toBe(100);
    expect(result.isCompliant).toBe(false);
  });
});
