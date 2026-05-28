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
 * Applies a circular eraser at a single point, restoring pixels to their original values.
 * The eraser is circular with diameter equal to eraserSize.
 *
 * @param currentImageData - The current image data (possibly edited)
 * @param originalImageData - The original image data before any edits
 * @param point - The center point of the eraser
 * @param eraserSize - The diameter of the eraser in pixels
 * @returns An object containing the new image data and a copy of the previous state (for undo)
 */
export function applyEraser(
  currentImageData: ImageData,
  originalImageData: ImageData,
  point: Point,
  eraserSize: number
): { newImageData: ImageData; previousData: ImageData } {
  // Save a copy of the current data for undo
  const previousData = createImageDataCopy(currentImageData);

  // Create a new ImageData with a copy of the current pixel data
  const newImageData = createImageDataCopy(currentImageData);

  const radius = eraserSize / 2;
  const centerX = Math.round(point.x);
  const centerY = Math.round(point.y);

  // Calculate bounding box for the eraser area, clamped to image bounds
  const minX = Math.max(0, Math.floor(centerX - radius));
  const maxX = Math.min(currentImageData.width - 1, Math.ceil(centerX + radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxY = Math.min(currentImageData.height - 1, Math.ceil(centerY + radius));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Check if pixel is within the circular eraser area
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= radius) {
        const index = (y * currentImageData.width + x) * 4;
        // Restore to original pixel values
        newImageData.data[index] = originalImageData.data[index];         // R
        newImageData.data[index + 1] = originalImageData.data[index + 1]; // G
        newImageData.data[index + 2] = originalImageData.data[index + 2]; // B
        newImageData.data[index + 3] = originalImageData.data[index + 3]; // A
      }
    }
  }

  return { newImageData, previousData };
}

/**
 * Applies an eraser stroke along a series of points (for continuous strokes).
 * Restores pixels to their original values from originalImageData.
 * Saves the state before the entire stroke for undo.
 *
 * @param currentImageData - The current image data (possibly edited)
 * @param originalImageData - The original image data before any edits
 * @param points - Array of points defining the stroke path
 * @param eraserSize - The diameter of the eraser in pixels
 * @returns An object containing the new image data and a copy of the previous state (for undo)
 */
export function applyEraserStroke(
  currentImageData: ImageData,
  originalImageData: ImageData,
  points: Point[],
  eraserSize: number
): { newImageData: ImageData; previousData: ImageData } {
  // Save a copy of the current data before the entire stroke for undo
  const previousData = createImageDataCopy(currentImageData);

  // Start with a copy of the current image data
  const currentData = createImageDataCopy(currentImageData);

  const radius = eraserSize / 2;

  // Apply eraser at each point in the stroke
  for (const point of points) {
    const centerX = Math.round(point.x);
    const centerY = Math.round(point.y);

    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(currentImageData.width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(currentImageData.height - 1, Math.ceil(centerY + radius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= radius) {
          const index = (y * currentImageData.width + x) * 4;
          // Restore to original pixel values
          currentData.data[index] = originalImageData.data[index];         // R
          currentData.data[index + 1] = originalImageData.data[index + 1]; // G
          currentData.data[index + 2] = originalImageData.data[index + 2]; // B
          currentData.data[index + 3] = originalImageData.data[index + 3]; // A
        }
      }
    }
  }

  return { newImageData: currentData, previousData };
}
