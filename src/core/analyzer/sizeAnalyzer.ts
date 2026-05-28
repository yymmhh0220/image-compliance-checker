import type { SizeResult } from '../../types';

/**
 * 分析图片尺寸是否符合 Amazon 主图合规要求。
 * 合规条件：最长边（max(width, height)）≥ 1000 像素。
 */
export function analyzeSize(imageData: ImageData): SizeResult {
  const width = imageData.width;
  const height = imageData.height;
  const longEdge = Math.max(width, height);
  const isCompliant = longEdge >= 1000;

  return { width, height, longEdge, isCompliant };
}
