import type { SegmentationMask } from '../../types';

/**
 * 将图片背景替换为纯白色。
 * 掩码中 data[i] === 0 的像素为背景，替换为 RGB(255, 255, 255)。
 * 前景像素（data[i] === 255）保持不变。
 */
export function replaceBackground(imageData: ImageData, mask: SegmentationMask): ImageData {
  const { width, height } = imageData;
  const newData = new Uint8ClampedArray(imageData.data);
  const totalPixels = width * height;

  for (let i = 0; i < totalPixels; i++) {
    if (mask.data[i] === 0) {
      // Background pixel - replace with pure white
      const idx = i * 4;
      newData[idx] = 255;     // R
      newData[idx + 1] = 255; // G
      newData[idx + 2] = 255; // B
      newData[idx + 3] = 255; // A
    }
    // Foreground pixels remain unchanged (already copied)
  }

  return { data: newData, width, height, colorSpace: 'srgb' } as ImageData;
}
