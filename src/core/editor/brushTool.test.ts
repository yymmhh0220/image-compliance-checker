import { describe, it, expect } from 'vitest';
import { applyBrush, applyBrushStroke } from './brushTool';
import type { Point } from '../../types';

/**
 * Helper to create an ImageData-compatible object for testing.
 * jsdom does not provide ImageData constructor, so we create a plain object.
 */
function createImageData(
  width: number,
  height: number,
  r = 100,
  g = 150,
  b = 200,
  a = 255
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return { width, height, data, colorSpace: 'srgb' } as ImageData;
}

/**
 * Helper to get pixel RGBA at a given coordinate.
 */
function getPixel(imageData: ImageData, x: number, y: number) {
  const index = (y * imageData.width + x) * 4;
  return {
    r: imageData.data[index],
    g: imageData.data[index + 1],
    b: imageData.data[index + 2],
    a: imageData.data[index + 3],
  };
}

describe('brushTool', () => {
  describe('applyBrush', () => {
    it('fills pixels white within the brush radius', () => {
      const imageData = createImageData(20, 20);
      const point: Point = { x: 10, y: 10 };
      const brushSize = 6; // radius = 3

      const { newImageData } = applyBrush(imageData, point, brushSize);

      // Center pixel should be white
      const centerPixel = getPixel(newImageData, 10, 10);
      expect(centerPixel).toEqual({ r: 255, g: 255, b: 255, a: 255 });

      // Pixel at distance 2 from center (within radius 3) should be white
      const nearPixel = getPixel(newImageData, 12, 10);
      expect(nearPixel).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    });

    it('leaves pixels outside the brush radius unchanged', () => {
      const imageData = createImageData(20, 20);
      const point: Point = { x: 10, y: 10 };
      const brushSize = 4; // radius = 2

      const { newImageData } = applyBrush(imageData, point, brushSize);

      // Pixel far from center should remain unchanged
      const farPixel = getPixel(newImageData, 0, 0);
      expect(farPixel).toEqual({ r: 100, g: 150, b: 200, a: 255 });

      // Pixel at distance > radius should remain unchanged
      const outsidePixel = getPixel(newImageData, 15, 15);
      expect(outsidePixel).toEqual({ r: 100, g: 150, b: 200, a: 255 });
    });

    it('correctly captures previous data for undo', () => {
      const imageData = createImageData(10, 10, 50, 75, 100, 255);
      const point: Point = { x: 5, y: 5 };
      const brushSize = 4;

      const { previousData } = applyBrush(imageData, point, brushSize);

      // Previous data should match the original image data
      expect(previousData.width).toBe(10);
      expect(previousData.height).toBe(10);

      // All pixels in previousData should be the original color
      const pixel = getPixel(previousData, 5, 5);
      expect(pixel).toEqual({ r: 50, g: 75, b: 100, a: 255 });
    });

    it('does not modify the original imageData', () => {
      const imageData = createImageData(10, 10);
      const originalData = new Uint8ClampedArray(imageData.data);
      const point: Point = { x: 5, y: 5 };
      const brushSize = 4;

      applyBrush(imageData, point, brushSize);

      // Original imageData should remain unchanged
      expect(imageData.data).toEqual(originalData);
    });

    it('handles brush at image boundary (top-left corner)', () => {
      const imageData = createImageData(10, 10);
      const point: Point = { x: 0, y: 0 };
      const brushSize = 6; // radius = 3

      const { newImageData } = applyBrush(imageData, point, brushSize);

      // Center pixel (0,0) should be white
      const centerPixel = getPixel(newImageData, 0, 0);
      expect(centerPixel).toEqual({ r: 255, g: 255, b: 255, a: 255 });

      // Pixel within radius should be white
      const nearPixel = getPixel(newImageData, 1, 1);
      expect(nearPixel).toEqual({ r: 255, g: 255, b: 255, a: 255 });

      // Should not throw or corrupt data
      expect(newImageData.width).toBe(10);
      expect(newImageData.height).toBe(10);
    });

    it('handles brush at image boundary (bottom-right corner)', () => {
      const imageData = createImageData(10, 10);
      const point: Point = { x: 9, y: 9 };
      const brushSize = 6; // radius = 3

      const { newImageData } = applyBrush(imageData, point, brushSize);

      // Center pixel should be white
      const centerPixel = getPixel(newImageData, 9, 9);
      expect(centerPixel).toEqual({ r: 255, g: 255, b: 255, a: 255 });

      // Should not throw or corrupt data
      expect(newImageData.width).toBe(10);
      expect(newImageData.height).toBe(10);
    });

    it('supports adjustable brush sizes', () => {
      const imageData = createImageData(30, 30);
      const point: Point = { x: 15, y: 15 };

      // Small brush (size 2, radius 1)
      const { newImageData: smallResult } = applyBrush(imageData, point, 2);
      // Large brush (size 20, radius 10)
      const { newImageData: largeResult } = applyBrush(imageData, point, 20);

      // Count white pixels for each
      let smallWhiteCount = 0;
      let largeWhiteCount = 0;

      for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 30; x++) {
          const smallPixel = getPixel(smallResult, x, y);
          const largePixel = getPixel(largeResult, x, y);
          if (smallPixel.r === 255 && smallPixel.g === 255 && smallPixel.b === 255) {
            smallWhiteCount++;
          }
          if (largePixel.r === 255 && largePixel.g === 255 && largePixel.b === 255) {
            largeWhiteCount++;
          }
        }
      }

      // Larger brush should affect more pixels
      expect(largeWhiteCount).toBeGreaterThan(smallWhiteCount);
    });
  });

  describe('applyBrushStroke', () => {
    it('applies brush to all points in the stroke', () => {
      const imageData = createImageData(30, 30);
      const points: Point[] = [
        { x: 5, y: 15 },
        { x: 15, y: 15 },
        { x: 25, y: 15 },
      ];
      const brushSize = 4;

      const { newImageData } = applyBrushStroke(imageData, points, brushSize);

      // Each point center should be white
      for (const p of points) {
        const pixel = getPixel(newImageData, p.x, p.y);
        expect(pixel).toEqual({ r: 255, g: 255, b: 255, a: 255 });
      }
    });

    it('saves original state before the entire stroke for undo', () => {
      const imageData = createImageData(20, 20, 30, 60, 90, 255);
      const points: Point[] = [
        { x: 5, y: 5 },
        { x: 10, y: 10 },
      ];
      const brushSize = 4;

      const { previousData } = applyBrushStroke(imageData, points, brushSize);

      // Previous data should contain the original colors at all positions
      const pixel1 = getPixel(previousData, 5, 5);
      expect(pixel1).toEqual({ r: 30, g: 60, b: 90, a: 255 });

      const pixel2 = getPixel(previousData, 10, 10);
      expect(pixel2).toEqual({ r: 30, g: 60, b: 90, a: 255 });
    });

    it('handles empty points array gracefully', () => {
      const imageData = createImageData(10, 10);
      const points: Point[] = [];
      const brushSize = 4;

      const { newImageData, previousData } = applyBrushStroke(imageData, points, brushSize);

      // No changes should be made
      expect(newImageData.data).toEqual(imageData.data);
      expect(previousData.data).toEqual(imageData.data);
    });

    it('handles single point stroke same as applyBrush', () => {
      const imageData = createImageData(20, 20);
      const point: Point = { x: 10, y: 10 };
      const brushSize = 6;

      const { newImageData: strokeResult } = applyBrushStroke(imageData, [point], brushSize);
      const { newImageData: singleResult } = applyBrush(imageData, point, brushSize);

      // Results should be identical
      expect(strokeResult.data).toEqual(singleResult.data);
    });
  });
});
