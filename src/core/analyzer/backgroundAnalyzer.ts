import type { BackgroundResult, SegmentationMask } from '../../types';

/**
 * 分析图片背景颜色是否符合 Amazon 主图合规要求。
 * 合规条件：背景区域平均 RGB 各通道值均 ≥ 250（与纯白偏差不超过阈值 5）。
 *
 * 背景像素由分割掩码确定：mask.data[i] === 0 表示背景像素。
 */
export function analyzeBackground(imageData: ImageData, mask: SegmentationMask): BackgroundResult {
  const { data } = imageData;
  const maskData = mask.data;
  const totalPixels = imageData.width * imageData.height;

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let backgroundPixelCount = 0;
  let nonWhitePixelCount = 0;

  for (let i = 0; i < totalPixels; i++) {
    if (maskData[i] === 0) {
      // This is a background pixel
      const pixelIndex = i * 4;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];

      sumR += r;
      sumG += g;
      sumB += b;
      backgroundPixelCount++;

      // A pixel is considered non-white if any channel < 250
      if (r < 250 || g < 250 || b < 250) {
        nonWhitePixelCount++;
      }
    }
  }

  // Edge case: no background pixels (all foreground) — consider compliant
  if (backgroundPixelCount === 0) {
    return {
      averageRGB: { r: 255, g: 255, b: 255 },
      maxDeviation: 0,
      isCompliant: true,
      nonWhitePercentage: 0,
    };
  }

  const avgR = sumR / backgroundPixelCount;
  const avgG = sumG / backgroundPixelCount;
  const avgB = sumB / backgroundPixelCount;

  // Compliant if all average channels >= 250
  const isCompliant = avgR >= 250 && avgG >= 250 && avgB >= 250;

  // Max deviation from pure white (255)
  const maxDeviation = Math.max(255 - avgR, 255 - avgG, 255 - avgB);

  // Percentage of background pixels that are non-white
  const nonWhitePercentage = (nonWhitePixelCount / backgroundPixelCount) * 100;

  return {
    averageRGB: { r: avgR, g: avgG, b: avgB },
    maxDeviation,
    isCompliant,
    nonWhitePercentage,
  };
}
