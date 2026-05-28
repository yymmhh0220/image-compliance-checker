import type { SegmentationMask } from '../../types';

/**
 * 商品占比调整修正器
 * 裁剪图片周围多余的白色区域，使商品占比达到目标值（默认 85%）。
 * 确保商品主体完整不被裁切（所有前景像素保留）。
 */

export interface ForegroundBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 找到所有前景像素的边界框。
 * 返回 null 如果没有前景像素。
 */
export function findForegroundBBox(mask: SegmentationMask): ForegroundBBox | null {
  const { width, height, data } = mask;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (data[idx] === 255) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1) {
    return null; // No foreground pixels
  }

  return { minX, minY, maxX, maxY };
}

/**
 * 计算裁剪区域，使得裁剪后商品占比 >= targetCoverage。
 * 
 * 算法：
 * 1. 计算前景像素数量
 * 2. 计算满足目标占比所需的最大总像素数：maxTotalPixels = foregroundPixelCount * 100 / targetCoverage
 * 3. 以前景边界框为中心，扩展裁剪区域直到面积 <= maxTotalPixels
 * 4. 裁剪区域不能超出原始图片边界
 * 5. 裁剪区域必须包含所有前景像素
 * 
 * @param width 原始图片宽度
 * @param height 原始图片高度
 * @param foregroundBBox 前景像素的边界框
 * @param foregroundPixelCount 前景像素总数
 * @param targetCoverage 目标占比百分比（默认 85）
 * @returns 裁剪区域
 */
export function calculateCropArea(
  width: number,
  height: number,
  foregroundBBox: ForegroundBBox,
  foregroundPixelCount: number,
  targetCoverage: number = 85
): CropArea {
  const { minX, minY, maxX, maxY } = foregroundBBox;

  // Bounding box dimensions (inclusive, so +1)
  const bboxWidth = maxX - minX + 1;
  const bboxHeight = maxY - minY + 1;

  // Maximum total pixels allowed to achieve target coverage
  const maxTotalPixels = Math.floor(foregroundPixelCount * 100 / targetCoverage);

  // If the bounding box area already exceeds maxTotalPixels,
  // we can't do better than the bounding box itself
  if (bboxWidth * bboxHeight >= maxTotalPixels) {
    return { x: minX, y: minY, width: bboxWidth, height: bboxHeight };
  }

  // We want to expand the bounding box symmetrically while keeping:
  // 1. cropWidth * cropHeight <= maxTotalPixels
  // 2. The crop area within image bounds
  // 3. The aspect ratio of the expansion roughly balanced
  
  // Strategy: expand proportionally from the bounding box center
  // Find the scale factor that gives us the target area
  const bboxArea = bboxWidth * bboxHeight;
  const scaleFactor = Math.sqrt(maxTotalPixels / bboxArea);

  // Calculate target crop dimensions
  let cropWidth = Math.min(Math.round(bboxWidth * scaleFactor), width);
  let cropHeight = Math.min(Math.round(bboxHeight * scaleFactor), height);

  // Ensure crop dimensions are at least as large as the bounding box
  cropWidth = Math.max(cropWidth, bboxWidth);
  cropHeight = Math.max(cropHeight, bboxHeight);

  // Ensure the crop area doesn't exceed maxTotalPixels
  if (cropWidth * cropHeight > maxTotalPixels) {
    // Scale down proportionally
    const adjustFactor = Math.sqrt(maxTotalPixels / (cropWidth * cropHeight));
    cropWidth = Math.max(Math.floor(cropWidth * adjustFactor), bboxWidth);
    cropHeight = Math.max(Math.floor(cropHeight * adjustFactor), bboxHeight);
  }

  // Center the crop area around the bounding box center
  const bboxCenterX = (minX + maxX) / 2;
  const bboxCenterY = (minY + maxY) / 2;

  let cropX = Math.round(bboxCenterX - cropWidth / 2);
  let cropY = Math.round(bboxCenterY - cropHeight / 2);

  // Clamp to image bounds
  cropX = Math.max(0, Math.min(cropX, width - cropWidth));
  cropY = Math.max(0, Math.min(cropY, height - cropHeight));

  // Ensure all foreground pixels are included
  if (cropX > minX) cropX = minX;
  if (cropY > minY) cropY = minY;
  if (cropX + cropWidth - 1 < maxX) {
    cropX = maxX - cropWidth + 1;
    if (cropX < 0) {
      cropWidth = maxX + 1;
      cropX = 0;
    }
  }
  if (cropY + cropHeight - 1 < maxY) {
    cropY = maxY - cropHeight + 1;
    if (cropY < 0) {
      cropHeight = maxY + 1;
      cropY = 0;
    }
  }

  // Final bounds check
  cropX = Math.max(0, cropX);
  cropY = Math.max(0, cropY);
  cropWidth = Math.min(cropWidth, width - cropX);
  cropHeight = Math.min(cropHeight, height - cropY);

  return { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
}

/**
 * 计算掩码中前景像素的数量。
 */
function countForegroundPixels(mask: SegmentationMask): number {
  let count = 0;
  for (let i = 0; i < mask.data.length; i++) {
    if (mask.data[i] === 255) {
      count++;
    }
  }
  return count;
}

/**
 * 裁剪图片周围多余白色区域使商品占比 >= targetCoverage。
 * 确保商品主体完整不被裁切（所有前景像素保留）。
 * 
 * @param imageData 原始图片数据
 * @param mask 分割掩码（0=背景, 255=前景）
 * @param targetCoverage 目标占比百分比（默认 85）
 * @returns 裁剪后的 ImageData
 */
export function adjustCoverage(
  imageData: ImageData,
  mask: SegmentationMask,
  targetCoverage: number = 85
): ImageData {
  const { width, height } = imageData;
  const totalPixels = width * height;

  // Count foreground pixels
  const foregroundPixelCount = countForegroundPixels(mask);

  // If no foreground pixels, return original
  if (foregroundPixelCount === 0) {
    return imageData;
  }

  // Check if already at target coverage
  const currentCoverage = (foregroundPixelCount / totalPixels) * 100;
  if (currentCoverage >= targetCoverage) {
    return imageData;
  }

  // Find foreground bounding box
  const bbox = findForegroundBBox(mask);
  if (!bbox) {
    return imageData;
  }

  // Calculate crop area
  const cropArea = calculateCropArea(width, height, bbox, foregroundPixelCount, targetCoverage);

  // If crop area is the same as original, return unchanged
  if (cropArea.x === 0 && cropArea.y === 0 && cropArea.width === width && cropArea.height === height) {
    return imageData;
  }

  // Extract cropped image data
  const croppedData = new Uint8ClampedArray(cropArea.width * cropArea.height * 4);

  for (let y = 0; y < cropArea.height; y++) {
    for (let x = 0; x < cropArea.width; x++) {
      const srcX = cropArea.x + x;
      const srcY = cropArea.y + y;
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * cropArea.width + x) * 4;

      croppedData[dstIdx] = imageData.data[srcIdx];
      croppedData[dstIdx + 1] = imageData.data[srcIdx + 1];
      croppedData[dstIdx + 2] = imageData.data[srcIdx + 2];
      croppedData[dstIdx + 3] = imageData.data[srcIdx + 3];
    }
  }

  return {
    data: croppedData,
    width: cropArea.width,
    height: cropArea.height,
    colorSpace: 'srgb',
  } as ImageData;
}
