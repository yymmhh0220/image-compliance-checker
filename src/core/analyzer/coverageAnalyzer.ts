import type { CoverageResult, SegmentationMask, BoundingBox } from '../../types';

/**
 * 分析商品在图片中的占比是否符合 Amazon 主图合规要求。
 *
 * 合规条件：
 * - 商品占比 ≥ 85% 且 ≤ 100%
 * - 商品不触及图片边界（未被裁切）
 *
 * 分类规则：
 * - 占比 < 85%：不足（不合规）
 * - 85% ≤ 占比 ≤ 100% 且未裁切：合规
 * - 商品触及图片边界：被裁切（不合规）
 *
 * @param imageData - 图片像素数据（用于获取宽高）
 * @param mask - 分割掩码，data[i] === 255 表示前景（商品），0 表示背景
 * @returns CoverageResult 包含占比百分比、合规状态、是否裁切、边界框
 */
export function analyzeCoverage(imageData: ImageData, mask: SegmentationMask): CoverageResult {
  const { width, height } = imageData;
  const maskData = mask.data;
  const totalPixels = width * height;

  let foregroundPixelCount = 0;
  let isCropped = false;

  // Bounding box tracking
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let i = 0; i < totalPixels; i++) {
    if (maskData[i] === 255) {
      foregroundPixelCount++;

      const x = i % width;
      const y = Math.floor(i / width);

      // Update bounding box
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      // Check if foreground pixel touches image boundary
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        isCropped = true;
      }
    }
  }

  // Calculate coverage percentage
  const coveragePercentage = totalPixels > 0 ? (foregroundPixelCount / totalPixels) * 100 : 0;

  // Determine bounding box
  let boundingBox: BoundingBox;
  if (foregroundPixelCount === 0) {
    // No foreground pixels — empty bounding box
    boundingBox = { x: 0, y: 0, width: 0, height: 0 };
  } else {
    boundingBox = {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  // Compliant: coverage >= 85% AND coverage <= 100% AND not cropped
  const isCompliant = coveragePercentage >= 85 && coveragePercentage <= 100 && !isCropped;

  return {
    coveragePercentage,
    isCompliant,
    isCropped,
    boundingBox,
  };
}
