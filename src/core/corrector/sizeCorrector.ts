/**
 * 尺寸调整修正器
 * 等比例放大图片至最长边达到目标像素值（默认 1000px）。
 * 使用高质量插值算法（imageSmoothingQuality: 'high'）。
 * 保持宽高比不变（误差 < 0.01）。
 */

export interface NewDimensions {
  newWidth: number;
  newHeight: number;
}

/**
 * 计算等比例缩放后的新尺寸。
 * 如果最长边已经 >= targetLongEdge，返回原始尺寸。
 */
export function calculateNewDimensions(
  width: number,
  height: number,
  targetLongEdge: number
): NewDimensions {
  const currentLongEdge = Math.max(width, height);

  if (currentLongEdge >= targetLongEdge) {
    return { newWidth: width, newHeight: height };
  }

  const scale = targetLongEdge / currentLongEdge;
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  return { newWidth, newHeight };
}

/**
 * 等比例放大图片至最长边达到 targetLongEdge 像素。
 * 如果图片最长边已经 >= targetLongEdge，返回原图不变。
 * 使用 OffscreenCanvas（或 document.createElement('canvas')）进行高质量缩放。
 */
export function resizeImage(imageData: ImageData, targetLongEdge: number): ImageData {
  const { width, height } = imageData;
  const currentLongEdge = Math.max(width, height);

  // If already at or above target, return unchanged
  if (currentLongEdge >= targetLongEdge) {
    return imageData;
  }

  const { newWidth, newHeight } = calculateNewDimensions(width, height, targetLongEdge);

  // Create source canvas with original image
  const sourceCanvas = createCanvas(width, height);
  const sourceCtx = sourceCanvas.getContext('2d')!;
  sourceCtx.putImageData(imageData, 0, 0);

  // Create destination canvas with new dimensions
  const destCanvas = createCanvas(newWidth, newHeight);
  const destCtx = destCanvas.getContext('2d')!;

  // Enable high-quality image smoothing
  destCtx.imageSmoothingEnabled = true;
  destCtx.imageSmoothingQuality = 'high';

  // Draw scaled image
  destCtx.drawImage(sourceCanvas, 0, 0, newWidth, newHeight);

  // Extract and return the resized ImageData
  return destCtx.getImageData(0, 0, newWidth, newHeight);
}

/**
 * Creates a canvas element using OffscreenCanvas if available,
 * otherwise falls back to document.createElement('canvas').
 */
function createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
