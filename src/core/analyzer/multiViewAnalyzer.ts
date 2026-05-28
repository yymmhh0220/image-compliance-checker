import type { MultiViewResult, SegmentationMask } from '../../types';

/**
 * 分析图片中是否包含多个独立的前景区域（多视图检测）。
 *
 * 使用连通分量标记（4-连通 flood fill）检测分割掩码中独立的前景区域。
 * 过滤掉面积小于总图片面积 1% 的噪声区域。
 * 如果存在 2 个或以上的显著前景区域，则判定为多视图（不合规）。
 *
 * @param imageData - 图片像素数据（用于获取宽高）
 * @param mask - 分割掩码，data[i] === 255 表示前景，0 表示背景
 * @returns MultiViewResult 包含是否多视图、视图数量、合规状态
 */
export function analyzeMultiView(imageData: ImageData, mask: SegmentationMask): MultiViewResult {
  const { width, height } = imageData;
  const totalPixels = width * height;
  const noiseThreshold = totalPixels * 0.01; // 1% of total area

  // Track visited pixels
  const visited = new Uint8Array(totalPixels);

  // Find connected components using 4-connectivity flood fill
  const regionSizes: number[] = [];

  for (let i = 0; i < totalPixels; i++) {
    if (mask.data[i] === 255 && !visited[i]) {
      // Found an unvisited foreground pixel — start a new region
      const regionSize = floodFill(mask.data, visited, width, height, i);
      regionSizes.push(regionSize);
    }
  }

  // Filter out noise regions (smaller than 1% of total image area)
  const significantRegions = regionSizes.filter(size => size >= noiseThreshold);

  const viewCount = significantRegions.length;
  const hasMultipleViews = viewCount >= 2;
  const isCompliant = !hasMultipleViews;

  return {
    hasMultipleViews,
    viewCount,
    isCompliant,
  };
}

/**
 * Flood fill using 4-connectivity (up, down, left, right) via iterative BFS.
 * Marks all connected foreground pixels as visited and returns the region size.
 */
function floodFill(
  maskData: Uint8Array,
  visited: Uint8Array,
  width: number,
  height: number,
  startIndex: number
): number {
  const queue: number[] = [startIndex];
  visited[startIndex] = 1;
  let size = 0;

  while (queue.length > 0) {
    const idx = queue.pop()!;
    size++;

    const x = idx % width;
    const y = Math.floor(idx / width);

    // 4-connectivity neighbors: up, down, left, right
    const neighbors = [
      y > 0 ? idx - width : -1,           // up
      y < height - 1 ? idx + width : -1,   // down
      x > 0 ? idx - 1 : -1,               // left
      x < width - 1 ? idx + 1 : -1,       // right
    ];

    for (const neighborIdx of neighbors) {
      if (neighborIdx >= 0 && !visited[neighborIdx] && maskData[neighborIdx] === 255) {
        visited[neighborIdx] = 1;
        queue.push(neighborIdx);
      }
    }
  }

  return size;
}
