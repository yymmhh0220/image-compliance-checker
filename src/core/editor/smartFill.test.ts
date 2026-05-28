import { describe, it, expect } from 'vitest';
import { isPointInRegion, applySmartFill } from './smartFill';
import type { Region } from '../../types';

/**
 * Helper to create an ImageData-compatible object for testing.
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

describe('smartFill', () => {
  describe('isPointInRegion', () => {
    it('correctly identifies a point inside a square polygon', () => {
      const region: Region = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
      };

      expect(isPointInRegion({ x: 5, y: 5 }, region)).toBe(true);
      expect(isPointInRegion({ x: 1, y: 1 }, region)).toBe(true);
      expect(isPointInRegion({ x: 9, y: 9 }, region)).toBe(true);
    });

    it('correctly identifies a point outside a square polygon', () => {
      const region: Region = {
        points: [
          { x: 2, y: 2 },
          { x: 8, y: 2 },
          { x: 8, y: 8 },
          { x: 2, y: 8 },
        ],
      };

      expect(isPointInRegion({ x: 0, y: 0 }, region)).toBe(false);
      expect(isPointInRegion({ x: 10, y: 10 }, region)).toBe(false);
      expect(isPointInRegion({ x: 1, y: 5 }, region)).toBe(false);
      expect(isPointInRegion({ x: 9, y: 5 }, region)).toBe(false);
    });

    it('correctly identifies points with a triangle polygon', () => {
      const region: Region = {
        points: [
          { x: 5, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
      };

      // Center of triangle should be inside
      expect(isPointInRegion({ x: 5, y: 7 }, region)).toBe(true);

      // Point clearly outside
      expect(isPointInRegion({ x: 0, y: 0 }, region)).toBe(false);
      expect(isPointInRegion({ x: 10, y: 0 }, region)).toBe(false);
    });

    it('returns false for a degenerate region with fewer than 3 points', () => {
      const region1: Region = { points: [] };
      const region2: Region = { points: [{ x: 0, y: 0 }] };
      const region3: Region = {
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
        ],
      };

      expect(isPointInRegion({ x: 0, y: 0 }, region1)).toBe(false);
      expect(isPointInRegion({ x: 0, y: 0 }, region2)).toBe(false);
      expect(isPointInRegion({ x: 2, y: 2 }, region3)).toBe(false);
    });

    it('handles concave polygon correctly', () => {
      // L-shaped polygon
      const region: Region = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 5 },
          { x: 5, y: 5 },
          { x: 5, y: 10 },
          { x: 0, y: 10 },
        ],
      };

      // Inside the L
      expect(isPointInRegion({ x: 2, y: 2 }, region)).toBe(true);
      expect(isPointInRegion({ x: 2, y: 8 }, region)).toBe(true);
      expect(isPointInRegion({ x: 8, y: 2 }, region)).toBe(true);

      // Outside the L (in the concave area)
      expect(isPointInRegion({ x: 8, y: 8 }, region)).toBe(false);
    });
  });

  describe('applySmartFill', () => {
    it('preserves pixels outside the region', () => {
      const imageData = createImageData(20, 20, 100, 150, 200, 255);
      const region: Region = {
        points: [
          { x: 8, y: 8 },
          { x: 12, y: 8 },
          { x: 12, y: 12 },
          { x: 8, y: 12 },
        ],
      };

      const { newImageData } = applySmartFill(imageData, region);

      // Pixels clearly outside the region should remain unchanged
      const cornerPixel = getPixel(newImageData, 0, 0);
      expect(cornerPixel).toEqual({ r: 100, g: 150, b: 200, a: 255 });

      const farPixel = getPixel(newImageData, 19, 19);
      expect(farPixel).toEqual({ r: 100, g: 150, b: 200, a: 255 });

      const topPixel = getPixel(newImageData, 10, 0);
      expect(topPixel).toEqual({ r: 100, g: 150, b: 200, a: 255 });
    });

    it('changes pixels inside the region', () => {
      // Create an image with a distinct colored region that differs from surroundings
      const imageData = createImageData(20, 20, 200, 200, 200, 255);
      // Paint the center area a different color to make it obvious
      for (let y = 8; y <= 12; y++) {
        for (let x = 8; x <= 12; x++) {
          const index = (y * 20 + x) * 4;
          imageData.data[index] = 50;     // R - very different from surrounding
          imageData.data[index + 1] = 50; // G
          imageData.data[index + 2] = 50; // B
          imageData.data[index + 3] = 255;
        }
      }

      const region: Region = {
        points: [
          { x: 8, y: 8 },
          { x: 12, y: 8 },
          { x: 12, y: 12 },
          { x: 8, y: 12 },
        ],
      };

      const { newImageData } = applySmartFill(imageData, region);

      // The center pixel (inside the region) should be changed
      // It should be filled based on surrounding pixels (which are 200,200,200)
      const centerPixel = getPixel(newImageData, 10, 10);

      // The filled pixel should be different from the original dark color (50,50,50)
      // and closer to the surrounding color (200,200,200)
      expect(centerPixel.r).not.toBe(50);
      expect(centerPixel.g).not.toBe(50);
      expect(centerPixel.b).not.toBe(50);

      // Should be influenced by surrounding pixels (200,200,200)
      expect(centerPixel.r).toBeGreaterThan(100);
      expect(centerPixel.g).toBeGreaterThan(100);
      expect(centerPixel.b).toBeGreaterThan(100);
    });

    it('correctly captures previous data for undo', () => {
      const imageData = createImageData(20, 20, 100, 150, 200, 255);
      // Paint center area differently
      for (let y = 8; y <= 12; y++) {
        for (let x = 8; x <= 12; x++) {
          const index = (y * 20 + x) * 4;
          imageData.data[index] = 50;
          imageData.data[index + 1] = 50;
          imageData.data[index + 2] = 50;
          imageData.data[index + 3] = 255;
        }
      }

      const region: Region = {
        points: [
          { x: 8, y: 8 },
          { x: 12, y: 8 },
          { x: 12, y: 12 },
          { x: 8, y: 12 },
        ],
      };

      const { previousData } = applySmartFill(imageData, region);

      // Previous data should match the original image data exactly
      expect(previousData.width).toBe(20);
      expect(previousData.height).toBe(20);

      // Check that previous data has the original pixel values
      const cornerPixel = getPixel(previousData, 0, 0);
      expect(cornerPixel).toEqual({ r: 100, g: 150, b: 200, a: 255 });

      const centerPixel = getPixel(previousData, 10, 10);
      expect(centerPixel).toEqual({ r: 50, g: 50, b: 50, a: 255 });
    });

    it('does not modify the original input imageData', () => {
      const imageData = createImageData(20, 20, 100, 150, 200, 255);
      const originalDataCopy = new Uint8ClampedArray(imageData.data);

      const region: Region = {
        points: [
          { x: 8, y: 8 },
          { x: 12, y: 8 },
          { x: 12, y: 12 },
          { x: 8, y: 12 },
        ],
      };

      applySmartFill(imageData, region);

      // Original input should not be modified
      expect(imageData.data).toEqual(originalDataCopy);
    });

    it('handles a region with fewer than 3 points gracefully', () => {
      const imageData = createImageData(10, 10, 100, 150, 200, 255);
      const region: Region = {
        points: [
          { x: 5, y: 5 },
          { x: 7, y: 7 },
        ],
      };

      const { newImageData, previousData } = applySmartFill(imageData, region);

      // No changes should be made
      expect(newImageData.data).toEqual(imageData.data);
      expect(previousData.data).toEqual(imageData.data);
    });

    it('creates natural transition at edges (edge pixels blend with surroundings)', () => {
      // Create image with uniform surrounding color
      const imageData = createImageData(30, 30, 200, 200, 200, 255);
      // Paint center area black
      for (let y = 10; y <= 20; y++) {
        for (let x = 10; x <= 20; x++) {
          const index = (y * 30 + x) * 4;
          imageData.data[index] = 0;
          imageData.data[index + 1] = 0;
          imageData.data[index + 2] = 0;
          imageData.data[index + 3] = 255;
        }
      }

      const region: Region = {
        points: [
          { x: 10, y: 10 },
          { x: 20, y: 10 },
          { x: 20, y: 20 },
          { x: 10, y: 20 },
        ],
      };

      const { newImageData } = applySmartFill(imageData, region);

      // Center pixel should be heavily influenced by surrounding (200,200,200)
      const centerPixel = getPixel(newImageData, 15, 15);
      expect(centerPixel.r).toBeGreaterThan(50);

      // Edge pixel (just inside the region) should show transition
      // It should be between original (0) and fill color
      const edgePixel = getPixel(newImageData, 11, 15);
      // Edge pixel should be different from original black
      expect(edgePixel.r).toBeGreaterThan(0);
    });
  });
});
