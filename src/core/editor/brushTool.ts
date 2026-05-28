import type { Point } from '../../types';

/**
 * Creates an ImageData-compatible object. Works in both browser and test environments.
 */
function createImageDataCopy(source: ImageData): ImageData {
  return {
    width: source.width,
    height: source.height,
    data: new Uint8ClampedArray(source.data),
    colorSpace: source.colorSpace ?? 'srgb',
  } as ImageData;
}

/**
 * Applies a circular brush stroke at a single point, filling pixels with pure white.
 * The brush is circular with diameter equal to brushSize.
 *
 * @param imageData - The current image data to paint on
 * @param point - The center point of the brush
 * @param brushSize - The diameter of the brush in pixels
 * @returns An object containing the new image data and a copy of the previous data (for undo)
 */
export function applyBrush(
  imageData: ImageData,
  point: Point,
  brushSize: number
): { newImageData: ImageData; previousData: ImageData } {
  // Save a copy of the original data for undo
  const previousData = createImageDataCopy(imageData);

  // Create a new ImageData with a copy of the pixel data
  const newImageData = createImageDataCopy(imageData);

  const radius = brushSize / 2;
  const centerX = Math.round(point.x);
  const centerY = Math.round(point.y);

  // Calculate bounding box for the brush area, clamped to image bounds
  const minX = Math.max(0, Math.floor(centerX - radius));
  const maxX = Math.min(imageData.width - 1, Math.ceil(centerX + radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxY = Math.min(imageData.height - 1, Math.ceil(centerY + radius));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Check if pixel is within the circular brush area
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= radius) {
        const index = (y * imageData.width + x) * 4;
        // Fill with pure white (RGBA: 255, 255, 255, 255)
        newImageData.data[index] = 255;     // R
        newImageData.data[index + 1] = 255; // G
        newImageData.data[index + 2] = 255; // B
        newImageData.data[index + 3] = 255; // A
      }
    }
  }

  return { newImageData, previousData };
}

/**
 * Applies a brush stroke along a series of points (for continuous strokes).
 * Saves the original state before the entire stroke for undo.
 *
 * @param imageData - The current image data to paint on
 * @param points - Array of points defining the stroke path
 * @param brushSize - The diameter of the brush in pixels
 * @returns An object containing the new image data and a copy of the previous data (for undo)
 */
export function applyBrushStroke(
  imageData: ImageData,
  points: Point[],
  brushSize: number
): { newImageData: ImageData; previousData: ImageData } {
  // Save a copy of the original data before the entire stroke for undo
  const previousData = createImageDataCopy(imageData);

  // Start with a copy of the current image data
  const currentData = createImageDataCopy(imageData);

  const radius = brushSize / 2;

  // Apply brush at each point in the stroke
  for (const point of points) {
    const centerX = Math.round(point.x);
    const centerY = Math.round(point.y);

    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(imageData.width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(imageData.height - 1, Math.ceil(centerY + radius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= radius) {
          const index = (y * imageData.width + x) * 4;
          currentData.data[index] = 255;     // R
          currentData.data[index + 1] = 255; // G
          currentData.data[index + 2] = 255; // B
          currentData.data[index + 3] = 255; // A
        }
      }
    }
  }

  return { newImageData: currentData, previousData };
}
