import { describe, it, expect } from 'vitest';
import { applyEraser, applyEraserStroke } from './eraserTool';
import { applyBrush } from './brushTool';
import type { Point } from '../../types';

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

describe('eraserTool', () => {
  describe('applyEraser', () => {
    it('restores pixels to original values within the eraser radius', () => {
      const originalImageData = createImageData(20, 20, 100, 150, 200, 255);
      // Simulate edited image where center area is white (as if painted by brush)
      const editedImageData = createImageData(20, 20, 100, 150, 200, 255);
      // Manually paint center area white
      for (let y = 8; y <= 12; y++) {
        for (let x = 8; x <= 12; x++) {
          const index = (y * 20 + x) * 4;
          editedImageData.data[index] = 255;
          editedImageData.data[index + 1] = 255;
          editedImageData.data[index + 2] = 255;
          editedImageData.data[index + 3] = 255;
        }
      }

      const point: Point = { x: 10, y: 10 };
      const eraserSize = 6; // radius = 3

      const { newImageData } = applyEraser(editedImageData, originalImageData, point, eraserSize);

      // Center pixel should be restored to original
      const centerPixel = getPixel(newImageData, 10, 10);
      expect(centerPixel).toEqual({ r: 100, g: 150, b: 200, a: 255 });

      // Pixel within radius should be restored
      const nearPixel = getPixel(newImageData, 11, 10);
      expect(nearPixel).toEqual({ r: 100, g: 150, b: 200, a: 255 });
    });

    it('leaves pixels outside the eraser radius unchanged', () => {
      const originalImageData = createImageData(20, 20, 100, 150, 200, 255);
      // Create edited image that is all white
      const editedImageData = createImageData(20, 20, 255, 255, 255, 255);

      const point: Point = { x: 10, y: 10 };
      const eraserSize = 4; // radius = 2

      const { newImageData } = applyEraser(editedImageData, originalImageData, point, eraserSize);

      // Pixel far from center should remain white (edited state)
      const farPixel = getPixel(newImageData, 0, 0);
      expect(farPixel).toEqual({ r: 255, g: 255, b: 255, a: 255 });

      // Pixel at distance > radius should remain white
      const outsidePixel = getPixel(newImageData, 15, 15);
      expect(outsidePixel).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    });

    it('correctly captures previous data for undo', () => {
      const originalImageData = createImageData(10, 10, 50, 75, 100, 255);
      const editedImageData = createImageData(10, 10, 255, 255, 255, 255);
      const point: Point = { x: 5, y: 5 };
      const eraserSize = 4;

      const { previousData } = applyEraser(editedImageData, originalImageData, point, eraserSize);

      // Previous data should match the edited image data (before eraser was applied)
      expect(previousData.width).toBe(10);
      expect(previousData.height).toBe(10);

      // All pixels in previousData should be the edited color (white)
      const pixel = getPixel(previousData, 5, 5);
      expect(pixel).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    });

    it('handles eraser at image boundary (top-left corner)', () => {
      const originalImageData = createImageData(10, 10, 80, 120, 160, 255);
      const editedImageData = createImageData(10, 10, 255, 255, 255, 255);
      const point: Point = { x: 0, y: 0 };
      const eraserSize = 6; // radius = 3

      const { newImageData } = applyEraser(editedImageData, originalImageData, point, eraserSize);

      // Center pixel (0,0) should be restored to original
      const centerPixel = getPixel(newImageData, 0, 0);
      expect(centerPixel).toEqual({ r: 80, g: 120, b: 160, a: 255 });

      // Pixel within radius should be restored
      const nearPixel = getPixel(newImageData, 1, 1);
      expect(nearPixel).toEqual({ r: 80, g: 120, b: 160, a: 255 });

      // Should not throw or corrupt data
      expect(newImageData.width).toBe(10);
      expect(newImageData.height).toBe(10);
    });

    it('handles eraser at image boundary (bottom-right corner)', () => {
      const originalImageData = createImageData(10, 10, 80, 120, 160, 255);
      const editedImageData = createImageData(10, 10, 255, 255, 255, 255);
      const point: Point = { x: 9, y: 9 };
      const eraserSize = 6; // radius = 3

      const { newImageData } = applyEraser(editedImageData, originalImageData, point, eraserSize);

      // Center pixel should be restored to original
      const centerPixel = getPixel(newImageData, 9, 9);
      expect(centerPixel).toEqual({ r: 80, g: 120, b: 160, a: 255 });

      // Should not throw or corrupt data
      expect(newImageData.width).toBe(10);
      expect(newImageData.height).toBe(10);
    });

    it('supports adjustable eraser sizes', () => {
      const originalImageData = createImageData(30, 30, 50, 100, 150, 255);
      const editedImageData = createImageData(30, 30, 255, 255, 255, 255);
      const point: Point = { x: 15, y: 15 };

      // Small eraser (size 2, radius 1)
      const { newImageData: smallResult } = applyEraser(editedImageData, originalImageData, point, 2);
      // Large eraser (size 20, radius 10)
      const { newImageData: largeResult } = applyEraser(editedImageData, originalImageData, point, 20);

      // Count restored pixels for each
      let smallRestoredCount = 0;
      let largeRestoredCount = 0;

      for (let y = 0; y < 30; y++) {
        for (let x = 0; x < 30; x++) {
          const smallPixel = getPixel(smallResult, x, y);
          const largePixel = getPixel(largeResult, x, y);
          if (smallPixel.r === 50 && smallPixel.g === 100 && smallPixel.b === 150) {
            smallRestoredCount++;
          }
          if (largePixel.r === 50 && largePixel.g === 100 && largePixel.b === 150) {
            largeRestoredCount++;
          }
        }
      }

      // Larger eraser should restore more pixels
      expect(largeRestoredCount).toBeGreaterThan(smallRestoredCount);
    });

    it('does not modify the original input imageData objects', () => {
      const originalImageData = createImageData(10, 10, 50, 75, 100, 255);
      const editedImageData = createImageData(10, 10, 255, 255, 255, 255);
      const originalDataCopy = new Uint8ClampedArray(originalImageData.data);
      const editedDataCopy = new Uint8ClampedArray(editedImageData.data);
      const point: Point = { x: 5, y: 5 };
      const eraserSize = 4;

      applyEraser(editedImageData, originalImageData, point, eraserSize);

      // Neither input should be modified
      expect(originalImageData.data).toEqual(originalDataCopy);
      expect(editedImageData.data).toEqual(editedDataCopy);
    });
  });

  describe('applyEraserStroke', () => {
    it('applies eraser to all points in the stroke', () => {
      const originalImageData = createImageData(30, 30, 80, 120, 160, 255);
      const editedImageData = createImageData(30, 30, 255, 255, 255, 255);
      const points: Point[] = [
        { x: 5, y: 15 },
        { x: 15, y: 15 },
        { x: 25, y: 15 },
      ];
      const eraserSize = 4;

      const { newImageData } = applyEraserStroke(editedImageData, originalImageData, points, eraserSize);

      // Each point center should be restored to original
      for (const p of points) {
        const pixel = getPixel(newImageData, p.x, p.y);
        expect(pixel).toEqual({ r: 80, g: 120, b: 160, a: 255 });
      }
    });

    it('saves original state before the entire stroke for undo', () => {
      const originalImageData = createImageData(20, 20, 50, 75, 100, 255);
      const editedImageData = createImageData(20, 20, 255, 255, 255, 255);
      const points: Point[] = [
        { x: 5, y: 5 },
        { x: 10, y: 10 },
      ];
      const eraserSize = 4;

      const { previousData } = applyEraserStroke(editedImageData, originalImageData, points, eraserSize);

      // Previous data should contain the edited colors (white) at all positions
      const pixel1 = getPixel(previousData, 5, 5);
      expect(pixel1).toEqual({ r: 255, g: 255, b: 255, a: 255 });

      const pixel2 = getPixel(previousData, 10, 10);
      expect(pixel2).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    });

    it('handles empty points array gracefully', () => {
      const originalImageData = createImageData(10, 10, 50, 75, 100, 255);
      const editedImageData = createImageData(10, 10, 255, 255, 255, 255);
      const points: Point[] = [];
      const eraserSize = 4;

      const { newImageData, previousData } = applyEraserStroke(editedImageData, originalImageData, points, eraserSize);

      // No changes should be made - newImageData should match editedImageData
      expect(newImageData.data).toEqual(editedImageData.data);
      expect(previousData.data).toEqual(editedImageData.data);
    });

    it('handles single point stroke same as applyEraser', () => {
      const originalImageData = createImageData(20, 20, 80, 120, 160, 255);
      const editedImageData = createImageData(20, 20, 255, 255, 255, 255);
      const point: Point = { x: 10, y: 10 };
      const eraserSize = 6;

      const { newImageData: strokeResult } = applyEraserStroke(editedImageData, originalImageData, [point], eraserSize);
      const { newImageData: singleResult } = applyEraser(editedImageData, originalImageData, point, eraserSize);

      // Results should be identical
      expect(strokeResult.data).toEqual(singleResult.data);
    });
  });

  describe('eraser after brush (integration)', () => {
    it('restores original pixels after brush has painted them white', () => {
      const originalImageData = createImageData(20, 20, 100, 150, 200, 255);
      const point: Point = { x: 10, y: 10 };
      const toolSize = 6;

      // Step 1: Apply brush to paint area white
      const { newImageData: afterBrush } = applyBrush(originalImageData, point, toolSize);

      // Verify brush painted white
      const brushedPixel = getPixel(afterBrush, 10, 10);
      expect(brushedPixel).toEqual({ r: 255, g: 255, b: 255, a: 255 });

      // Step 2: Apply eraser to restore original pixels
      const { newImageData: afterEraser } = applyEraser(afterBrush, originalImageData, point, toolSize);

      // Verify eraser restored original color
      const erasedPixel = getPixel(afterEraser, 10, 10);
      expect(erasedPixel).toEqual({ r: 100, g: 150, b: 200, a: 255 });

      // Verify pixels outside the tool area remain unchanged (original color, never touched)
      const untouchedPixel = getPixel(afterEraser, 0, 0);
      expect(untouchedPixel).toEqual({ r: 100, g: 150, b: 200, a: 255 });
    });
  });
});
